// Prints every table/view the API can see, with row counts, plus a movies
// breakdown. Run by Actions > Supabase report.
import { supabase } from "./lib/supabase.mjs";
const db = supabase();
if (!db) throw new Error("Set SUPABASE_URL and SUPABASE_SECRET_KEY");
const url = process.env.SUPABASE_URL.replace(/\/$/, "");
const key = process.env.SUPABASE_SECRET_KEY;
const headers = { apikey: key, ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }), accept: "application/openapi+json" };
const spec = await (await fetch(`${url}/rest/v1/`, { headers })).json();
const tables = Object.keys(spec.paths ?? {}).filter((p) => p !== "/" && !p.startsWith("/rpc/")).map((p) => p.slice(1));
console.log(`Project: ${url}\nTables and views:`);
for (const t of tables) console.log(`  ${t}: ${await db.count(t).catch((e) => `error ${e.message}`)} rows`);
const movies = await db.selectAll("movies", { order: "updated_at.desc" });
const by = {};
for (const m of movies) by[`${m.language}/${m.status}`] = (by[`${m.language}/${m.status}`] ?? 0) + 1;
console.log("\nmovies by language/status:", JSON.stringify(by));
console.log("Last 5 edited:", movies.slice(0, 5).map((m) => `${m.movie_code} ${m.title_roman} (${m.updated_at})`).join(" | "));
