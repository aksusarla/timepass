// Builds data/timepass.db, a SQLite copy of the data/ snapshot, for the Data
// Team to query with SQL (DB Browser for SQLite, DBeaver, or `sqlite3`).
// Run: npm run data:db   (git-ignored; rebuild any time from data/)
import { readFileSync, rmSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { readTable } from "./lib/csv.mjs";

const ROOT = process.cwd();
const DB = join(ROOT, "data/timepass.db");
rmSync(DB, { force: true });
const db = new DatabaseSync(DB);

const files = [
  ["movies", "data/content-bank/movies.csv"],
  ["tiering", "data/raw/tiering.csv"],
  ...readdirSync(join(ROOT, "data/raw"))
    .filter((f) => /^films_[a-z]{2}\.csv$/.test(f))
    .map((f) => [basename(f, ".csv"), `data/raw/${f}`]),
];
const NUMERIC = /^(year|sitelinks|cast_count|difficulty|box_office_crore|bo_rank_in_year|pageviews_60d|pageview_percentile|score)$/;

for (const [table, path] of files) {
  if (!existsSync(join(ROOT, path))) continue;
  const rows = readTable(readFileSync(join(ROOT, path), "utf8"));
  if (!rows.length) continue;
  const cols = Object.keys(rows[0]);
  db.exec(`CREATE TABLE ${table} (${cols.map((c) => `"${c}" ${NUMERIC.test(c) ? "REAL" : "TEXT"}`).join(", ")})`);
  const ins = db.prepare(`INSERT INTO ${table} VALUES (${cols.map(() => "?").join(", ")})`);
  db.exec("BEGIN");
  for (const r of rows) ins.run(...cols.map((c) => (NUMERIC.test(c) ? (r[c] === "" ? null : Number(r[c])) : r[c])));
  db.exec("COMMIT");
  console.log(`${table}: ${rows.length} rows`);
}
// All raw films in one view, for cross-language questions.
const raw = files.filter(([t]) => t.startsWith("films_")).map(([t]) => `SELECT * FROM ${t}`);
if (raw.length) db.exec(`CREATE VIEW films AS ${raw.join(" UNION ALL ")}`);
db.exec(`CREATE INDEX IF NOT EXISTS movies_code ON movies(movie_code)`);
db.close();
console.log(`\nWrote ${DB}. Example: SELECT language, status, COUNT(*) FROM movies GROUP BY 1, 2;`);
