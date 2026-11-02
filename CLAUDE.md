@AGENTS.md

# Timepass: notes for Claude Code

India-first, no-install party and daily games website. Solo founder (Abhi),
building evenings and weekends. Version one should ship fast and feel slightly
embarrassing; prefer the simplest thing that works.

## Stack
- Next.js (App Router, TypeScript), static export (`output: "export"`) to `out/`
- One page, hash routes: `#movie-guess`, `#imposter`
- Plain CSS in `src/app/globals.css`; design tokens in `src/app/tokens.css` (from Figma)
- Hosted on GitHub Pages via `.github/workflows/pages.yml` (BASE_PATH = /repo-name)
- Online mode: Cloudflare Worker + Durable Objects in `rooms/` (deployed by `.github/workflows/rooms.yml`);
  answers and secrets stay on the server until reveal (PRD 6, 10).
- Analytics only through `track()` in `src/lib/analytics.ts`; event names and
  properties follow the project doc "timepass-analytics-posthog-tracking-plan".
  Never rename a live event; never send names, nicknames or typed titles.

## Layout
- `data/` - CSV snapshot of the Data Team's Google Sheets (synced daily via PR; never edit by hand)
- `content.config.json` - languages, sheet sources, publish statuses
- `scripts/build-content.mjs` - validates data/ and writes `src/content/generated/` (per-language puzzles + search, lazy-loaded)
- `src/content/movies.ts` - loaders and hooks (`usePool`, `useSearch`); no data in code
- `DATA.md` - data architecture and Data Team workflow
- `src/lib/game.ts` - title matching, suggestions, imposter pick (pure, tested)
- `src/lib/selection.ts` - which films a game gets (random, no repeats per device); plug-in point for selection algorithms
- `src/lib/rooms.ts` - online room + Movie Guess (Teams) rules engine (pure, tested; bundled into the room server)
- `src/lib/online.ts`, `src/components/Online.tsx` - online client (#online, #room=CODE); hidden unless NEXT_PUBLIC_ROOMS_URL is set
- `rooms/` - Cloudflare Worker + Durable Object room server (own package; `cd rooms && npm run dev` on :8787)
- `src/components/MovieGuess.tsx`, `Imposter.tsx`, `Home.tsx`, `ui.tsx`
- `scripts/inline-build.mjs` - single-file preview bundle

## Rules
- Mobile first: design for a 360-400px phone screen, big tap targets.
- Match the Figma design (file rVDf1rqJUyPQrYy5llmwZI, v0.7): near-black and cream with a lime accent,
  Space Grotesk headings, Inter body, IBM Plex Mono labels, 6-10px radii. All values live in
  `src/app/tokens.css`; light mode is derived from the Figma dark values. No imagery we don't own.
- Hidden information (imposter, real movie) must live server-side once online.
- Content changes go through the Google Sheet, not code. Never put movie data in components.
- Copyright-safe content only: our own plot summaries, emoji, and plain facts
  (names, years). No dialogue, lyrics, posters, stills, audio or video clips.
- No real-money, betting or gambling mechanics.
- Family-safe by default.
- Before finishing a change: `npm test`, `npm run lint`, `npm run build`.
