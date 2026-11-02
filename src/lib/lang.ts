"use client";

// The film language a visitor picked (Telugu, Tamil or both), shared by the
// home page and every game, and remembered on this phone.
import { useSyncExternalStore } from "react";
import { loadState, saveState } from "@/lib/store";

export type FilmLang = "te" | "ta" | "both";
const KEY = "film-lang";
const listeners = new Set<() => void>();

function read(): FilmLang {
  const v = loadState<string>(KEY, "te");
  return v === "ta" || v === "both" ? v : "te";
}

export function setFilmLang(lang: FilmLang) {
  saveState(KEY, lang);
  listeners.forEach((l) => l());
}

export function useFilmLang(): FilmLang {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => "te",
  );
}
