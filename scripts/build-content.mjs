// Content compiler. Runs before every dev start and build (and in CI).
//
//   data/  (CSV snapshots synced from the Data Team's Google Sheets)
//     content-bank/movies.csv   one row per puzzle film (Movies tab)
//     raw/films_<lang>.csv      Wikidata film list (search + decoys)
//     raw/tiering.csv           fame scores used to rank search results
//            |
//            v  validate, filter by status, compact
//   src/content/generated/      (git-ignored, rebuilt every time)
//     index.ts                  languages, counts, lazy loaders
//     puzzles-<lang>.json       playable films for Movie Guess
//     search-<lang>.json        every known title, most famous first
//
// The site downloads one small file per language only when a game needs it.
// Errors stop the build (so a bad sheet edit never reaches players);
// warnings are printed for the Data Team.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readTable } from "./lib/csv.mjs";

const ROOT = process.cwd();
const OUT = join(ROOT, "src/content/generated");
const cfg = JSON.parse(readFileSync(join(ROOT, "content.config.json"), "utf8"));
const statuses = new Set((process.env.CONTENT_STATUSES?.split(",") ?? cfg.publishStatuses).map((s) => s.trim()));
const quiet = process.argv.includes("--quiet");

const errors = [];
const warnings = [];
const norm = (s) =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]/gu, "");
const list = (s) =>
  String(s ?? "")
    .split(/;|\|/)
    .map((x) => x.trim())
    .filter(Boolean);
const read = (p) => (existsSync(join(ROOT, p)) ? readTable(readFileSync(join(ROOT, p), "utf8")) : null);

/* ---------- Movies tab → puzzles ---------- */

const REQUIRED = ["movie_code", "language", "status", "title_roman", "year", "hero", "director", "storyline_en"];
const STATUS_VALUES = new Set(["draft", "in review", "verified", "retired"]);
const movies = read("data/content-bank/movies.csv");
if (!movies) errors.push("data/content-bank/movies.csv is missing");

const langCodes = new Set(cfg.languages.map((l) => l.code));
const seenCodes = new Set();
const seenLegacy = new Set();
const puzzles = Object.fromEntries(cfg.languages.map((l) => [l.code, []]));
const statusCount = {};

for (const [i, m] of (movies ?? []).entries()) {
  const at = `Movies row ${i + 2} (${m.movie_code || "no code"})`;
  const status = m.status.toLowerCase();
  statusCount[status] = (statusCount[status] ?? 0) + 1;
  if (!STATUS_VALUES.has(status)) errors.push(`${at}: status "${m.status}" must be draft, in review, verified or retired`);
  if (!/^[a-z]{2}-\d{4}$/.test(m.movie_code)) errors.push(`${at}: movie_code must look like te-0001`);
  if (seenCodes.has(m.movie_code)) errors.push(`${at}: movie_code used twice`);
  seenCodes.add(m.movie_code);
  if (!langCodes.has(m.language)) {
    warnings.push(`${at}: language "${m.language}" is not set up in content.config.json; skipped`);
    continue;
  }
  if (!m.movie_code.startsWith(`${m.language}-`)) errors.push(`${at}: code must start with "${m.language}-"`);
  if (m.legacy_id) {
    if (seenLegacy.has(m.legacy_id)) errors.push(`${at}: legacy_id used twice`);
    seenLegacy.add(m.legacy_id);
  }
  if (status === "retired" || !statuses.has(status)) continue;

  // Only rows that will reach players must be complete.
  for (const f of REQUIRED) if (!m[f]) errors.push(`${at}: ${f} is empty`);
  const year = Number(m.year);
  if (!Number.isInteger(year) || year < 1913 || year > 2030) errors.push(`${at}: year "${m.year}" is not a valid year`);
  const story = m.storyline_en;
  const titleKey = norm(m.title_roman);
  if (titleKey.length > 2 && norm(story).includes(titleKey)) errors.push(`${at}: storyline mentions the title`);
  const words = story.split(/\s+/).filter(Boolean).length;
  if (words > cfg.storylineMaxWords) warnings.push(`${at}: storyline is ${words} words (guide says 20 to 30)`);
  if (status === "verified" && (!m.verified_by || !m.verified_on)) errors.push(`${at}: verified rows need verified_by and verified_on`);
  if (status === "verified" && !m.source_url) warnings.push(`${at}: verified row has no source_url`);
  if (!m.heroine) warnings.push(`${at}: heroine is empty (the heroine clue will show "None")`);
  const difficulty = Number(m.difficulty);

  puzzles[m.language].push({
    id: m.movie_code,
    legacy: m.legacy_id || undefined,
    lang: m.language,
    status,
    title: m.title_roman,
    titleNative: m.title_native || undefined,
    aliases: list(m.aliases),
    year,
    genre: m.genre,
    storyline: story,
    storylineNative: m.storyline_native || undefined,
    hero: m.hero,
    heroine: m.heroine || "None",
    director: m.director,
    music: m.music_director || undefined,
    difficulty: [1, 2, 3].includes(difficulty) ? difficulty : undefined,
    familySafe: m.family_safe ? m.family_safe.toLowerCase() !== "no" : true,
  });
}

