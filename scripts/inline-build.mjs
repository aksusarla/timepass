// Bundles the static export (out/) into ONE self-contained HTML file, for
// sharing a preview link anywhere a single page can be hosted.
// Usage: node scripts/inline-build.mjs out/index.html dist/timepass.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const [src = "out/index.html", dest = "dist/timepass.html"] = process.argv.slice(2);
const root = dirname(src);
let html = readFileSync(src, "utf8");
const asset = (url) => readFileSync(join(root, url.replace(/^\//, "")), "utf8");
// Escape "</script" and literal U+FFFD (used by some libraries) so the file is clean text.
const safeJs = (js) => js.replace(/<\/script/gi, "<\\/script").replace(/\uFFFD/g, "\\uFFFD");
// Turbopack and Next's bootstrap find their own file via document.currentScript,
// which is null for inline scripts. Before each chunk, point a global at a
// detached <script> element carrying the chunk's original URL, and read that.
const withSelf = (js, url) =>
  `window.__tpScript=Object.assign(document.createElement("script"),{src:${JSON.stringify(url)}});` +
  js.split("document.currentScript").join("window.__tpScript");

// Preload hints point at files that won't exist next to the single page.
html = html.replace(/<link[^>]*rel="preload"[^>]*>/g, "");
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="(\/_next\/[^"]+)"[^>]*\/?>/g, (_, href) => `<style>${asset(href)}</style>`);

const inlined = new Set();
html = html.replace(/<script([^>]*)src="(\/_next\/[^"]+)"([^>]*)><\/script>/g, (_, a, srcUrl) => {
  inlined.add(srcUrl.split("/").pop());
  return `<script>${safeJs(withSelf(asset(srcUrl), srcUrl))}</script>`;
});

// Chunks the runtime might request later: register them up front too.
const chunkDir = join(root, "_next/static/chunks");
const extra = readdirSync(chunkDir).filter((f) => f.endsWith(".js") && !inlined.has(f));
if (extra.length) {
  const tags = extra.map((f) => `<script>${safeJs(withSelf(readFileSync(join(chunkDir, f), "utf8"), `/_next/static/chunks/${f}`))}</script>`).join("");
  html = html.replace("</body>", `${tags}</body>`);
}

// Every chunk is already inline, so when the runtime asks the browser to load
// one again, report success instead of fetching a file that isn't there.
const shim = `<script>(function(){function f(n){var u=n&&(n.src||n.href)||"";if(typeof u==="string"&&u.indexOf("/_next/static/")>-1){setTimeout(function(){n.dispatchEvent(new Event("load"))});return true}return false}var a=Node.prototype.appendChild,i=Node.prototype.insertBefore;Node.prototype.appendChild=function(n){return f(n)?n:a.call(this,n)};Node.prototype.insertBefore=function(n,r){return f(n)?n:i.call(this,n,r)}})()</script>`;
// Hosts that read the page name scan only the top of the file: lead with it.
const title = (html.match(/<title>[\s\S]*?<\/title>/) || [""])[0];
const fit = (html.match(/<meta name="claude:viewport-fit-sides"[^>]*>/) || [""])[0];
html = html.replace(title, "").replace(fit, "");
html = html.replace(/<head>/, `<head>${title}${fit}${shim}`);

mkdirSync(dirname(dest), { recursive: true });
writeFileSync(dest, html);
console.log(`Wrote ${dest} (${(html.length / 1024).toFixed(0)} KB, ${inlined.size + extra.length} scripts inlined)`);
