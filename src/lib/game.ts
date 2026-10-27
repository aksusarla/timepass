// Pure helpers for matching typed movie titles and running rounds. No imports,
// so `node --test` runs game.test.ts directly.
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

/** Up to `limit` titles containing the query, after 2 characters. */
export function suggest(query: string, titles: string[], limit = 5): string[] {
  const q = normalizeTitle(query);
  if (q.length < 2) return [];
  const starts = titles.filter((t) => normalizeTitle(t).startsWith(q));
  const contains = titles.filter((t) => !starts.includes(t) && normalizeTitle(t).includes(q));
  return [...starts, ...contains].slice(0, limit);
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Imposter Movie setup (PRD section 8, steps 2 and edge cases).
 * submissions[i] is player i's movie. Returns the real movie and imposter
 * index, or null if every player submitted the same movie (no valid imposter).
 */
export function pickImposterRound(
  submissions: string[],
  rand: () => number = Math.random,
): { realMovie: string; ownerIdx: number; imposterIdx: number } | null {
  const key = submissions.map(normalizeTitle);
  const unique = Array.from(new Set(key));
  const realKey = unique[Math.floor(rand() * unique.length)];
  const ownerIdx = key.indexOf(realKey);
  // Imposter must not be anyone whose own submission is the real movie.
  const candidates = key.map((k, i) => (k === realKey ? -1 : i)).filter((i) => i >= 0);
  if (candidates.length === 0) return null;
  const imposterIdx = candidates[Math.floor(rand() * candidates.length)];
  return { realMovie: submissions[ownerIdx], ownerIdx, imposterIdx };
}
