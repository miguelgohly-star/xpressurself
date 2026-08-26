import { createServer } from "http";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import { Server } from "socket.io";
import next from "next";
import {
  createRoom,
  getRoom,
  deleteRoom,
  joinRoom,
  leaveRoom,
  setPhase,
  setCategory,
  setTimeLimit,
  setSongDuration,
  setScreenMode,
  setRoundLimit,
  submitSong,
  castVote,
  nextSong,
  resetSongReadiness,
  markPlayerReady,
  setSongStartedAt,
  castSkipVote,
  startTiebreaker,
  finalizeRound,
  advanceRound,
  restartGame,
  type TimeLimit,
  type SongDuration,
  type ScreenMode,
  type RoundLimit,
} from "./lib/gameState";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Track per-room submission timers so we can clear them
const submissionTimers = new Map<string, ReturnType<typeof setTimeout>>();
// Fallback timers so a stuck/offline player's device can't freeze the game
// forever while "everyone" screen mode waits for every video to report
// ready (see beginSongReadinessWait / the "video-ready" handler below).
const readinessTimers = new Map<string, ReturnType<typeof setTimeout>>();
const READY_TIMEOUT_MS = 15_000;

// When a room last had any socket event touch it (see the onAny hook below,
// and lastActivity.set(...) in "create-room") — a periodic sweep closes any
// room nobody's done anything in for ROOM_INACTIVITY_MS, regardless of
// phase or who's still (silently) connected. Rooms otherwise only ever get
// removed by their player count hitting zero, which — now that a dropped
// connection is never auto-removed mid-game — an abandoned in-progress
// room would never naturally reach on its own.
const lastActivity = new Map<string, number>();
const ROOM_INACTIVITY_MS = 10 * 60 * 1000;
const INACTIVITY_SWEEP_INTERVAL_MS = 60 * 1000;

