export type GamePhase =
  | "lobby"
  | "spinning"
  | "submitting"
  | "starting"   // 3-second countdown before first song plays
  | "playing"
  | "results"
  | "tiebreaker";

export type TimeLimit = 1 | 3 | 5 | null;
export type SongDuration = 15 | 30 | 60 | null; // seconds, null = unlimited
export type ScreenMode = "shared" | "everyone"; // "shared" = video plays on host screen only; "everyone" = every player's own device plays it too

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
}

export interface SongSubmission {
  playerId: string;
  playerName: string;
  youtubeUrl: string;
  title: string;
  startTime: number; // seconds
  votes: number[];
}

export interface Room {
  code: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  categories: string[];
  currentCategory: string | null;
  submissions: SongSubmission[];
  currentSongIndex: number;
  round: number;
  tiedPlayers: string[];
  timeLimit: TimeLimit;
  submissionDeadline: number | null;
  songDuration: SongDuration;
  screenMode: ScreenMode;
}

const DEFAULT_CATEGORIES = [
  "Best Breakup Song",
  "Song That Hits Different at 3AM",
  "Ultimate Hype Track",
  "Best Song to Drive To",
  "Song That Defined Your Childhood",
  "Best Song to Cry To",
  "Underrated Banger",
  "Best Opening Track",
  "Song Everyone Knows the Words To",
  "Best Bass Drop",
  "Song That Makes You Feel Invincible",
  "Best Love Song",
  "Song for a Road Trip",
  "Weirdest Song You Love",
  "Best Song From a Movie",
];

const rooms = new Map<string, Room>();

function generateCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export function createRoom(hostId: string, hostName: string): Room {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();

  const room: Room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, isHost: true }],
    phase: "lobby",
    categories: [...DEFAULT_CATEGORIES],
    currentCategory: null,
    submissions: [],
    currentSongIndex: 0,
    round: 1,
    tiedPlayers: [],
    timeLimit: null,
    submissionDeadline: null,
    songDuration: null,
    screenMode: "shared",
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

export function joinRoom(code: string, playerId: string, playerName: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.players.length >= 8) return null;
  if (room.phase !== "lobby") return null;

  const exists = room.players.find((p) => p.id === playerId);
  if (!exists) {
    room.players.push({ id: playerId, name: playerName, isHost: false });
  }
  return room;
}

export function leaveRoom(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.id !== playerId);

  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }

  if (room.hostId === playerId && room.players.length > 0) {
    room.players[0].isHost = true;
    room.hostId = room.players[0].id;
  }

  return room;
}

export function setPhase(code: string, phase: GamePhase): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.phase = phase;
  return room;
}

export function setTimeLimit(code: string, limit: TimeLimit): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.timeLimit = limit;
  return room;
}

export function setSongDuration(code: string, duration: SongDuration): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.songDuration = duration;
  return room;
}

export function setScreenMode(code: string, mode: ScreenMode): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.screenMode = mode;
  return room;
}

export function setCategory(code: string, category: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.currentCategory = category;
  room.submissions = [];
  room.currentSongIndex = 0;
  room.submissionDeadline = room.timeLimit
    ? Date.now() + room.timeLimit * 60 * 1000
    : null;
  return room;
}

export function submitSong(
  code: string,
  playerId: string,
  youtubeUrl: string,
  title: string,
  startTime: number
): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return null;

  const existing = room.submissions.findIndex((s) => s.playerId === playerId);
  const submission: SongSubmission = {
    playerId,
    playerName: player.name,
    youtubeUrl,
    title,
    startTime: Math.max(0, startTime),
    votes: [],
  };

  if (existing >= 0) {
    room.submissions[existing] = submission;
  } else {
    room.submissions.push(submission);
  }

  return room;
}

export function castVote(code: string, voterId: string, songIndex: number, stars: number): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const song = room.submissions[songIndex];
  if (!song) return null;
  if (song.playerId === voterId) return room;

  song.votes.push(Math.min(5, Math.max(1, stars)));
  return room;
}

export function nextSong(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.currentSongIndex += 1;
  return room;
}

export function getResults(room: Room): { playerId: string; playerName: string; avg: number }[] {
  return room.submissions
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      avg: s.votes.length > 0 ? s.votes.reduce((a, b) => a + b, 0) / s.votes.length : 0,
    }))
    .sort((a, b) => b.avg - a.avg);
}

export function startTiebreaker(code: string, tiedPlayerIds: string[]): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.phase = "submitting";
  room.tiedPlayers = tiedPlayerIds;
  room.submissions = room.submissions.filter((s) => tiedPlayerIds.includes(s.playerId));
  room.submissionDeadline = room.timeLimit
    ? Date.now() + room.timeLimit * 60 * 1000
    : null;
  room.round += 1;
  return room;
}
