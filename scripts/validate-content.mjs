// Checks the content bank before every build. Run: npm run check:content
// Catches what breaks a round: missing clues, duplicate ids, a storyline that
// gives away the title, autocomplete decoys missing.
import { MOVIES, EXTRA_TITLES, LANGS } from "../src/content/movies.ts";

const FIELDS = ["title", "storyline", "hero", "heroine", "director", "genre"];
const TARGET = 60; // PRD: 60+ verified puzzles per language before beta
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const errors = [];
const ids = new Set();
for (const m of MOVIES) {
  const at = `${m.id}`;
  if (!m.id.startsWith(`${m.lang}-`)) errors.push(`${at}: id must start with "${m.lang}-"`);
  if (ids.has(m.id)) errors.push(`${at}: duplicate id`);
  ids.add(m.id);
  for (const f of FIELDS) if (!String(m[f] ?? "").trim()) errors.push(`${at}: missing ${f}`);
  if (!Number.isInteger(m.year) || m.year < 1913 || m.year > 2030) errors.push(`${at}: bad year`);
  if (norm(m.storyline).includes(norm(m.title))) errors.push(`${at}: storyline gives away the title`);
  const words = m.storyline.split(/\s+/).length;
  if (words > 35) errors.push(`${at}: storyline is ${words} words (keep it under 35)`);
  if (EXTRA_TITLES[m.lang].some((t) => norm(t) === norm(m.title))) errors.push(`${at}: also listed as a decoy title`);
}

for (const l of LANGS) {
  const n = MOVIES.filter((m) => m.lang === l.code).length;
  if (n < TARGET) console.warn(`⚠️  ${l.name}: ${n} puzzles (beta target ${TARGET})`);
}
if (errors.length) {
  for (const e of errors) console.error("❌", e);
  process.exit(1);
}
console.log(`✅ Content OK (${MOVIES.length} movies)`);
