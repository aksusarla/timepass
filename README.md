# Timepass

Original movie games for Indian get-togethers, in Telugu and Tamil. No install,
no login: open the link and play. Product spec: `claude/timepass-prd-v1.md` in
the Timepass project.

**Timepass Beta, v0.3 (front end only, same room):**
- **Movie Guess**: host-led on one phone. 4-clue ladder (story, hero, heroine,
  director), 20-second timer, 4/3/2/1 points, teams, undo, scoreboard.
  When a timer runs out the next clue opens by itself after a 3-second
  warning (Wait button; or set "Host decides" in settings).
- **Imposter Movie**: pass-and-play on one phone. Secret picks, identical
  reveal screens, two clue rounds, vote, steal, PRD scoring.
- **Rail Gaadi**: listed as proposed.
- **UX (v0.3)**: games-first home, one-tap start, tap-to-rename teams,
  games saved on the phone (refresh-safe, resume card), screen kept awake,
  countdown ring with sound and buzz, press-and-hold secret cards, first-time
  how-to-play, two-column layout on tablets/laptops, full-screen button.
- **Online mode** (everyone on their own phone) needs the room server. It is
  the next build step, not in this prototype.

Design follows aksusarla.github.io (same tokens, Inter, light/dark switch).

## Run it on your laptop

Needs Node.js 20.9 or newer.

```bash
npm install
npm run dev        # http://localhost:3000
```

```bash
npm test               # matching + imposter-pick tests
npm run check:content  # validate the movie bank
npm run lint
npm run build          # static site in ./out
```

## Publish on GitHub Pages (free, ~5 minutes, once)

1. On github.com create a new **public** repo named `timepass` (no README).
2. From this folder:
   ```bash
   git remote add origin https://github.com/aksusarla/timepass.git
   git push -u origin main
   ```
3. Repo **Settings > Pages > Build and deployment > Source: GitHub Actions**.
4. The **Deploy to GitHub Pages** workflow runs on every push to `main`. After
   about 2 minutes the site is live at **https://aksusarla.github.io/timepass/**
   (the link also appears on the workflow run).

Optional analytics: repo **Settings > Secrets and variables > Actions >
Variables**, add `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_CLARITY_ID`, then
re-run the workflow.

Free GitHub Pages needs a public repo. To keep the code private, use Vercel
instead (import the repo at vercel.com; no settings needed).

## How changes get approved

Nothing reaches the live site without Abhi's approval:

- Contributors (e.g. design) work on a branch and open a pull request.
  `DESIGN.md` explains the flow without needing the command line.
- `.github/CODEOWNERS` names Abhi as the reviewer for every file.
- The **Checks** workflow runs tests, lint and a build on every pull request.
- The live site deploys only from `main`.

One-time setup on GitHub (owner only): Settings > Rules > Rulesets > New
branch ruleset for `main`. Require a pull request with 1 approval and review
from Code Owners, require the `checks` status check, and block force pushes.
Add yourself to the bypass list so you can still push your own fixes.

## Single-file preview

`node scripts/inline-build.mjs out/index.html dist/timepass.html` bundles the
built site into one HTML file, used for the claude.ai preview link.

## Adding movies

Edit `src/content/movies.ts`. Storylines are our own words, 20–30 simple words,
never the title. Names and years are facts. Add common English spellings to
`aliases`. Run `npm run check:content`. Beta target: 60+ per language.

## Working with Claude Code

`CLAUDE.md` holds the project rules. Open this folder in Claude Code and ask
for changes in plain English.
