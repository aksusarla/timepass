// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LAUNCH_DATE,
  istDateString,
  isCorrectGuess,
  normalizeTitle,
  previousDate,
  puzzleIndexFor,
  puzzleNumberFor,
} from "./daily.ts";

test("IST date flips at midnight India time, not UTC", () => {
  // 18:29 UTC = 23:59 IST, same day
  assert.equal(istDateString(new Date("2026-11-01T18:29:00Z")), "2026-11-01");
  // 18:30 UTC = 00:00 IST next day
  assert.equal(istDateString(new Date("2026-11-01T18:30:00Z")), "2026-11-02");
});

test("puzzle index advances daily and loops", () => {
  assert.equal(puzzleIndexFor(LAUNCH_DATE, 5), 0);
  assert.equal(puzzleIndexFor("2026-11-02", 5), 1);
  assert.equal(puzzleIndexFor("2026-11-06", 5), 0);
  assert.equal(puzzleIndexFor("2026-10-20", 5), 0); // before launch
  assert.equal(puzzleNumberFor(LAUNCH_DATE), 1);
  assert.equal(puzzleNumberFor("2026-11-30"), 30);
});

test("previousDate crosses month boundaries", () => {
  assert.equal(previousDate("2026-12-01"), "2026-11-30");
  assert.equal(previousDate("2027-01-01"), "2026-12-31");
});

test("guess matching is forgiving about case, spaces and punctuation", () => {
  const ans = { title: "Baahubali: The Beginning", aliases: ["bahubali"] };
  assert.ok(isCorrectGuess("baahubali the beginning", ans));
  assert.ok(isCorrectGuess("  BAHUBALI ", ans));
  assert.ok(!isCorrectGuess("Baahubali 2", ans));
  assert.ok(!isCorrectGuess("", ans));
  assert.equal(normalizeTitle("Chak De! India"), "chakdeindia");
  assert.equal(normalizeTitle("తెలుగు సినిమా"), normalizeTitle("తెలుగుసినిమా"));
});
