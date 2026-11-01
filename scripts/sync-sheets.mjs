// Copies the Data Team's Google Sheets into data/ as CSV (run daily by the
// "Sync content" GitHub Action, or by hand: npm run data:sync).
//
// Access, in order of preference:
//  1. GOOGLE_SERVICE_ACCOUNT_JSON: key of a Google Cloud service account that
//     the sheets are shared with as Viewer. Sheets stay private.
//  2. No key: the sheet's CSV export link. Works only if the sheet is shared
//     "Anyone with the link can view".
// The sheets themselves are listed in content.config.json → sources.
import { createSign } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readTable, toCsv, parseCsv } from "./lib/csv.mjs";

const ROOT = process.cwd();
const cfg = JSON.parse(readFileSync(join(ROOT, "content.config.json"), "utf8"));
const b64url = (b) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

async function serviceAccountToken(json) {
  const key = JSON.parse(json);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const sig = createSign("RSA-SHA256").update(`${head}.${body}`).sign(key.private_key);
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${body}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${await res.text()}`);
  return { token: (await res.json()).access_token, email: key.client_email };
}

async function readTab(sheetId, tab, auth) {
  if (auth) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(`'${tab}'`)}?valueRenderOption=FORMATTED_VALUE`;
    const res = await fetch(url, { headers: { authorization: `Bearer ${auth.token}` } });
    if (res.status === 403 || res.status === 404)
      throw new Error(`No access to "${tab}". Share the sheet with ${auth.email} as Viewer.`);
    if (!res.ok) throw new Error(`Reading "${tab}" failed (${res.status}): ${await res.text()}`);
    return (await res.json()).values ?? [];
  }
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { redirect: "follow" });
  const text = await res.text();
  if (!res.ok || text.trimStart().startsWith("<"))
    throw new Error(`Could not read "${tab}" without a key. Add GOOGLE_SERVICE_ACCOUNT_JSON (recommended) or share the sheet as "Anyone with the link can view".`);
  return parseCsv(text);
}

const auth = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? await serviceAccountToken(process.env.GOOGLE_SERVICE_ACCOUNT_JSON) : null;
console.log(auth ? `Signed in as ${auth.email}` : "No service account key: trying public CSV links");

const summary = [];
for (const sheet of cfg.sources.sheets) {
  for (const { tab, file } of sheet.tabs) {
    const values = await readTab(sheet.id, tab, auth);
    const [header = [], ...rows] = values;
    if (!header.length) throw new Error(`"${sheet.name}" → "${tab}" is empty; refusing to wipe ${file}.`);
    const width = header.length;
    const clean = rows
      .map((r) => Array.from({ length: width }, (_, i) => String(r[i] ?? "").trim()))
      .filter((r) => r.some((c) => c !== ""));
    const out = join(ROOT, file);
    mkdirSync(dirname(out), { recursive: true });
    const before = (() => {
      try {
        return readTable(readFileSync(out, "utf8")).length;
      } catch {
        return 0;
      }
    })();
    // Guards against accidental deletes in the sheet. Content Bank rows are
    // never deleted (the guide says: set status to retired instead).
    if (file.includes("content-bank") && clean.length < before)
      throw new Error(`"${tab}" lost ${before - clean.length} row(s). Rows must never be deleted: set status to retired instead. Not syncing.`);
    if (before > 50 && clean.length < before * 0.5)
      throw new Error(`"${tab}" shrank from ${before} to ${clean.length} rows. Check the sheet; not syncing.`);
    writeFileSync(out, toCsv([header.map((h) => String(h).trim()), ...clean]));
    summary.push(`${file}: ${clean.length} rows (was ${before})`);
  }
}
console.log(summary.join("\n"));
