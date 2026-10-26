// Pure date + puzzle-selection helpers. No imports, so `node --test` can run
// the tests in daily.test.ts directly.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Day 1 of the daily game. Every language advances one puzzle per day from
// here, switching at midnight IST. Change only before launch.
export const LAUNCH_DATE = "2026-11-01";

/** Today's date in India as "YYYY-MM-DD". India has no daylight saving. */
export function istDateString(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Whole days from a to b, both "YYYY-MM-DD". */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);
}

export function previousDate(date: string): string {
  return new Date(Date.parse(date) - DAY_MS).toISOString().slice(0, 10);
}

/**
 * Which puzzle to show on a given IST date. Before launch it shows puzzle 1
 * (handy for testing). After the pool runs out it loops; add content before
 * that happens.
 */
export function puzzleIndexFor(date: string, poolSize: number): number {
  if (poolSize <= 0) throw new Error("Puzzle pool is empty");
  const day = Math.max(0, daysBetween(LAUNCH_DATE, date));
  return day % poolSize;
}

/** Public puzzle number, e.g. "#12" in share text. Starts at 1 on launch day. */
export function puzzleNumberFor(date: string): number {
  return Math.max(0, daysBetween(LAUNCH_DATE, date)) + 1;
}

/** Lowercase, drop punctuation and spaces, keep letters/digits in any script. */
export function normalizeTitle(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function isCorrectGuess(
  guess: string,
  answer: { title: string; aliases: string[] },
): boolean {
  const g = normalizeTitle(guess);
  if (!g) return false;
  return [answer.title, ...answer.aliases].some((t) => normalizeTitle(t) === g);
}
