# Timepass data: where it lives and how it reaches players

## The flow

```
Google Sheets (Data Team edits here)              ← source of truth
  Timepass Content Bank → Movies tab              one row per puzzle film
  Timepass Raw Film Data → Telugu raw, Tamil raw  ~9,200 films from Wikidata
                         → Tiering 2006-2025      fame scores
        │  every day 06:00 IST, or Actions → "Sync content" → Run workflow
        ▼
data/  (CSV copies in GitHub, every change visible line by line)
        │  automatic check → pull request → Abhi approves → merge
        ▼
Build  scripts/build-content.mjs
        │  keeps only publishable rows, checks every rule, compacts
        ▼
Website files, one per language, cached by the browser:
  puzzles-te.json   ~4 KB   playable films (loaded when a game opens)
  search-te.json    ~60 KB  every known title, most famous first
                            (loaded only when someone types an answer)
```

Players never read Google Sheets directly: that would be slow, hit Google's
limits and expose unfinished rows.

## What the Data Team does

- Edit the sheets as before. Follow the Guide tab (permanent codes, never
  delete a row, set status to retired instead).
- Mark a row `verified` only after checking it against `source_url`, and
  fill `verified_by` and `verified_on`.
- Next morning a pull request called **"Content sync from Google Sheets"**
  appears. Its description says whether the content check passed and lists
  any problems by row. Fix problems in the sheet; the next sync updates the
  same pull request.

## What the check blocks

- Missing required fields on any row that would be published
- Codes that are malformed, reused, or don't match the language
- A storyline that mentions the film's title
- `verified` rows without `verified_by` / `verified_on`
- Fewer than 5 playable puzzles in a language
- Deleted rows in the Movies tab, or a raw tab shrinking by half (the sync
  refuses to copy, so an accidental delete never reaches players)

Warnings (not blocking): storylines over 35 words, empty heroine, missing
`source_url` on verified rows, languages below the 60-puzzle beta target.

## Publishing rule

`content.config.json` → `publishStatuses`. **Beta override:** currently
`["verified", "draft"]` because no row is verified yet. When the first 5+
puzzles per language are verified, change it to `["verified"]` so only
checked facts reach players, as the sheet guide says.

## SQL on the content bank

`npm run data:db` builds `data/timepass.db` (SQLite) from the CSVs, with
tables `movies`, `tiering`, `films_te`, `films_ta` and a `films` view.
Open it in DB Browser for SQLite or DBeaver. Example:

```sql
SELECT language, tier, COUNT(*) FROM tiering GROUP BY 1, 2;
SELECT title_en, year, sitelinks FROM films WHERE language = 'te' ORDER BY sitelinks DESC LIMIT 20;
```

## Adding a language

1. Add a raw tab for it to the Raw Film Data sheet and rows to Movies.
2. Add it to `content.config.json` → `languages` and `sources`.
3. Sync. The site picks it up with no other code change.

## When to change this setup

Revisit when the Movies tab passes ~10,000 rows or several people edit at
once (CEO decision). The site side won't change: only the source moves, e.g.
to a database that exports the same CSVs.