/* ---------- Raw Wikidata lists + tiering → search index ---------- */

const tiering = read("data/raw/tiering.csv") ?? [];
const fameById = new Map(tiering.filter((t) => t.wikidata_id).map((t) => [t.wikidata_id, Number(t.score) || 0]));

const search = {};
for (const lang of cfg.languages) {
  const raw = read(lang.raw);
  if (!raw) warnings.push(`${lang.raw} is missing: search will only know the puzzle films`);
  const byKey = new Map(); // normalized title -> entry
  const add = (title, native, year, fame, extra = []) => {
    const key = norm(title);
    if (!key || /^q\d+$/.test(key)) return;
    const cur = byKey.get(key);
    if (cur && cur.f >= fame) {
      // Same title (often a remake): keep the more famous one, merge spellings.
      cur.a = Array.from(new Set([...cur.a, ...extra, native].filter(Boolean)));
      return;
    }
    const a = Array.from(new Set([...(cur?.a ?? []), ...extra, native].filter((x) => x && norm(x) !== key)));
    byKey.set(key, { t: title, y: year || undefined, f: fame, a });
  };
  for (const r of raw ?? []) {
    // Fame: tiering score (0-100) when known, else a sitelinks-based estimate below 50.
    const fame = fameById.get(r.wikidata_id) ?? Math.min(49, Number(r.sitelinks) || 0);
    add(r.title_en, r.title_native, Number(r.year), fame);
  }
  // Puzzle films are always present, with their aliases, but keep their normal
  // fame rank: pushing answers to the top of suggestions would give them away.
  for (const p of puzzles[lang.code]) {
    const known = byKey.get(norm(p.title));
    add(p.title, p.titleNative, p.year, known ? known.f : 50, p.aliases);
    byKey.get(norm(p.title)).t = p.title; // show our spelling, which the answer check uses
  }
  // Most famous first, so the first suggestions are films people know.
  search[lang.code] = [...byKey.values()]
    .sort((x, y) => y.f - x.f || x.t.localeCompare(y.t))
    .map((e) => (e.a.length ? [e.t, e.y ?? 0, e.a] : [e.t, e.y ?? 0]));
}

/* ---------- Checks across the set ---------- */

for (const lang of cfg.languages) {
  const n = puzzles[lang.code].length;
  if (n < cfg.minPuzzlesPerLanguage) errors.push(`${lang.name}: only ${n} playable puzzles (need at least ${cfg.minPuzzlesPerLanguage})`);
  else if (n < cfg.betaTargetPerLanguage) warnings.push(`${lang.name}: ${n} playable puzzles (beta target ${cfg.betaTargetPerLanguage})`);
}

/* ---------- Write ---------- */

const log = (...a) => quiet || console.log(...a);
for (const w of warnings) log("⚠️ ", w);
if (errors.length) {
  for (const e of errors) console.error("❌", e);
  console.error(`\nContent check failed: ${errors.length} problem(s). Fix them in the Google Sheet and sync again.`);
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const counts = {};
for (const lang of cfg.languages) {
  writeFileSync(join(OUT, `puzzles-${lang.code}.json`), JSON.stringify(puzzles[lang.code]));
  writeFileSync(join(OUT, `search-${lang.code}.json`), JSON.stringify(search[lang.code]));
  counts[lang.code] = { puzzles: puzzles[lang.code].length, titles: search[lang.code].length };
}
const langs = cfg.languages.map(({ code, name, native }) => ({ code, name, native }));
const loaders = (kind) =>
  cfg.languages.map((l) => `  ${l.code}: () => import("./${kind}-${l.code}.json").then((m) => m.default as unknown),`).join("\n");
writeFileSync(
  join(OUT, "index.ts"),
  `// Generated by scripts/build-content.mjs from data/. Do not edit.
export const LANGS = ${JSON.stringify(langs)} as const;
export const COUNTS: Record<string, { puzzles: number; titles: number }> = ${JSON.stringify(counts)};
export const PUBLISHED_STATUSES = ${JSON.stringify([...statuses])};
export const puzzleLoaders: Record<string, () => Promise<unknown>> = {
${loaders("puzzles")}
};
export const searchLoaders: Record<string, () => Promise<unknown>> = {
${loaders("search")}
};
`,
);
const sizes = cfg.languages
  .map((l) => {
    const p = readFileSync(join(OUT, `puzzles-${l.code}.json`)).length;
    const s = readFileSync(join(OUT, `search-${l.code}.json`)).length;
    return `${l.name}: ${counts[l.code].puzzles} puzzles (${(p / 1024).toFixed(1)} KB), ${counts[l.code].titles} search titles (${(s / 1024).toFixed(0)} KB)`;
  })
  .join(" · ");
log(`✅ Content built [statuses: ${[...statuses].join(", ")}; rows by status: ${JSON.stringify(statusCount)}]\n   ${sizes}`);
