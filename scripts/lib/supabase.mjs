// Tiny Supabase REST client (no dependencies) for the content scripts.
// Needs SUPABASE_URL (https://<project>.supabase.co) and SUPABASE_SECRET_KEY
// (a secret key "sb_secret_..." or the legacy service_role key). Server-side
// only: never put the secret key in the website.
export function supabase() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  // New-style keys go in the apikey header only; legacy JWT keys also as Bearer.
  const headers = { apikey: key, ...(key.startsWith("sb_") ? {} : { authorization: `Bearer ${key}` }) };
  const call = async (path, init = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!res.ok) throw new Error(`Supabase ${init.method ?? "GET"} ${path.split("?")[0]} failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
    return res;
  };
  return {
    url,
    /** All rows of a table, 1,000 at a time. */
    async selectAll(table, { filter = "", order } = {}) {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const q = [`select=*`, filter, order ? `order=${order}` : "", `limit=1000`, `offset=${offset}`].filter(Boolean).join("&");
        const page = await (await call(`${table}?${q}`)).json();
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    },
    /** Insert rows; with `key`, existing rows are updated instead of duplicated. */
    async upsert(table, rows, key) {
      for (let i = 0; i < rows.length; i += 500) {
        await call(`${table}${key ? `?on_conflict=${key}` : ""}`, {
          method: "POST",
          headers: { "content-type": "application/json", prefer: `${key ? "resolution=merge-duplicates," : ""}return=minimal` },
          body: JSON.stringify(rows.slice(i, i + 500)),
        });
      }
    },
    async count(table) {
      const res = await call(`${table}?select=*&limit=1`, { headers: { prefer: "count=exact" } });
      return Number(res.headers.get("content-range")?.split("/")[1] ?? 0);
    },
  };
}

const INT = /^(year|difficulty|sitelinks|cast_count|bo_rank_in_year|pageviews_60d)$/;
const NUM = /^(box_office_crore|pageview_percentile|score)$/;

/** CSV cell (text) -> database value. */
export function toDb(col, v) {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  if (col === "family_safe") return s.toLowerCase() !== "no";
  if (INT.test(col)) return Number.isFinite(Number(s)) ? Math.round(Number(s)) : null;
  if (NUM.test(col)) return Number.isFinite(Number(s)) ? Number(s) : null;
  return s;
}

/** Database value -> CSV cell, matching the Google Sheet conventions. */
export function toCsvCell(col, v) {
  if (v == null) return "";
  if (col === "family_safe") return v ? "yes" : "no";
  return String(v);
}

export const META_COLUMNS = new Set(["id", "created_at", "updated_at"]);
