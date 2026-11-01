// Copies the Supabase content bank into data/ as CSV (used by the "Sync
// content" GitHub Action when SUPABASE_URL is set; by hand: npm run data:sync).
// Same output files and safety checks as the Google Sheets sync, so nothing
// downstream changes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readTable, parseCsv, toCsv } from "./lib/csv.mjs";
import { supabase, toCsvCell, META_COLUMNS } from "./lib/supabase.mjs";

const ROOT = process.cwd();
const db = supabase();
if (!db) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are not set.");
const cfg = JSON.parse(readFileSync(join(ROOT, "content.config.json"), "utf8"));
console.log(`Reading ${db.url}`);

const summary = [];
for (const t of cfg.sources.supabase.tables) {
  const out = join(ROOT, t.file);
  let header = [];
  let before = 0;
  try {
    const text = readFileSync(out, "utf8");
    header = parseCsv(text)[0] ?? [];
    before = readTable(text).length;
  } catch {}
  const rows = await db.selectAll(t.table, { filter: t.filter, order: t.order });
  // Keep the existing column order; add any new database columns at the end.
  const cols = [...header, ...Object.keys(rows[0] ?? {}).filter((c) => !header.includes(c) && !META_COLUMNS.has(c))];
  if (!cols.length) throw new Error(`${t.table} returned no columns; refusing to write ${t.file}.`);
  if (t.table === "movies" && rows.length < before)
    throw new Error(`movies has ${before - rows.length} fewer rows than the last sync. Rows must never be deleted; not syncing.`);
  if (before > 50 && rows.length < before * 0.5)
    throw new Error(`${t.table} (${t.filter ?? "all"}) shrank from ${before} to ${rows.length} rows; not syncing.`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toCsv([cols, ...rows.map((r) => cols.map((c) => toCsvCell(c, r[c])))]));
  summary.push(`${t.file}: ${rows.length} rows (was ${before})`);
}
console.log(summary.join("\n"));
