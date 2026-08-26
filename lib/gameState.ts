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
export type RoundLimit = 1 | 3 | 5 | 10;

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  totalScore: number; // sum of this player's average score from each completed round
  roundsPlayed: number; // how many rounds totalScore has been accumulated over
  avatarUrl: string | null; // signed-in user's uploaded profile picture, if any
}

export interface SongSubmission {
  playerId: string;
  playerName: string;
  youtubeUrl: string;
  title: string;
  startTime: number; // seconds
  votes: Record<string, number>; // voterId -> stars — keyed so a re-vote replaces the voter's previous rating instead of adding a second one
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
  roundLimit: RoundLimit;
  roundNumber: number; // which round of roundLimit we're currently on / just finished
  gameOver: boolean; // true once roundNumber has reached roundLimit
  songStartedAt: number | null; // Date.now() the current song's countdown may start — null while still waiting (see resetSongReadiness)
  readyPlayerIds: string[]; // players whose own video has reported ready for the current song, in "everyone" screen mode
  skipVoterIds: string[]; // players who've voted to skip the current song — a majority (>50% of room.players) auto-advances it
}

// Each built-in category pairs a name with a description — the description
// is only ever flavor text (shown alongside the name wherever it's
// displayed, see getCategoryDescription below); the name alone is what's
// actually stored as room.categories / room.currentCategory. Custom
// user-created Wheels (see prisma/schema.prisma's Category model) don't
// carry a description at all, so getCategoryDescription just returns null
// for those — nothing renders instead of a description line, no special
// casing needed at the call sites.
const DEFAULT_CATEGORY_DATA: { name: string; description: string }[] = [
  { name: "walking into your own wedding", description: "the song you'd want playing for your entrance" },
  { name: "first dance but make it devastating", description: "your ideal wedding first-dance song" },
  { name: "driving home after the best night of your life", description: "that euphoric, slightly emotional comedown track" },
  { name: "the funeral song you already picked out", description: "dramatic enough to leave everyone emotionally ruined" },
  { name: "this altered my brain chemistry", description: "a song that permanently changed something in you" },
  { name: "romanticizing a train ride for no reason", description: "music that makes everyday life feel cinematic" },
  { name: "you just had to be there", description: "a song tied to a very specific era, trend or memory" },
  { name: "main character walking through the airport", description: "headphones on, suitcase rolling, life transition incoming" },
  { name: "the song playing when you finally move out", description: "freedom, nostalgia and mild existential crisis" },
  { name: "late-night drive with someone you're definitely not dating", description: "suspiciously intimate car-ride music" },
  { name: "summer holiday final night", description: "the song that plays when you know the trip is basically over" },
  { name: "house party bathroom breakdown", description: "emotional damage while everyone else is still having fun" },
  { name: "the afterparty is over and nobody wants to go home", description: "exhausted, dreamy, 4 AM energy" },
  { name: "seeing your ex looking suspiciously good", description: "immediate villain arc soundtrack" },
  { name: "accidentally falling in love with your best friend", description: "painfully specific yearning music" },
  { name: "first kiss in an indie movie", description: "a song that would make the scene unbearably cinematic" },
  { name: "getting ready while everyone is already waiting for you", description: "maximum confidence soundtrack" },
  { name: "walking into the club like rent is already paid", description: "pure aura and zero financial responsibility" },
  { name: "the song that would play during your villain reveal", description: "coldest possible character-development moment" },
  { name: "staring out the window after one minor inconvenience", description: "unnecessarily dramatic but completely justified" },
  { name: "graduation credits rolling", description: "the perfect ending song for one chapter of your life" },
  { name: "last day of school and suddenly everyone is sentimental", description: "nostalgia hitting way harder than expected" },
  { name: "moving to a city where nobody knows you", description: "reinvention-core" },
  { name: "meeting someone on holiday knowing you'll never see them again", description: "temporary romance, permanent playlist addition" },
  { name: "your situationship finally texts back", description: "song for the embarrassing amount of dopamine this causes" },
  { name: "the algorithm put me on before everyone else", description: "a track you're still pretending to gatekeep" },
  { name: "born to hear this live, forced to watch shaky concert clips", description: "the song you'd sell a kidney to experience live" },
  { name: "this would go insane in a 12-second edit", description: "a song with one absolutely lethal section" },
  { name: "the world is ending but the playlist is incredible", description: "apocalyptic final-scene soundtrack" },
  { name: "if I lose with this I'm leaving the room", description: "your absolute Song Battle emergency button" },
];

