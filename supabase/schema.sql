-- Timepass content bank on Supabase (Postgres). Run once in the Supabase
-- dashboard: SQL Editor > New query > paste this file > Run.
-- Owner: Data Team. Players never read this database: a daily GitHub job
-- copies it into data/ (pull request, Abhi approves) and the site serves
-- compiled files. Rules from the Content Bank guide are enforced here.

-- ---------- Puzzle films (was the Movies tab) ----------
create table if not exists public.movies (
  movie_code       text primary key check (movie_code ~ '^[a-z]{2}-[0-9]{4}$'),
  language         text not null check (language ~ '^[a-z]{2}$'),
  status           text not null default 'draft' check (status in ('draft', 'in review', 'verified', 'retired')),
  title_roman      text not null check (length(trim(title_roman)) > 0),
  title_native     text,
  aliases          text,            -- separated by "; " e.g. bahubali; baahubali 1
  year             int check (year between 1913 and 2030),
  genre            text,
  hero             text,
  heroine          text,
  director         text,
  music_director   text,
  storyline_en     text,
  storyline_native text,
  difficulty       smallint check (difficulty in (1, 2, 3)),
  family_safe      boolean,         -- blank = not reviewed yet (treated as safe)
  source_url       text,
  verified_by      text,
  verified_on      date,
  notes            text,
  legacy_id        text unique,     -- prototype id, Engineering only
  wikidata_id      text,            -- link to films.wikidata_id when known
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint code_matches_language check (left(movie_code, 2) = language),
  constraint verified_rows_complete check (
    status <> 'verified' or (
      verified_by is not null and verified_on is not null and year is not null
      and coalesce(hero, '') <> '' and coalesce(director, '') <> '' and coalesce(storyline_en, '') <> ''
    )
  )
);

-- Rows are never deleted (codes stay reserved): set status to 'retired'.
create or replace function public.forbid_movie_delete() returns trigger language plpgsql as $$
begin
  raise exception 'Movies are never deleted. Set status to retired instead (code %).', old.movie_code;
end $$;
drop trigger if exists movies_no_delete on public.movies;
create trigger movies_no_delete before delete on public.movies
  for each row execute function public.forbid_movie_delete();

-- A code is permanent.
create or replace function public.movies_guard_update() returns trigger language plpgsql as $$
begin
  if new.movie_code <> old.movie_code then
    raise exception 'movie_code is permanent: add a new row instead of changing %', old.movie_code;
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists movies_guard_update on public.movies;
create trigger movies_guard_update before update on public.movies
  for each row execute function public.movies_guard_update();

-- Change history: every insert and edit, with before/after values.
create table if not exists public.movie_changes (
  id          bigint generated always as identity primary key,
  movie_code  text not null,
  operation   text not null,
  changed_at  timestamptz not null default now(),
  changed_by  text,
  old_row     jsonb,
  new_row     jsonb
);
create or replace function public.log_movie_change() returns trigger language plpgsql as $$
begin
  insert into public.movie_changes (movie_code, operation, changed_by, old_row, new_row)
  values (new.movie_code, tg_op, coalesce(auth.jwt() ->> 'email', current_user),
          case when tg_op = 'UPDATE' then to_jsonb(old) end, to_jsonb(new));
  return new;
end $$;
drop trigger if exists movies_log on public.movies;
create trigger movies_log after insert or update on public.movies
  for each row execute function public.log_movie_change();

-- Next free code per language, e.g. select public.next_movie_code('te');
create or replace function public.next_movie_code(lang text) returns text language sql stable as $$
  select lang || '-' || lpad((coalesce(max(substr(movie_code, 4)::int), 0) + 1)::text, 4, '0')
  from public.movies where language = lang;
$$;

-- ---------- Raw film list from Wikidata (search, decoys, shortlisting) ----------
create table if not exists public.films (
  wikidata_id  text not null check (wikidata_id ~ '^Q[0-9]+$'),
  language     text not null,
  year         int,
  title_en     text,
  title_native text,
  sitelinks    int,
  enwiki_title text,
  directors    text,
  music        text,
  cast_first6  text,
  cast_count   int,
  primary key (wikidata_id, language) -- bilingual films appear once per language
);
create index if not exists films_language on public.films (language);

-- ---------- Fame tiering (box office + pageviews) ----------
create table if not exists public.tiering (
  id                  bigint generated always as identity primary key,
  tier                text,
  language            text,
  year                int,
  title_en            text,
  title_native        text,
  director            text,
  box_office_crore    numeric,
  box_office_text     text,
  bo_source           text,
  bo_rank_in_year     int,
  pageviews_60d       int,
  pageview_percentile numeric,
  score               numeric,
  why_included        text,
  flags               text,
  original_language   text,
  wikidata_id         text,
  enwiki_title        text
);

-- ---------- Handy views for the Data Team ----------
create or replace view public.movies_progress as
  select language, status, count(*) as films from public.movies group by 1, 2 order by 1, 2;

-- Shortlisted films not yet in the Movies table.
create or replace view public.shortlist_todo as
  select t.* from public.tiering t
  where t.tier in ('Easy', 'Medium', 'Hard')
    and not exists (select 1 from public.movies m
                    where m.wikidata_id = t.wikidata_id
                       or (lower(m.title_roman) = lower(t.title_en) and m.year = t.year));

-- ---------- Security ----------
-- Row-level security on, with no public policies: the public API key can read
-- nothing. The dashboard (Data Team) and the sync job's secret key still work.
alter table public.movies enable row level security;
alter table public.movie_changes enable row level security;
alter table public.films enable row level security;
alter table public.tiering enable row level security;
alter view public.movies_progress set (security_invoker = true);
alter view public.shortlist_todo set (security_invoker = true);
