// Online rooms: the rules engine the room server runs (rooms/worker.ts).
// Pure functions over plain data, no timers or I/O, so `node --test` covers it
// and the same file is bundled into the Cloudflare Worker.
//
// Online Movie Guess (Teams), PRD 6.1 + 7:
//   lobby: players join with a nickname and pick a team; the host sets the
//          language pool, rounds and team names, then starts.
//   clue:  every phone sees the same clue ladder (story, director, heroine,
//          hero) and timer. Anyone can guess for their team. A wrong guess
//          locks that team until the next clue. First correct guess wins the
//          round for the team, worth 4/3/2/1 by clue.
//   reveal: everyone sees the answer; the host starts the next round.
//   over:  final scores; the host can play again with the same players.
// The answer never leaves the server before the reveal (PRD 10, fairness).
import { isCorrectGuess } from "./game.ts";
import { pickDeck, remember } from "./selection.ts";

export const CLUES = [
  { key: "storyline", label: "The story", pts: 4 },
  { key: "director", label: "Director", pts: 3 },
  { key: "heroine", label: "Heroine", pts: 2 },
  { key: "hero", label: "Hero", pts: 1 },
] as const;
export const CLUE_MS = 30_000; // longer than same-room (20 s): everyone types on their own phone
export const MAX_PLAYERS = 12;
export const MAX_TEAMS = 6;
export const HOST_AWAY_MS = 60_000; // after this, another player may take over as host (R-7)
export const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // R-8: rooms expire 24 h after the last activity
export const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I or O (look like 1 and 0)

export type Pool = "te" | "ta" | "both";
export type Puzzle = {
  id: string;
  lang: string;
  title: string;
  aliases: string[];
  year: number;
  storyline: string;
  hero: string;
  heroine: string;
  director: string;
};
export type Player = { id: string; name: string; team: number; joinedAt: number; connected: boolean; awaySince?: number };
export type Guess = { team: number; player: string; title: string; correct: boolean; clue: number };
export type Result = { movieId: string; team: number | null; points: number; by?: string };
export type Phase = "lobby" | "clue" | "reveal" | "over";

export type RoomState = {
  v: 1;
  code: string;
  game: "movie-guess";
  hostId: string | null;
  createdAt: number;
  lastActive: number;
  players: Player[];
  teams: string[];
  pool: Pool;
  rounds: number;
  phase: Phase;
  deck: string[];
  round: number;
  clue: number;
  clueEndsAt: number | null;
  locked: number[]; // teams locked out for the current clue
  guesses: Guess[]; // current round only
  results: Result[];
  seen: string[]; // films this room has played, so "play again" avoids repeats
};

export type Action =
  | { type: "join"; name: string }
  | { type: "setTeam"; team: number }
  | { type: "configure"; pool?: Pool; rounds?: number; teams?: string[] }
  | { type: "kick"; target: string }
  | { type: "start" }
  | { type: "guess"; title: string }
  | { type: "nextClue" }
  | { type: "reveal" }
  | { type: "nextRound" }
  | { type: "end" }
  | { type: "playAgain" }
  | { type: "claimHost" };

/** What one phone is allowed to see. */
export type RoomView = {
  code: string;
  serverNow: number;
  me: { id: string; name: string; team: number; isHost: boolean } | null;
  hostAway: boolean;
  players: { id: string; name: string; team: number; connected: boolean; isHost: boolean }[];
  teams: { name: string; score: number; size: number }[];
  pool: Pool;
  rounds: number;
  phase: Phase;
  round: number;
  totalRounds: number;
  clue: number;
  clueEndsAt: number | null;
  clues: { label: string; value: string; pts: number }[];
  locked: number[];
  guesses: Guess[];
  answer: { title: string; year: number } | null;
  last: Result | null;
  history: { title: string; team: number | null; points: number }[];
};

export type Outcome = { state: RoomState; error?: string };

export function newRoom(code: string, now: number): RoomState {
  return {
    v: 1,
    code,
    game: "movie-guess",
    hostId: null,
    createdAt: now,
    lastActive: now,
    players: [],
    teams: ["Team A", "Team B"],
    pool: "both",
    rounds: 5,
    phase: "lobby",
    deck: [],
    round: 0,
    clue: 0,
    clueEndsAt: null,
    locked: [],
    guesses: [],
    results: [],
    seen: [],
  };
}

export function randomCode(rand: () => number = Math.random, length = 4): string {
  let s = "";
  for (let i = 0; i < length; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)];
  return s;
}

const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const fail = (state: RoomState, error: string): Outcome => ({ state, error });
const teamSizes = (s: RoomState) => s.teams.map((_, t) => s.players.filter((p) => p.team === t).length);
const smallestTeam = (s: RoomState) => {
  const sizes = teamSizes(s);
  return sizes.indexOf(Math.min(...sizes));
};
const HOST_ONLY = new Set<Action["type"]>(["configure", "kick", "start", "nextClue", "reveal", "nextRound", "end", "playAgain"]);

