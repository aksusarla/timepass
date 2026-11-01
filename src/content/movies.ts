"use client";

// Content access for the games. The data itself is NOT in this file: it is
// compiled from data/ (the Data Team's Google Sheets snapshot) into
// src/content/generated/ by scripts/build-content.mjs, one small file per
// language. Each file is downloaded only when a game needs it, then cached.
import { useEffect, useState } from "react";
import { buildIndex, type SearchIndex, type SearchRow } from "@/lib/game";
import { COUNTS, LANGS, puzzleLoaders, searchLoaders } from "./generated";

export { COUNTS, LANGS };
export type Lang = string;

export type Movie = {
  id: string; // permanent code from the sheet, e.g. "te-0001"
  legacy?: string; // prototype id (e.g. "te-magadheera") so old saved games resume
  lang: Lang;
  status: string;
  title: string; // romanised title, shown on reveal and checked against answers
  titleNative?: string;
  aliases: string[];
  year: number;
  genre: string;
  storyline: string;
  storylineNative?: string;
  hero: string;
  heroine: string;
  director: string;
  music?: string;
  difficulty?: 1 | 2 | 3;
  familySafe: boolean;
};

export const ALL_LANGS: Lang[] = LANGS.map((l) => l.code);

const puzzleCache = new Map<Lang, Promise<Movie[]>>();
const searchCache = new Map<string, Promise<SearchIndex>>();

function loadPuzzles(lang: Lang): Promise<Movie[]> {
  if (!puzzleCache.has(lang)) {
    const load = puzzleLoaders[lang];
    puzzleCache.set(lang, load ? (load() as Promise<Movie[]>) : Promise.resolve([]));
  }
  return puzzleCache.get(lang)!;
}

/** Playable films for the given languages. */
export async function loadPool(langs: Lang[]): Promise<Movie[]> {
  return (await Promise.all(langs.map(loadPuzzles))).flat();
}

/** Search index of every known title (thousands per language), most famous first. */
export function loadSearch(langs: Lang[]): Promise<SearchIndex> {
  const key = [...langs].sort().join("+");
  if (!searchCache.has(key)) {
    searchCache.set(
      key,
      Promise.all(langs.map((l) => (searchLoaders[l] ? (searchLoaders[l]() as Promise<SearchRow[]>) : Promise.resolve([])))).then(
        (lists) => {
          // Interleave languages so "Both" keeps fame order across them.
          const merged: SearchRow[] = [];
          const max = Math.max(0, ...lists.map((l) => l.length));
          for (let i = 0; i < max; i++) for (const l of lists) if (i < l.length) merged.push(l[i]);
          return buildIndex(merged);
        },
      ),
    );
  }
  return searchCache.get(key)!;
}

/** Find a film by its code or its old prototype id. */
export function findMovie(pool: Movie[], id: string): Movie | undefined {
  return pool.find((m) => m.id === id || m.legacy === id);
}

function useAsync<T>(key: string, load: () => Promise<T>): T | null {
  const [state, setState] = useState<{ key: string; value: T } | null>(null);
  useEffect(() => {
    let live = true;
    load().then((value) => live && setState({ key, value }));
    return () => {
      live = false;
    };
    // `key` captures everything `load` depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state && state.key === key ? state.value : null;
}

/** Playable films for these languages; null while downloading. */
export function usePool(langs: Lang[]): Movie[] | null {
  return useAsync(`pool:${langs.join("+")}`, () => loadPool(langs));
}

/** Search index for these languages; null while downloading. */
export function useSearch(langs: Lang[]): SearchIndex | null {
  return useAsync(`search:${[...langs].sort().join("+")}`, () => loadSearch(langs));
}

/** Start downloading in the background (e.g. when a game card is tapped). */
export function prefetch(langs: Lang[] = ALL_LANGS) {
  loadPool(langs);
  loadSearch(langs);
}
