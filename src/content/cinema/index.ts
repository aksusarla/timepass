import type { CinemaPack } from "./types";
import te from "./te.json";
import hi from "./hi.json";
import ta from "./ta.json";

const PACKS: Record<string, CinemaPack> = { te, hi, ta };

export function getCinemaPack(lang: string): CinemaPack | undefined {
  return PACKS[lang];
}

export const CINEMA_LANGS = Object.keys(PACKS);
