# Designing Timepass

Hi! This is the guide for changing how Timepass looks. Abhi approves every
change before it goes live, so experiment freely: nothing you do reaches the
public site until he says yes.

## What to change, and where

| You want to change | Edit this file |
|---|---|
| Colours (light and dark mode), fonts, text sizes, motion speed | `src/app/tokens.css` |
| Which Google Fonts load | `src/app/layout.tsx` (the `fonts.googleapis.com` link) |
| Spacing, shapes, buttons, cards, layout | `src/app/globals.css` |
| Logo / favicon | `src/app/favicon.ico` (and tell Abhi where a logo should appear) |
| Words on the screens | Ask Abhi; copy changes live in `src/components/` |

Start with `tokens.css`. Most of the look comes from about ten values there.

## Requirements (from the PRD)

- Very clean and minimal. Nothing flashy.
- Light and dark mode both designed, not one inverted.
- Works on phones first (360–400 px wide), then tablets and laptops.
- Telugu and Tamil script must render well (Hindi is coming). Noto Sans
  covers them; any new font needs a matching fallback for these scripts.
- Body text readable: at least 4.5:1 contrast against the background.
- Buttons at least 44 px tall: people tap them mid-party.
- No movie posters, stills, actor photos or film logos anywhere.

## How to send a change (no command line needed)

1. Open the file on github.com, click the pencil icon, make your edit.
2. At the bottom choose **Create a new branch for this commit and start a
   pull request**, then **Propose changes**.
3. Fill in the pull request form: what changed, why, and screenshots.
4. Wait for **Checks** to go green (about 2 minutes). If it fails, the log
   says why.
5. Abhi reviews. He can approve, ask for changes, or comment on a line.
   Once he approves and merges, the live site updates in about 2 minutes.

Working on several files? Press `.` on the repo page to open the
in-browser editor (github.dev), or use Claude Code with this folder; the
same pull request flow applies.

## Seeing your change before it's approved

- On the pull request, open **Checks → Artifacts → site-preview**, download
  and unzip it. (The built site expects to live under `/timepass/`, so the
  quickest real preview is to run it locally: `npm install`, then
  `npm run dev`, then open http://localhost:3000.)
- Screenshots in the pull request are what Abhi will mostly judge, so show
  phone and laptop, light and dark.
