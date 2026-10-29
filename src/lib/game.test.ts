// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCorrectGuess, normalizeTitle, pickImposterRound, shuffle, suggest } from "./game.ts";

test("guess matching is forgiving about case, spaces and punctuation", () => {
  const ans = { title: "Baahubali: The Beginning", aliases: ["bahubali"] };
  assert.ok(isCorrectGuess("baahubali the beginning", ans));
  assert.ok(isCorrectGuess("  BAHUBALI ", ans));
  assert.ok(!isCorrectGuess("Baahubali 2", ans));
  assert.ok(!isCorrectGuess("", ans));
  assert.equal(normalizeTitle("Chak De! India"), "chakdeindia");
  assert.equal(normalizeTitle("తెలుగు సినిమా"), normalizeTitle("తెలుగుసినిమా"));
});

test("suggest ranks prefix matches first and needs 2 characters", () => {
  const titles = ["Eega", "Magadheera", "Mahanati", "Rangasthalam"];
  assert.deepEqual(suggest("m", titles), []);
  assert.deepEqual(suggest("ma", titles), ["Magadheera", "Mahanati"]);
  assert.deepEqual(suggest("ra", titles), ["Rangasthalam", "Magadheera"]);
});

test("suggest also matches alternative spellings", () => {
  const titles = ["Baahubali: The Beginning", "Bommarillu"];
  const aliases = { "Baahubali: The Beginning": ["bahubali", "baahubali 1"] };
  assert.deepEqual(suggest("bahu", titles, 5, aliases), ["Baahubali: The Beginning"]);
  assert.deepEqual(suggest("bahu", titles), []);
});

test("shuffle keeps every item", () => {
  assert.deepEqual(shuffle([1, 2, 3, 4]).sort(), [1, 2, 3, 4]);
});

test("imposter is never a player who submitted the real movie", () => {
  const subs = ["Eega", "eega", "Jersey", "96", "Roja"];
  for (let i = 0; i < 500; i++) {
    const r = pickImposterRound(subs)!;
    assert.notEqual(normalizeTitle(subs[r.imposterIdx]), normalizeTitle(r.realMovie));
    assert.equal(normalizeTitle(subs[r.ownerIdx]), normalizeTitle(r.realMovie));
  }
  assert.equal(pickImposterRound(["Eega", "EEGA", "eega", "Eega"]), null);
});