const MIME_TYPES: Record<string, string> = {
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// Serve static assets (public/ files and built _next/static/ chunks) directly
// off disk, bypassing Next's request handler. Routing every request — even
// tiny static images — through Next's full pipeline adds real per-request
// overhead, which is especially costly under a resource-limited host. Falls
// through to `handle()` (returns false) for anything that isn't a plain file.
async function serveStaticFile(req: import("http").IncomingMessage, res: import("http").ServerResponse): Promise<boolean> {
  const url = req.url ?? "/";
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  const isNextStatic = url.startsWith("/_next/static/");
  const isPublicCandidate = !url.startsWith("/_next/") && !url.startsWith("/api/") && path.extname(url.split("?")[0]) !== "";
  if (!isNextStatic && !isPublicCandidate) return false;

  const relPath = decodeURIComponent(url.split("?")[0]);
  const base = isNextStatic ? path.join(process.cwd(), ".next", "static") : path.join(process.cwd(), "public");
  const filePath = isNextStatic
    ? path.join(base, relPath.replace("/_next/static/", ""))
    : path.join(base, relPath);

  // Guard against path traversal outside the intended base directory.
  if (!filePath.startsWith(base)) return false;

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;

    res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath)] ?? "application/octet-stream");
    res.setHeader("Content-Length", stat.size);
    res.setHeader(
      "Cache-Control",
      isNextStatic ? "public, max-age=31536000, immutable" : "public, max-age=3600"
    );
    if (req.method === "HEAD") { res.end(); return true; }
    await new Promise<void>((resolve, reject) => {
      const stream = createReadStream(filePath);
      stream.on("error", reject);
      stream.on("end", resolve);
      stream.pipe(res);
    });
    return true;
  } catch {
    return false;
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    serveStaticFile(req, res).then((handled) => {
      if (!handled) handle(req, res);
    });
  });

  const io = new Server(httpServer, { cors: { origin: "*" } });

  // Which room each connected socket is currently in, so a disconnect can
  // find its room without the client having to tell us.
  const socketRoomCode = new Map<string, string>();
  // Grace-period timers before a disconnected player is actually removed —
  // gives a dropped connection/refresh a chance to reconnect and rejoin
  // instead of instantly vanishing from the player list.
  const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const DISCONNECT_GRACE_MS = 60_000;

  function clearReadinessTimer(code: string) {
    const t = readinessTimers.get(code);
    if (t) { clearTimeout(t); readinessTimers.delete(code); }
  }

  // Stamps the shared countdown's start time and broadcasts it — safe to
  // call more than once (e.g. from both the last "video-ready" and a
  // fallback timer racing each other), only the first call actually starts it.
  function startSongPlayback(code: string) {
    clearReadinessTimer(code);
    const room = getRoom(code);
    if (!room || room.phase !== "playing" || room.songStartedAt) return;
    setSongStartedAt(code);
    io.to(code).emit("room-updated", getRoom(code));
  }

  // Called every time a new song enters the "playing" phase. "shared" screen
  // mode (or no duration configured) only has one screen to wait on, so the
  // countdown starts immediately. "everyone" mode waits for every player's
  // own device to report its video is ready (see "video-ready" below) before
  // starting the shared countdown, so nobody's timer can run out before
  // their video has even loaded — with a timeout fallback so one stuck
  // device can't freeze the game indefinitely.
  function beginSongReadinessWait(code: string) {
    const room = getRoom(code);
    if (!room) return;
    resetSongReadiness(code);
    clearReadinessTimer(code);
    if (room.screenMode === "everyone" && room.songDuration) {
      readinessTimers.set(code, setTimeout(() => startSongPlayback(code), READY_TIMEOUT_MS));
    } else {
      setSongStartedAt(code);
    }
  }

  // Moves the room to the next song (or, past the last one, to results) —
  // shared by the host's timeout-driven auto-skip and by a skip vote
  // reaching majority. A tiebreaker replays the same round for just the
  // tied players, so only fold scores into the cumulative leaderboard on
  // the original (non-tiebreaker) pass — otherwise those players' scores
  // would be counted twice for what is really still one round.
  function advanceSong(code: string) {
    const updated = nextSong(code);
    if (!updated) return;

    if (updated.currentSongIndex >= updated.submissions.length) {
      if (updated.tiedPlayers.length === 0) {
        finalizeRound(code);
      }
      clearReadinessTimer(code);
      setPhase(code, "results");
      io.to(code).emit("room-updated", getRoom(code));
    } else {
      beginSongReadinessWait(code);
      io.to(code).emit("room-updated", getRoom(code));
    }
  }

  function beginCountdownThenPlay(code: string) {
    setPhase(code, "starting");
    io.to(code).emit("room-updated", getRoom(code));
    setTimeout(() => {
      const r = getRoom(code);
      if (!r || r.phase !== "starting") return;
      setPhase(code, "playing");
      beginSongReadinessWait(code);
      io.to(code).emit("room-updated", getRoom(code));
    }, 3000);
  }

  function advanceToPlaying(code: string) {
    submissionTimers.delete(code);
    const room = getRoom(code);
    if (!room || room.phase !== "submitting") return;
    if (room.submissions.length === 0) return;
    beginCountdownThenPlay(code);
  }

  function startSpin(code: string) {
    const room = getRoom(code);
    if (!room) return;
    setPhase(code, "spinning");
    io.to(code).emit("room-updated", getRoom(code));

    setTimeout(() => {
      const cats = room.categories;
      const picked = cats[Math.floor(Math.random() * cats.length)];
      setCategory(code, picked);
      setPhase(code, "submitting");
      io.to(code).emit("room-updated", getRoom(code));
      scheduleSubmissionTimer(code);
    }, 4000);
  }

  function scheduleSubmissionTimer(code: string) {
    const room = getRoom(code);
    if (!room || !room.timeLimit) return;
    // Clear any existing timer for this room
    const existing = submissionTimers.get(code);
    if (existing) clearTimeout(existing);
    const ms = room.timeLimit * 60 * 1000;
    const timer = setTimeout(() => advanceToPlaying(code), ms);
    submissionTimers.set(code, timer);
  }

  io.on("connection", (socket) => {
    // Centralized activity touch — fires for every incoming event on this
    // socket, so individual handlers never need to remember to call this
    // themselves. Every room-scoped event's payload carries `code`; events
    // that don't (friend chat's "identify"/"typing") just no-op here.
    socket.onAny((_eventName, payload) => {
      const code = payload?.code;
      if (typeof code === "string" && code) lastActivity.set(code.toUpperCase(), Date.now());
    });

    socket.on("create-room", ({ hostName, avatarUrl }: { hostName: string; avatarUrl?: string | null }) => {
      const room = createRoom(socket.id, hostName, avatarUrl ?? null);
      lastActivity.set(room.code, Date.now());
      socket.join(room.code);
      socketRoomCode.set(socket.id, room.code);
      socket.emit("room-created", room);
    });

    socket.on("join-room", ({ code, playerName, avatarUrl }: { code: string; playerName: string; avatarUrl?: string | null }) => {
      const room = joinRoom(code.toUpperCase(), socket.id, playerName, avatarUrl ?? null);
      if (!room) {
        socket.emit("error", { message: "Room not found or full" });
        return;
      }
      socket.join(code.toUpperCase());
      socketRoomCode.set(socket.id, code.toUpperCase());
      io.to(code.toUpperCase()).emit("room-updated", room);
      socket.emit("joined", room);
    });

    // Host sets time limit before spinning
    socket.on("set-time-limit", ({ code, limit }: { code: string; limit: TimeLimit }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      setTimeLimit(code, limit);
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("spin-wheel", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      startSpin(code);
    });

    socket.on("submit-song", ({
      code, youtubeUrl, title, startTime,
    }: { code: string; youtubeUrl: string; title: string; startTime: number }) => {
      const existing = getRoom(code);
      if (existing) {
        const duplicate = existing.submissions.find(
          (s) => s.youtubeUrl === youtubeUrl && s.playerId !== socket.id
        );
        if (duplicate) {
          socket.emit("submit-error", { message: "Someone already picked that song! Choose a different one." });
          return;
        }
      }

      const room = submitSong(code, socket.id, youtubeUrl, title, startTime ?? 0);
      if (!room) return;
      io.to(code).emit("room-updated", room);

      if (room.submissions.length >= room.players.length) {
        const timer = submissionTimers.get(code);
        if (timer) clearTimeout(timer);
        submissionTimers.delete(code);
        beginCountdownThenPlay(code);
      }
    });

    socket.on("kick-player", ({ code, playerId }: { code: string; playerId: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      if (playerId === room.hostId) return; // host can't kick themselves
      const updated = leaveRoom(code, playerId);
      io.to(playerId).emit("kicked");
      if (updated) io.to(code).emit("room-updated", updated);
    });

    socket.on("start-playing", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      const timer = submissionTimers.get(code);
      if (timer) clearTimeout(timer);
      submissionTimers.delete(code);
      beginCountdownThenPlay(code);
    });

    socket.on("set-song-duration", ({ code, duration }: { code: string; duration: SongDuration }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      setSongDuration(code, duration);
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("set-screen-mode", ({ code, mode }: { code: string; mode: ScreenMode }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      setScreenMode(code, mode);
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("set-round-limit", ({ code, limit }: { code: string; limit: RoundLimit }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      setRoundLimit(code, limit);
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("set-categories", ({ code, categories }: { code: string; categories: string[] }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      if (!Array.isArray(categories) || categories.length < 2) return;
      room.categories = categories.filter((c) => typeof c === "string" && c.trim());
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("cast-vote", ({ code, songIndex, stars }: { code: string; songIndex: number; stars: number }) => {
      const room = castVote(code, socket.id, songIndex, stars);
      if (!room) return;
      io.to(code).emit("room-updated", room);
    });

    // Host-only, timeout-driven: fired by the host's own SongTimer expiring
    // once songDuration runs out. A manual player-facing skip instead goes
    // through "skip-vote" below, gated on reaching a majority.
    socket.on("next-song", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      advanceSong(code);
    });

    // Any player (including the host) can vote to skip the current song.
    // Once more than half the room has voted, it advances immediately —
    // same underlying transition as the timeout-driven auto-skip above.
    socket.on("skip-vote", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || room.phase !== "playing") return;
      const updated = castSkipVote(code, socket.id);
      if (!updated) return;
      io.to(code).emit("room-updated", updated);
      if (updated.players.length > 0 && updated.skipVoterIds.length / updated.players.length > 0.5) {
        advanceSong(code);
      }
    });

    // "Everyone" screen mode: each player's own device reports here once its
    // YouTube iframe fires onReady. Once every player has checked in, the
    // shared countdown starts (see startSongPlayback) — see also the timeout
    // fallback set up in beginSongReadinessWait for a device that never does.
    socket.on("video-ready", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || room.phase !== "playing" || room.screenMode !== "everyone" || room.songStartedAt) return;
      const updated = markPlayerReady(code, socket.id);
      if (!updated) return;
      io.to(code).emit("room-updated", updated);
      if (updated.readyPlayerIds.length >= updated.players.length) {
        startSongPlayback(code);
      }
    });

    socket.on("start-tiebreaker", ({ code, tiedPlayerIds }: { code: string; tiedPlayerIds: string[] }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      const updated = startTiebreaker(code, tiedPlayerIds);
      if (!updated) return;
      io.to(code).emit("room-updated", updated);
      scheduleSubmissionTimer(code);
    });

    socket.on("new-round", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      const timer = submissionTimers.get(code);
      if (timer) clearTimeout(timer);
      submissionTimers.delete(code);
      clearReadinessTimer(code);
      const updated = advanceRound(code);
      if (!updated) return;
      startSpin(code);
    });

    socket.on("restart-game", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;
      const timer = submissionTimers.get(code);
      if (timer) clearTimeout(timer);
      submissionTimers.delete(code);
      clearReadinessTimer(code);
      const updated = restartGame(code);
      if (!updated) return;
      io.to(code).emit("room-updated", updated);
    });

    socket.on("get-room", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.join(code);
      socketRoomCode.set(socket.id, code);
      socket.emit("room-updated", room);
    });

    // ── Friend chat: personal room per user id, for typing indicators ──
    socket.on("identify", ({ userId }: { userId: string }) => {
      socket.join(`user:${userId}`);
    });

    socket.on("typing", ({ to, from }: { to: string; from: string }) => {
      io.to(`user:${to}`).emit("friend-typing", { from });
    });

    socket.on("disconnect", () => {
      const code = socketRoomCode.get(socket.id);
      socketRoomCode.delete(socket.id);
      if (!code) return;

      const playerId = socket.id;
      const timer = setTimeout(() => {
        disconnectTimers.delete(playerId);
        // Once a game is actively in progress, a dropped connection should
        // never auto-remove someone — join-room's reclaim-by-name lets them
        // step back into their seat (host status, submission, votes and
        // all) no matter how long they were away. Only a still-"lobby" room
        // auto-cleans an idle disconnected player after the grace period;
        // mid-game, only the host's explicit Kick removes someone.
        const room = getRoom(code);
        if (!room || room.phase !== "lobby") return;
        const updated = leaveRoom(code, playerId);
        if (updated) io.to(code).emit("room-updated", updated);
      }, DISCONNECT_GRACE_MS);
      disconnectTimers.set(playerId, timer);
    });
  });

  // Close any room nobody's touched in ROOM_INACTIVITY_MS, regardless of
  // phase — the disconnect-grace path above only ever cleans up an idle
  // *lobby* (see the comment there); a room that's actually mid-game with
  // everyone gone silent would otherwise sit in memory forever.
  setInterval(() => {
    const now = Date.now();
    for (const [code, ts] of lastActivity) {
      if (now - ts < ROOM_INACTIVITY_MS) continue;
      lastActivity.delete(code);
      if (!getRoom(code)) continue; // already gone via the normal empty-room path
      io.to(code).emit("error", { message: "Room closed due to inactivity" });
      deleteRoom(code);
      clearReadinessTimer(code);
      const submissionTimer = submissionTimers.get(code);
      if (submissionTimer) clearTimeout(submissionTimer);
      submissionTimers.delete(code);
    }
  }, INACTIVITY_SWEEP_INTERVAL_MS);

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(port, () => {
    console.log(`> xpressurself ready on http://localhost:${port}`);
  });
});