export const DEFAULT_CATEGORIES = DEFAULT_CATEGORY_DATA.map((c) => c.name);

const CATEGORY_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  DEFAULT_CATEGORY_DATA.map((c) => [c.name, c.description])
);

export function getCategoryDescription(category: string | null): string | null {
  if (!category) return null;
  return CATEGORY_DESCRIPTIONS[category] ?? null;
}

const rooms = new Map<string, Room>();

function generateCode(): string {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

export function createRoom(hostId: string, hostName: string, avatarUrl: string | null = null): Room {
  let code = generateCode();
  while (rooms.has(code)) code = generateCode();

  const room: Room = {
    code,
    hostId,
    players: [{ id: hostId, name: hostName, isHost: true, totalScore: 0, roundsPlayed: 0, avatarUrl }],
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
    roundLimit: 3,
    roundNumber: 1,
    gameOver: false,
    songStartedAt: null,
    readyPlayerIds: [],
    skipVoterIds: [],
  };

  rooms.set(code, room);
  return room;
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}

// Explicit removal for cases outside the normal "last player leaves" path —
// e.g. server.ts's inactivity sweep, closing a room nobody's touched in a
// while regardless of whether anyone's still (silently) connected to it.
export function deleteRoom(code: string): void {
  rooms.delete(code);
}

export function joinRoom(code: string, playerId: string, playerName: string, avatarUrl: string | null = null): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const existingById = room.players.find((p) => p.id === playerId);
  if (existingById) return room;

  // A dropped connection (network blip, backgrounded mobile tab, etc.) comes
  // back with a brand-new socket id — Socket.io doesn't preserve the old one.
  // Recognize the same person by name and reclaim their existing slot rather
  // than treating them as a new join, so a real reconnect works at any phase
  // of the game, not just in the lobby.
  const trimmedName = playerName.trim();
  const existingByName = room.players.find(
    (p) => p.name.toLowerCase() === trimmedName.toLowerCase()
  );
  if (existingByName) {
    const oldId = existingByName.id;
    const wasHost = existingByName.isHost;
    existingByName.id = playerId;
    existingByName.avatarUrl = avatarUrl;
    if (wasHost) room.hostId = playerId;
    // Re-key this player's own submission and any vote they'd already cast
    // from their old socket id to the new one — otherwise `isMyOwnSong`-style
    // checks on the client break after a reconnect (their own song looks
    // like someone else's), and a re-vote would look like a second voter
    // instead of overwriting their earlier one.
    for (const sub of room.submissions) {
      if (sub.playerId === oldId) sub.playerId = playerId;
      if (oldId in sub.votes) {
        sub.votes[playerId] = sub.votes[oldId];
        delete sub.votes[oldId];
      }
    }
    return room;
  }

  // Brand-new player — only allowed to join while the room is still in the lobby.
  if (room.phase !== "lobby") return null;
  if (room.players.length >= 8) return null;
  room.players.push({ id: playerId, name: playerName, isHost: false, totalScore: 0, roundsPlayed: 0, avatarUrl });
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

export function setRoundLimit(code: string, limit: RoundLimit): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.roundLimit = limit;
  // Re-derive gameOver against the new limit — e.g. the host raising the
  // limit after finishing what used to be the last round should let the
  // game continue instead of staying stuck on a stale "over" flag.
  room.gameOver = room.roundNumber >= room.roundLimit;
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
    votes: {},
  };

  if (existing >= 0) {
    room.submissions[existing] = submission;
  } else {
    room.submissions.push(submission);
  }

  return room;
}