/**
 * Applies one player's action. `puzzles` is the room's playable films (needed
 * to start, check guesses and reveal). Returns the new state, or the old one
 * with an error message for that player.
 */
export function apply(prev: RoomState, by: string, action: Action, now: number, puzzles: Puzzle[]): Outcome {
  const s: RoomState = structuredClone(prev);
  s.lastActive = now;
  const me = s.players.find((p) => p.id === by);

  if (action.type === "join") {
    const name = clean(action.name ?? "");
    if ([...name].length < 2 || [...name].length > 16) return fail(prev, "Pick a name with 2 to 16 letters.");
    const taken = s.players.find((p) => p.id !== by && p.name.toLowerCase() === name.toLowerCase());
    if (taken) return fail(prev, `Someone here is already called ${taken.name}. Try another name.`);
    if (me) {
      me.name = name;
      me.connected = true;
      delete me.awaySince;
    } else {
      if (s.players.length >= MAX_PLAYERS) return fail(prev, "This room is full (12 players).");
      s.players.push({ id: by, name, team: smallestTeam(s), joinedAt: now, connected: true });
    }
    if (!s.hostId) s.hostId = by;
    return { state: s };
  }

  if (!me) return fail(prev, "Join the room first.");
  if (action.type === "claimHost") {
    const host = s.players.find((p) => p.id === s.hostId);
    if (host && (host.connected || now - (host.awaySince ?? now) < HOST_AWAY_MS)) return fail(prev, "The host is still here.");
    s.hostId = by;
    return { state: s };
  }
  if (HOST_ONLY.has(action.type) && s.hostId !== by) return fail(prev, "Only the host can do that.");

  switch (action.type) {
    case "setTeam": {
      if (s.phase !== "lobby") return fail(prev, "Teams are fixed once the game starts.");
      if (!Number.isInteger(action.team) || action.team < 0 || action.team >= s.teams.length) return fail(prev, "No such team.");
      me.team = action.team;
      return { state: s };
    }
    case "configure": {
      if (s.phase !== "lobby") return fail(prev, "Change settings before the game starts.");
      if (action.pool) {
        if (!["te", "ta", "both"].includes(action.pool)) return fail(prev, "Unknown language pool.");
        s.pool = action.pool;
      }
      if (action.rounds !== undefined) {
        if (![5, 10, 15].includes(action.rounds)) return fail(prev, "Rounds must be 5, 10 or 15.");
        s.rounds = action.rounds;
      }
      if (action.teams) {
        const names = action.teams.map(clean).filter(Boolean).map((n) => [...n].slice(0, 20).join(""));
        if (names.length < 2 || names.length > MAX_TEAMS) return fail(prev, "Have 2 to 6 teams.");
        if (new Set(names.map((n) => n.toLowerCase())).size !== names.length) return fail(prev, "Team names must be different.");
        s.teams = names;
        for (const p of s.players) if (p.team >= names.length) p.team = smallestTeam(s);
      }
      return { state: s };
    }
    case "kick": {
      if (action.target === by) return fail(prev, "You can't remove yourself.");
      s.players = s.players.filter((p) => p.id !== action.target);
      return { state: s };
    }
    case "start": {
      if (s.phase !== "lobby") return fail(prev, "The game has already started.");
      const filled = teamSizes(s).filter((n) => n > 0).length;
      if (filled < 2) return fail(prev, "Put players in at least 2 teams to start.");
      const pool = poolFor(puzzles, s.pool);
      if (pool.length === 0) return fail(prev, "No films are available for this language yet.");
      s.deck = pickDeck(pool, Math.min(s.rounds, pool.length), s.seen).map((m) => m.id);
      s.seen = remember(s.seen, s.deck);
      s.results = [];
      s.round = 0;
      startClue(s, 0, now);
      return { state: s };
    }
    case "guess": {
      if (s.phase !== "clue") return fail(prev, "Wait for the next clue.");
      if (s.locked.includes(me.team)) return fail(prev, "Your team already guessed on this clue. Wait for the next one.");
      const title = clean(action.title ?? "").slice(0, 120);
      if (!title) return fail(prev, "Type a movie name.");
      const movie = puzzleById(puzzles, s.deck[s.round]);
      if (!movie) return fail(prev, "This round's film is missing. The host can skip it.");
      const correct = isCorrectGuess(title, movie);
      s.guesses.push({ team: me.team, player: me.name, title, correct, clue: s.clue });
      if (correct) {
        finishRound(s, me.team, CLUES[s.clue].pts, me.name);
      } else {
        s.locked.push(me.team);
        const playing = new Set(s.players.map((p) => p.team));
        if ([...playing].every((t) => s.locked.includes(t))) advanceClue(s, now);
      }
      return { state: s };
    }
    case "nextClue": {
      if (s.phase !== "clue") return fail(prev, "No clue is showing.");
      advanceClue(s, now);
      return { state: s };
    }
    case "reveal": {
      if (s.phase !== "clue") return fail(prev, "No clue is showing.");
      finishRound(s, null, 0);
      return { state: s };
    }
    case "nextRound": {
      if (s.phase !== "reveal") return fail(prev, "Reveal this round first.");
      if (s.round + 1 >= s.deck.length) {
        s.phase = "over";
        s.clueEndsAt = null;
      } else startClue(s, s.round + 1, now);
      return { state: s };
    }
    case "end": {
      if (s.phase === "clue") finishRound(s, null, 0);
      s.phase = "over";
      s.clueEndsAt = null;
      return { state: s };
    }
    case "playAgain": {
      if (s.phase !== "over") return fail(prev, "Finish this game first.");
      s.phase = "lobby";
      s.deck = [];
      s.results = [];
      s.guesses = [];
      s.round = 0;
      s.clue = 0;
      return { state: s };
    }
  }
  return fail(prev, "Unknown action.");
}

