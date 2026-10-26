# Timepass

Desi games for get-togethers and boring afternoons. First game: **Daily Cinema**,
guess today's movie in 6 clues (emoji → plot → year & genre → hero → heroine →
director), in Telugu, Hindi and Tamil. New movie every midnight IST.

## Run it on your laptop

Needs Node.js 20.9 or newer (`node -v` to check).

```bash
npm install
npm run dev        # open http://localhost:3000
```

Other commands:

```bash
npm test               # date and answer-matching tests
npm run check:content  # validate puzzle files
npm run lint
npm run build          # what Vercel runs (validates content first)
```

## Put it online (one-time, ~20 minutes, free)

1. **GitHub**: create a private repo `timepass`, then from this folder:
   `git remote add origin https://github.com/<you>/timepass.git && git push -u origin main`
2. **Vercel**: vercel.com → sign in with GitHub → Add New Project → pick the
   repo → Deploy. You get a `timepass-xxxx.vercel.app` link. Every push to
   `main` redeploys; every branch gets its own preview link.
3. **Analytics** (optional but do it before friends test):
   - PostHog: create a project, copy the Project API key.
   - Microsoft Clarity: add a project, copy the Project ID.
   - Vercel → Project → Settings → Environment Variables: add the values from
     `.env.example`, then redeploy.
4. **Domain**: later, once the name is final. Vercel → Settings → Domains.

## Adding puzzles

Edit `src/content/cinema/<lang>.json`. Puzzles play in file order, one per day
from the launch date in `src/lib/daily.ts`, then loop. Rules:

- Write the plot yourself in simple words. Never copy synopses, dialogue or
  lyrics. Names and years are facts and fine.
- Don't put the title in the plot.
- Add common spellings to `aliases` (e.g. "bahubali").
- Keep `extraTitles` (decoys for autocomplete) at least as long as the puzzle list.
- Run `npm run check:content`.

Target before soft launch: 30+ puzzles per live language.

## Working with Claude Code

`CLAUDE.md` has the project rules. Open this folder in Claude Code and ask
for changes in plain English, e.g. "add a Kannada pack with these 10 movies"
or "add a countdown to the next puzzle".
