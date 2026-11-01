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

/**
 * Up to `limit` titles matching the query, after 2 characters. A title also
 * matches through its alternative spellings in `aliases` (title -> spellings).
 */
export function suggest(
  query: string,
  titles: string[],
  limit = 5,
  aliases: Record<string, string[]> = {},
): string[] {
  const q = normalizeTitle(query);
  if (q.length < 2) return [];
  const keys = (t: string) => [t, ...(aliases[t] ?? [])].map(normalizeTitle);
  const starts = titles.filter((t) => keys(t).some((k) => k.startsWith(q)));
  const contains = titles.filter((t) => !starts.includes(t) && keys(t).some((k) => k.includes(q)));
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

/* ---------- Fast title search over thousands of films ---------- */

/** [title, year, alternative spellings?] as stored in search-<lang>.json, most famous first. */
export type SearchRow = [string, number, string[]?];

export type SearchIndex = {
  titles: string[];
  years: number[];
  keys: string[][]; // normalized title + spellings, computed once
};

export function buildIndex(rows: SearchRow[]): SearchIndex {
  const seen = new Set<string>();
  const index: SearchIndex = { titles: [], years: [], keys: [] };
  for (const [title, year, alts] of rows) {
    const k = normalizeTitle(title);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    index.titles.push(title);
    index.years.push(year);
    index.keys.push([k, ...(alts ?? []).map(normalizeTitle).filter(Boolean)]);
  }
  return index;
}

/**
 * Up to `limit` matches after 2 characters: titles that start with the query
 * first, then ones containing it, each in fame order. `exclude` hides titles
 * (e.g. wrong guesses already made this round).
 */
export function searchTitles(
  query: string,
  index: SearchIndex,
  limit = 5,
  exclude: ReadonlySet<string> = new Set(),
): { title: string; year: number }[] {
  const q = normalizeTitle(query);
  if (q.length < 2) return [];
  const starts: number[] = [];
  const contains: number[] = [];
  for (let i = 0; i < index.titles.length && starts.length < limit; i++) {
    if (exclude.has(index.titles[i])) continue;
    const ks = index.keys[i];
    if (ks.some((k) => k.startsWith(q))) starts.push(i);
    else if (contains.length < limit && ks.some((k) => k.includes(q))) contains.push(i);
  }
  return [...starts, ...contains].slice(0, limit).map((i) => ({ title: index.titles[i], year: index.years[i] }));
}
