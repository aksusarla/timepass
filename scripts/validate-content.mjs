// Checks every cinema pack before a build. Run: npm run check:content
// Catches the mistakes that break a day's puzzle: missing clues, duplicate
// ids, answers that the autocomplete would not offer, a pool about to run out.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIR = join(process.cwd(), "src/content/cinema");
const CLUE_FIELDS = ["emoji", "plot", "genre", "hero", "heroine", "director"];
const LAUNCH_DATE = "2026-11-01";
const WARN_DAYS_LEFT = 14;

const errors = [];
const warnings = [];
const seenIds = new Set();

const daysSinceLaunch = Math.max(
  0,
  Math.floor((Date.now() + 5.5 * 3600e3 - Date.parse(LAUNCH_DATE)) / 86400e3),
);

for (const file of readdirSync(DIR).filter((f) => f.endsWith(".json"))) {
  const pack = JSON.parse(readFileSync(join(DIR, file), "utf8"));
  const where = (msg) => `${file}: ${msg}`;

  if (!Array.isArray(pack.puzzles) || pack.puzzles.length === 0) {
    errors.push(where("no puzzles"));
    continue;
  }
  if (`${pack.language}.json` !== file) {
    errors.push(where(`"language" is "${pack.language}" but file is ${file}`));
  }

  pack.puzzles.forEach((p, i) => {
    const at = `puzzle ${i + 1} (${p.id ?? "no id"})`;
    if (!p.id?.startsWith(`${pack.language}-`)) errors.push(where(`${at}: id must start with "${pack.language}-"`));
    if (seenIds.has(p.id)) errors.push(where(`${at}: duplicate id`));
    seenIds.add(p.id);
    if (!p.title) errors.push(where(`${at}: missing title`));
    if (!Number.isInteger(p.year) || p.year < 1913 || p.year > 2030) errors.push(where(`${at}: bad year`));
    if (!Array.isArray(p.aliases)) errors.push(where(`${at}: aliases must be a list`));
    for (const f of CLUE_FIELDS) {
      if (!p.clues?.[f]?.trim()) errors.push(where(`${at}: missing clue "${f}"`));
    }
    if (p.clues?.plot && p.title && p.clues.plot.toLowerCase().includes(p.title.toLowerCase())) {
      errors.push(where(`${at}: plot clue gives away the title`));
    }
  });

  if ((pack.extraTitles ?? []).length < pack.puzzles.length) {
    warnings.push(where("fewer decoy titles than puzzles; autocomplete may give answers away"));
  }
  const daysLeft = pack.puzzles.length - daysSinceLaunch;
  if (daysLeft < WARN_DAYS_LEFT) {
    warnings.push(where(`${Math.max(0, daysLeft)} days of fresh puzzles left before repeats; add more (target 30+)`));
  }
}

for (const w of warnings) console.warn("⚠️ ", w);
if (errors.length) {
  for (const e of errors) console.error("❌", e);
  process.exit(1);
}
console.log(`✅ Content OK (${seenIds.size} puzzles)`);
