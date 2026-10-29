@AGENTS.md

# Timepass: notes for Claude Code

India-first, no-install party and daily games website. Solo founder (Abhi),
building evenings and weekends. Version one should ship fast and feel slightly
embarrassing; prefer the simplest thing that works.

## Stack
- Next.js (App Router, TypeScript), static export (`output: "export"`) to `out/`
- One page, hash routes: `#movie-guess`, `#imposter`
- Plain CSS in `src/app/globals.css`, copied from the portfolio's design tokens
- Hosted on GitHub Pages via `.github/workflows/pages.yml` (BASE_PATH = /repo-name)
- No backend yet. Online mode needs a real-time room service that holds secrets
  server-side (PRD 6, 8); the static front end will talk to it.
- Analytics only through `track()` in `src/lib/analytics.ts`; event names and
  properties follow the project doc "timepass-analytics-posthog-tracking-plan".
  Never rename a live event; never send names, nicknames or typed titles.

## Layout
- `src/content/movies.ts` - content bank (te, ta) + autocomplete decoys
- `src/lib/game.ts` - title matching, suggestions, imposter pick (pure, tested)
- `src/components/MovieGuess.tsx`, `Imposter.tsx`, `Home.tsx`, `ui.tsx`
- `scripts/validate-content.mjs` - runs before every build
- `scripts/inline-build.mjs` - single-file preview bundle

## Rules
- Mobile first: design for a 360-400px phone screen, big tap targets.
- Match the portfolio look: monochrome tokens, Inter, indexed labels, pill buttons.
- Hidden information (imposter, real movie) must live server-side once online.
- Copyright-safe content only: our own plot summaries, emoji, and plain facts
  (names, years). No dialogue, lyrics, posters, stills, audio or video clips.
- No real-money, betting or gambling mechanics.
- Family-safe by default.
- Before finishing a change: `npm test`, `npm run lint`, `npm run build`.
