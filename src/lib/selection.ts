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

/* ---------- Difficulty (Data Team rating: 1 easy, 2 medium, 3 hard) ---------- */

export type Level = "easy" | "medium" | "hard" | "mix";
export type Rated = Pickable & { difficulty?: number };
const LEVEL: Record<Exclude<Level, "mix">, number> = { easy: 1, medium: 2, hard: 3 };
// Unrated films are the big prototype hits, so they count as easy.
const rating = (m: Rated) => m.difficulty ?? 1;

/** n films at this rating; if there are not enough, the closest ratings fill in. */
function pickAtRating<T extends Rated>(pool: T[], n: number, target: number, seen: string[], used: Set<string>, rand: () => number): T[] {
  const out: T[] = [];
  for (let gap = 0; gap <= 2 && out.length < n; gap++) {
    const tier = pool.filter((m) => !used.has(m.id) && Math.abs(rating(m) - target) === gap);
    for (const m of pickDeck(tier, n - out.length, seen, rand)) {
      out.push(m);
      used.add(m.id);
    }
  }
  return out;
}

/**
 * Picks a game's films by difficulty. "mix" ramps up: about 40% easy, 40% medium
 * and 20% hard (at least one), played easy first so the game gets harder.
 */
export function pickByLevel<T extends Rated>(pool: T[], n: number, level: Level, seen: string[] = [], rand: () => number = Math.random): T[] {
  const used = new Set<string>();
  if (level !== "mix") return shuffleWith(pickAtRating(pool, n, LEVEL[level], seen, used, rand), rand);
  const hard = Math.max(1, Math.round(n * 0.2));
  const medium = Math.round(n * 0.4);
  const easy = n - medium - hard;
  return [
    ...shuffleWith(pickAtRating(pool, easy, 1, seen, used, rand), rand),
    ...shuffleWith(pickAtRating(pool, medium, 2, seen, used, rand), rand),
    ...shuffleWith(pickAtRating(pool, hard, 3, seen, used, rand), rand),
  ];
}
