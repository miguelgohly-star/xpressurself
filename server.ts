import { createServer } from "http";
import { Server } from "socket.io";
import next from "next";
import {
  createRoom,
  getRoom,
  joinRoom,
  setPhase,
  setCategory,
  setTimeLimit,
  setSongDuration,
  setScreenMode,
  submitSong,
  castVote,
  nextSong,
  startTiebreaker,
  type TimeLimit,
  type SongDuration,
  type ScreenMode,
} from "./lib/gameState";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

// Track per-room submission timers so we can clear them
const submissionTimers = new Map<string, ReturnType<typeof setTimeout>>();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    handle(req, res);
  });

  const io = new Server(httpServer, { cors: { origin: "*" } });

  function beginCountdownThenPlay(code: string) {
    setPhase(code, "starting");
    io.to(code).emit("room-updated", getRoom(code));
    setTimeout(() => {
      const r = getRoom(code);
      if (!r || r.phase !== "starting") return;
      setPhase(code, "playing");
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
    socket.on("create-room", ({ hostName }: { hostName: string }) => {
      const room = createRoom(socket.id, hostName);
      socket.join(room.code);
      socket.emit("room-created", room);
    });

    socket.on("join-room", ({ code, playerName }: { code: string; playerName: string }) => {
      const room = joinRoom(code.toUpperCase(), socket.id, playerName);
      if (!room) {
        socket.emit("error", { message: "Room not found or full" });
        return;
      }
      socket.join(code.toUpperCase());
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

    socket.on("next-song", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room || socket.id !== room.hostId) return;

      const updated = nextSong(code);
      if (!updated) return;

      if (updated.currentSongIndex >= updated.submissions.length) {
        setPhase(code, "results");
        io.to(code).emit("room-updated", getRoom(code));
      } else {
        io.to(code).emit("room-updated", updated);
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
      setPhase(code, "lobby");
      const updated = getRoom(code);
      if (updated) {
        updated.currentCategory = null;
        updated.submissions = [];
        updated.currentSongIndex = 0;
        updated.tiedPlayers = [];
        updated.submissionDeadline = null;
      }
      io.to(code).emit("room-updated", getRoom(code));
    });

    socket.on("get-room", ({ code }: { code: string }) => {
      const room = getRoom(code);
      if (!room) return;
      socket.join(code);
      socket.emit("room-updated", room);
    });

    // ── Friend chat: personal room per user id, for typing indicators ──
    socket.on("identify", ({ userId }: { userId: string }) => {
      socket.join(`user:${userId}`);
    });

    socket.on("typing", ({ to, from }: { to: string; from: string }) => {
      io.to(`user:${to}`).emit("friend-typing", { from });
    });

    socket.on("disconnect", () => {});
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(port, () => {
    console.log(`> xpressurself ready on http://localhost:${port}`);
  });
});
