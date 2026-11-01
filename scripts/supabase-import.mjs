// Adds new rows from a CSV in supabase/imports/ to the movies table.
// Rows whose movie_code already exists are skipped, so edits the Data Team
// made in Supabase are never overwritten. Run by Actions > Import movies.
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/supabase-import.mjs supabase/imports/<file>.csv
import { readFileSync } from "node:fs";
import { readTable } from "./lib/csv.mjs";
import { supabase, toDb, META_COLUMNS } from "./lib/supabase.mjs";

const file = process.argv[2];
const db = supabase();
if (!file || !db) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/supabase-import.mjs <csv>");
  process.exit(1);
}
const rows = readTable(readFileSync(file, "utf8")).map((r) =>
  Object.fromEntries(Object.entries(r).filter(([c]) => !META_COLUMNS.has(c)).map(([c, v]) => [c, toDb(c, v)])),
);
const before = await db.count("movies");
await db.upsert("movies", rows, "movie_code", { onlyNew: true });
const after = await db.count("movies");
console.log(`${file}: ${rows.length} rows read, ${after - before} new movies added (${rows.length - (after - before)} already existed, left untouched).`);
