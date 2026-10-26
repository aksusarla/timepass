// Player progress lives in the browser (localStorage) until we add logins.
// Every access is wrapped: private mode or blocked storage must never break
// the game.

import { previousDate } from "./daily";

export type GameStatus = "playing" | "won" | "lost";

export type DayState = {
  date: string; // IST date this state belongs to
  puzzleId: string;
  guesses: string[]; // "" means the player skipped that clue
  status: GameStatus;
};

export type Stats = {
  played: number;
  won: number;
  currentStreak: number;
  maxStreak: number;
  distribution: number[]; // wins on guess 1..6
  lastCompletedDate: string | null;
};

export const EMPTY_STATS: Stats = {
  played: 0,
  won: 0,
  currentStreak: 0,
  maxStreak: 0,
  distribution: [0, 0, 0, 0, 0, 0],
  lastCompletedDate: null,
};

const dayKey = (lang: string) => `timepass:cinema:${lang}:day`;
const statsKey = (lang: string) => `timepass:cinema:${lang}:stats`;

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: game still works for this visit.
  }
}

export function loadDayState(
  lang: string,
  date: string,
  puzzleId: string,
): DayState {
  const saved = read<DayState>(dayKey(lang));
  if (saved && saved.date === date && saved.puzzleId === puzzleId) return saved;
  return { date, puzzleId, guesses: [], status: "playing" };
}

export function saveDayState(lang: string, state: DayState) {
  write(dayKey(lang), state);
}

export function loadStats(lang: string): Stats {
  return { ...EMPTY_STATS, ...(read<Stats>(statsKey(lang)) ?? {}) };
}

/** Call once when a day's game finishes. Returns the updated stats. */
export function recordResult(
  lang: string,
  date: string,
  won: boolean,
  guessCount: number,
): Stats {
  const s = loadStats(lang);
  if (s.lastCompletedDate === date) return s; // already counted today

  const continues = s.lastCompletedDate === previousDate(date);
  const distribution = [...s.distribution];
  if (won) distribution[guessCount - 1] = (distribution[guessCount - 1] ?? 0) + 1;

  const currentStreak = won ? (continues ? s.currentStreak + 1 : 1) : 0;
  const next: Stats = {
    played: s.played + 1,
    won: s.won + (won ? 1 : 0),
    currentStreak,
    maxStreak: Math.max(s.maxStreak, currentStreak),
    distribution,
    lastCompletedDate: date,
  };
  write(statsKey(lang), next);
  return next;
}
