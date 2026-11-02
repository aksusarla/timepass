// Which films a game gets. Today: random, never repeating a film this device
// has already played until every film in the chosen languages has been seen.
//
// This is the single place where film selection happens, so later strategies
// (difficulty mix, fresh releases, what a group skips or guesses fastest) can
// replace or wrap `pickDeck` without touching the game screens.

export type Pickable = { id: string };

/**
 * Picks `n` films at random. Films not in `seen` come first; if there are not
 * enough, the ones seen longest ago fill the gap. `seen` is oldest first.
 */
export function pickDeck<T extends Pickable>(
  pool: T[],
  n: number,
  seen: string[] = [],
  rand: () => number = Math.random,
): T[] {
  const lastSeen = new Map(seen.map((id, i) => [id, i]));
  const shuffled = shuffleWith(pool, rand);
  const fresh = shuffled.filter((m) => !lastSeen.has(m.id));
  const old = shuffled.filter((m) => lastSeen.has(m.id)).sort((a, b) => lastSeen.get(a.id)! - lastSeen.get(b.id)!);
  return shuffleWith([...fresh, ...old].slice(0, n), rand);
}

/** Adds played ids to the history (oldest first), dropping repeats and capping its length. */
export function remember(seen: string[], played: string[], cap = 2000): string[] {
  const playedSet = new Set(played);
  return [...seen.filter((id) => !playedSet.has(id)), ...played].slice(-cap);
}

function shuffleWith<T>(items: T[], rand: () => number): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Difficulty that follows the room (Data Team rating: 1 easy, 2 medium, 3 hard) ---------- */

export type Rated = Pickable & { difficulty?: number };
export const START_LEVEL = 2; // every game opens at medium
// Unrated films are the big prototype hits, so they count as easy.
const rating = (m: Rated) => m.difficulty ?? 1;

/**
 * The next film's difficulty from how the last round went: guessed on the
 * first or second clue (3-4 points) goes harder, nobody got it goes easier,
 * anything in between stays.
 */
export function nextLevel(level: number, points: number): number {
  const next = points >= 3 ? level + 1 : points === 0 ? level - 1 : level;
  return Math.min(3, Math.max(1, next));
}

/**
 * One film at this difficulty that this device has not played and that is not
 * already in the game. If none is left at that level, the closest level is used;
 * only when every film has been seen does the one seen longest ago come back.
 */
export function pickNext<T extends Rated>(pool: T[], level: number, seen: string[], exclude: string[] = [], rand: () => number = Math.random): T | undefined {
  const out = new Set(exclude);
  const open = pool.filter((m) => !out.has(m.id));
  for (let gap = 0; gap <= 2; gap++) {
    const tier = open.filter((m) => Math.abs(rating(m) - level) === gap);
    const fresh = pickDeck(tier, 1, seen, rand)[0];
    if (fresh && !seen.includes(fresh.id)) return fresh;
  }
  // Every film has been played on this device: reuse the one seen longest ago,
  // preferring the right level.
  return pickDeck(open.filter((m) => rating(m) === level), 1, seen, rand)[0] ?? pickDeck(open, 1, seen, rand)[0];
}
