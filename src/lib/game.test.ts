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

test("search index ranks by fame, matches spellings and native script, hides excluded", async () => {
  const { buildIndex, searchTitles } = await import("./game.ts");
  const idx = buildIndex([
    ["RRR", 2022, ["ఆర్.ఆర్.ఆర్."]],
    ["Baahubali: The Beginning", 2015, ["bahubali"]],
    ["Bahubali (1990 film)", 1990],
    ["Rangasthalam", 2018],
    ["RRR", 1999], // duplicate title: first (more famous) wins
  ]);
  assert.equal(idx.titles.length, 4);
  assert.deepEqual(searchTitles("ba", idx).map((r) => r.title), ["Baahubali: The Beginning", "Bahubali (1990 film)"]);
  assert.deepEqual(searchTitles("ఆర్", idx).map((r) => r.title), ["RRR"]);
  assert.deepEqual(searchTitles("ra", idx, 5, new Set(["Rangasthalam"])), []);
  assert.deepEqual(searchTitles("r", idx), []);
});

test("a one-letter title like the Tamil film I can be found", async () => {
  const { buildIndex, searchTitles } = await import("./game.ts");
  const idx = buildIndex([["Indian", 1996], ["I", 2015], ["Ice", 2000]]);
  assert.deepEqual(searchTitles("i", idx).map((r) => r.title), ["I"]);
  assert.equal(searchTitles("in", idx)[0].title, "Indian");
});
