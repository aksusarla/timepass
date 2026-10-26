// One daily puzzle. Clues are revealed in this order, one per wrong guess:
// emoji -> plot -> yearGenre -> hero -> heroine -> director.
// Copyright rule: everything here must be written by us (or be plain facts
// like names and years). No real dialogue, lyrics, posters or clips.
export type CinemaPuzzle = {
  id: string; // stable, never reuse: "<lang>-<slug>"
  title: string; // canonical answer, as shown on reveal
  aliases: string[]; // other accepted spellings, lowercase is fine
  year: number;
  clues: {
    emoji: string;
    plot: string; // "storyline in simple words"
    genre: string;
    hero: string;
    heroine: string;
    director: string;
  };
};

export type CinemaPack = {
  language: string; // language code, e.g. "te"
  puzzles: CinemaPuzzle[]; // played in this order, one per day, then loops
  // Extra real titles used only for guess autocomplete, so the suggestion
  // list doesn't give the answer away.
  extraTitles: string[];
};

export const CLUE_ORDER = [
  "emoji",
  "plot",
  "yearGenre",
  "hero",
  "heroine",
  "director",
] as const;

export type ClueKey = (typeof CLUE_ORDER)[number];

export const MAX_GUESSES = CLUE_ORDER.length; // 6
