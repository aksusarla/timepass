// Applies Data Team rating and gap-filling edits from a CSV in supabase/updates/
// to existing rows of the movies table. Run by Actions > Update movies.
//   SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/supabase-update.mjs supabase/updates/<file>.csv
//
// Rules, so hand edits made in Supabase are never lost:
// - Only these columns can change: difficulty, family_safe, notes, aliases,
//   wikidata_id, title_native, source_url. Storylines, facts and status never do.
// - An empty cell means "leave as is".
// - wikidata_id, title_native, source_url and aliases are only filled when the
//   row's current value is empty.
// - notes are appended to what is there (skipped if that text is already present).
// - Codes that don't exist are reported and skipped; nothing is inserted.
import { readFileSync } from "node:fs";
import { readTable } from "./lib/csv.mjs";
import { toDb } from "./lib/supabase.mjs";

const ALWAYS = ["difficulty", "family_safe"];
const FILL_IF_EMPTY = ["wikidata_id", "title_native", "source_url", "aliases"];

const file = process.argv[2];
const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
if (!file || !base || !key) {
  console.error("Usage: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node scripts/supabase-update.mjs <csv>");
  process.exit(1);
}
const headers = { apikey: key, ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }) };
const call = async (path, init = {}) => {
  const res = await fetch(`${base}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return res;
};

const edits = readTable(readFileSync(file, "utf8"));
let changed = 0;
const missing = [];
for (const e of edits) {
  const code = String(e.movie_code ?? "").trim();
  if (!/^[a-z]{2}-\d{4}$/.test(code)) {
    console.log(`skip: bad movie_code "${code}"`);
    continue;
  }
  const [row] = await (await call(`movies?movie_code=eq.${code}&select=*`)).json();
  if (!row) {
    missing.push(code);
    continue;
  }
  const patch = {};
  for (const c of ALWAYS) {
    const v = toDb(c, e[c]);
    if (v != null && v !== row[c]) patch[c] = v;
  }
  for (const c of FILL_IF_EMPTY) {
    const v = toDb(c, e[c]);
    if (v != null && (row[c] == null || row[c] === "")) patch[c] = v;
  }
  const note = toDb("notes", e.notes);
  if (note && !String(row.notes ?? "").includes(note)) patch.notes = [row.notes, note].filter(Boolean).join("; ");
  if (!Object.keys(patch).length) continue;
  await call(`movies?movie_code=eq.${code}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  changed++;
  console.log(`${code}: ${Object.keys(patch).join(", ")}`);
}
console.log(`${file}: ${edits.length} rows read, ${changed} movies updated.${missing.length ? ` Not found (skipped): ${missing.join(", ")}` : ""}`);