// Keyed by voterId so casting again for the same song just overwrites the
// previous rating — lets a voter freely change their mind while the song is
// still playing instead of stacking up multiple votes toward the average.
export function castVote(code: string, voterId: string, songIndex: number, stars: number): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  const song = room.submissions[songIndex];
  if (!song) return null;
  if (song.playerId === voterId) return room;

  song.votes[voterId] = Math.min(5, Math.max(1, stars));
  return room;
}

export function nextSong(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.currentSongIndex += 1;
  return room;
}

// Clears per-song "is this player's video ready" tracking, the shared
// countdown's start timestamp, and skip votes — called by server.ts every
// time a new song enters the "playing" phase, before it decides (based on
// screenMode) whether the countdown can start immediately or has to wait.
export function resetSongReadiness(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.readyPlayerIds = [];
  room.songStartedAt = null;
  room.skipVoterIds = [];
  return room;
}

export function castSkipVote(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (!room.skipVoterIds.includes(playerId)) room.skipVoterIds.push(playerId);
  return room;
}

export function markPlayerReady(code: string, playerId: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (!room.readyPlayerIds.includes(playerId)) room.readyPlayerIds.push(playerId);
  return room;
}

export function setSongStartedAt(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.songStartedAt = Date.now();
  return room;
}

export function avgVotes(votes: Record<string, number>): number {
  const values = Object.values(votes);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

export function getResults(room: Room): { playerId: string; playerName: string; avg: number }[] {
  return room.submissions
    .map((s) => ({
      playerId: s.playerId,
      playerName: s.playerName,
      avg: avgVotes(s.votes),
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

// Folds this round's per-song scores into each submitting player's running
// total, so the results screen can show a cumulative leaderboard across
// rounds (not just who won this one song). Tiebreaker resolutions reuse the
// same submitting -> playing -> results flow but keep room.tiedPlayers set,
// so callers should only invoke this for the original (non-tiebreaker) pass
// to avoid folding the same round's scores in twice.
export function finalizeRound(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;

  for (const submission of room.submissions) {
    const player = room.players.find((p) => p.id === submission.playerId);
    if (!player) continue;
    const avg = avgVotes(submission.votes);
    player.totalScore += avg;
    player.roundsPlayed += 1;
  }

  room.gameOver = room.roundNumber >= room.roundLimit;
  return room;
}

export function getLeaderboard(room: Room): { playerId: string; playerName: string; avg: number; roundsPlayed: number }[] {
  return room.players
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      avg: p.roundsPlayed > 0 ? p.totalScore / p.roundsPlayed : 0,
      roundsPlayed: p.roundsPlayed,
    }))
    .sort((a, b) => b.avg - a.avg);
}

export function advanceRound(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.gameOver) return room;
  room.phase = "spinning";
  room.currentCategory = null;
  room.submissions = [];
  room.currentSongIndex = 0;
  room.tiedPlayers = [];
  room.submissionDeadline = null;
  room.roundNumber += 1;
  room.songStartedAt = null;
  room.readyPlayerIds = [];
  room.skipVoterIds = [];
  return room;
}

export function restartGame(code: string): Room | null {
  const room = rooms.get(code);
  if (!room) return null;
  room.phase = "lobby";
  room.currentCategory = null;
  room.submissions = [];
  room.currentSongIndex = 0;
  room.tiedPlayers = [];
  room.submissionDeadline = null;
  room.roundNumber = 1;
  room.gameOver = false;
  room.songStartedAt = null;
  room.readyPlayerIds = [];
  room.skipVoterIds = [];
  for (const p of room.players) {
    p.totalScore = 0;
    p.roundsPlayed = 0;
  }
  return room;
}