/** Called by the server's alarm: moves on when a clue's time is up. */
export function tick(prev: RoomState, now: number): RoomState {
  if (prev.phase !== "clue" || prev.clueEndsAt === null || prev.clueEndsAt > now) return prev;
  const s = structuredClone(prev);
  advanceClue(s, now);
  return s;
}

/** Marks a phone as connected or gone (for rejoin and host handover). */
export function setConnected(prev: RoomState, id: string, connected: boolean, now: number): RoomState {
  const s = structuredClone(prev);
  const p = s.players.find((x) => x.id === id);
  if (!p) return prev;
  p.connected = connected;
  if (connected) delete p.awaySince;
  else p.awaySince = now;
  return s;
}

/** When the server should wake up next: the clue timer, or room expiry. */
export function nextWake(s: RoomState): number {
  const expiry = s.lastActive + ROOM_TTL_MS;
  return s.phase === "clue" && s.clueEndsAt !== null ? Math.min(s.clueEndsAt, expiry) : expiry;
}

export const isExpired = (s: RoomState, now: number) => now - s.lastActive >= ROOM_TTL_MS;

export function view(s: RoomState, viewer: string, now: number, puzzles: Puzzle[]): RoomView {
  const p = s.players.find((x) => x.id === viewer);
  const host = s.players.find((x) => x.id === s.hostId);
  const movie = s.phase === "lobby" ? undefined : puzzleById(puzzles, s.deck[s.round]);
  const shown = s.phase === "clue" ? s.clue : s.phase === "reveal" || s.phase === "over" ? CLUES.length - 1 : -1;
  const scores = s.teams.map((_, t) => s.results.filter((r) => r.team === t).reduce((a, r) => a + r.points, 0));
  const revealed = s.phase === "reveal" || s.phase === "over";
  return {
    code: s.code,
    serverNow: now,
    me: p ? { id: p.id, name: p.name, team: p.team, isHost: p.id === s.hostId } : null,
    hostAway: !!host && !host.connected && now - (host.awaySince ?? now) >= HOST_AWAY_MS,
    players: s.players.map((x) => ({ id: x.id, name: x.name, team: x.team, connected: x.connected, isHost: x.id === s.hostId })),
    teams: s.teams.map((name, t) => ({ name, score: scores[t], size: s.players.filter((x) => x.team === t).length })),
    pool: s.pool,
    rounds: s.rounds,
    phase: s.phase,
    round: s.round,
    totalRounds: s.deck.length || s.rounds,
    clue: s.clue,
    clueEndsAt: s.clueEndsAt,
    clues: movie && shown >= 0 ? CLUES.slice(0, shown + 1).map((c) => ({ label: c.label, value: movie[c.key] || "None", pts: c.pts })) : [],
    locked: s.locked,
    guesses: s.guesses,
    // The answer only once the round is over (never before the reveal).
    answer: movie && revealed && s.phase !== "over" ? { title: movie.title, year: movie.year } : null,
    last: revealed ? (s.results[s.results.length - 1] ?? null) : null,
    history: s.results.map((r) => ({ title: puzzleById(puzzles, r.movieId)?.title ?? "?", team: r.team, points: r.points })),
  };
}

export function poolFor(puzzles: Puzzle[], pool: Pool): Puzzle[] {
  return pool === "both" ? puzzles : puzzles.filter((m) => m.lang === pool);
}
const puzzleById = (puzzles: Puzzle[], id: string | undefined) => puzzles.find((m) => m.id === id);

function startClue(s: RoomState, round: number, now: number) {
  s.phase = "clue";
  s.round = round;
  s.clue = 0;
  s.locked = [];
  s.guesses = [];
  s.clueEndsAt = now + CLUE_MS;
}

function advanceClue(s: RoomState, now: number) {
  if (s.clue < CLUES.length - 1) {
    s.clue += 1;
    s.locked = [];
    s.clueEndsAt = now + CLUE_MS;
  } else finishRound(s, null, 0);
}

function finishRound(s: RoomState, team: number | null, points: number, by?: string) {
  s.phase = "reveal";
  s.clueEndsAt = null;
  s.results.push({ movieId: s.deck[s.round], team, points, ...(by ? { by } : {}) });
}
