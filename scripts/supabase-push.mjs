// Loads the current data/ snapshot into Supabase. Run once after creating the
// tables (supabase/schema.sql), from a laptop with the secret key:
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... npm run data:push
// Safe to re-run: movies and films are matched on their codes; tiering is
// loaded only while its table is empty.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { readTable } from "./lib/csv.mjs";
import { supabase, toDb, META_COLUMNS } from "./lib/supabase.mjs";

const ROOT = process.cwd();
const db = supabase();
if (!db) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY first (Supabase > Project Settings > API Keys).");
  process.exit(1);
}
const cfg = JSON.parse(readFileSync(join(ROOT, "content.config.json"), "utf8"));
const columns = { movies: null, films: null, tiering: null };

for (const t of cfg.sources.supabase.tables) {
  const path = join(ROOT, t.file);
  if (!existsSync(path)) continue;
  if (!t.key && (await db.count(t.table)) > 0) {
    console.log(`${t.table}: already has rows, skipped (load it only into an empty table)`);
    continue;
  }
  let rows = readTable(readFileSync(path, "utf8"));
  if (t.table === "films") rows = rows.filter((r) => /^Q\d+$/.test(r.wikidata_id));
  const payload = rows.map((r) =>
    Object.fromEntries(Object.entries(r).filter(([c]) => !META_COLUMNS.has(c)).map(([c, v]) => [c, toDb(c, v)])),
  );
  columns[t.table] ??= Object.keys(payload[0] ?? {});
  await db.upsert(t.table, payload, t.key);
  console.log(`${t.table}${t.filter ? ` (${t.filter})` : ""}: ${payload.length} rows loaded from ${t.file}`);
}
console.log("\nDone. Open Supabase > Table Editor to see the data.");
