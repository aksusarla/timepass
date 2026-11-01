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
