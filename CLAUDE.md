@AGENTS.md

# Timepass: notes for Claude Code

India-first, no-install party and daily games website. Solo founder (Abhi),
building evenings and weekends. Version one should ship fast and feel slightly
embarrassing; prefer the simplest thing that works.

## Stack
- Next.js (App Router, TypeScript, Cache Components on) + Tailwind v4
- Hosted on Vercel, deploys on every push to `main`
- No backend yet. Player progress is in localStorage (`src/lib/storage.ts`).
  Add Supabase only when we need logins, cross-device stats or multiplayer rooms.
- Analytics go through `track()` in `src/lib/analytics.ts` only (PostHog +
  Microsoft Clarity, both switched on by env vars).

## Layout
- `src/content/cinema/<lang>.json` - daily movie puzzles, one per day in order
- `src/content/languages.ts` - languages and which are live
- `src/lib/daily.ts` - IST date + which puzzle is today (pure, tested)
- `src/components/CinemaGame.tsx` - the game UI
- `scripts/validate-content.mjs` - runs before every build

## Rules
- Mobile first: design for a 360-400px phone screen, big tap targets.
- Daily rollover is midnight IST. Never use the server's or user's local date.
- Copyright-safe content only: our own plot summaries, emoji, and plain facts
  (names, years). No dialogue, lyrics, posters, stills, audio or video clips.
- No real-money, betting or gambling mechanics.
- Family-safe by default.
- Before finishing a change: `npm test`, `npm run lint`, `npm run build`.
