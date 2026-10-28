"use client";

import { useEffect, useState } from "react";

// Games are saved on this phone so a refresh, a tap on the menu or a locked
// screen never wipes the scores. Storage can be blocked (private mode), so
// every access is wrapped and the game still works without it.

const PREFIX = "timepass:";

export function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function saveState(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) window.localStorage.removeItem(PREFIX + key);
    else window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {}
}

/** Raw saved string, for cheap checks such as "is there a game to resume?". */
export function peekState(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

/**
 * useState that survives refreshes. Only use in components that mount after
 * hydration (game screens), since the first render reads localStorage.
 */
export function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => loadState(key, initial));
  useEffect(() => {
    saveState(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
