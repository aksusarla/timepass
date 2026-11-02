import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDeck, remember } from "./selection.ts";

const pool = Array.from({ length: 12 }, (_, i) => ({ id: `te-${i}` }));

test("no film repeats until the whole pool has been played", () => {
  let seen: string[] = [];
  const played = new Set<string>();
  for (let game = 0; game < 2; game++) {
    const deck = pickDeck(pool, 5, seen);
    assert.equal(deck.length, 5);
    for (const m of deck) {
      assert.ok(!played.has(m.id), `${m.id} repeated early`);
      played.add(m.id);
    }
    seen = remember(seen, deck.map((m) => m.id));
  }
  // Third game: only 2 unseen left, so 3 come from the films seen longest ago.
  const deck = pickDeck(pool, 5, seen).map((m) => m.id);
  const unseen = pool.map((m) => m.id).filter((id) => !played.has(id));
  for (const id of unseen) assert.ok(deck.includes(id));
  for (const id of deck.filter((id) => played.has(id))) assert.ok(seen.slice(0, 5).includes(id), "should reuse the oldest first");
});

test("order is random, not the dataset order", () => {
  const orders = new Set(Array.from({ length: 20 }, () => pickDeck(pool, 5).map((m) => m.id).join()));
  assert.ok(orders.size > 15);
});

test("history drops repeats and is capped", () => {
  assert.deepEqual(remember(["a", "b", "c"], ["b", "d"]), ["a", "c", "b", "d"]);
  assert.equal(remember([], Array.from({ length: 10 }, (_, i) => `${i}`), 4).length, 4);
});

import { nextLevel, pickNext } from "./selection.ts";
const rated = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: `e${i}`, difficulty: 1 })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, difficulty: 2 })),
  ...Array.from({ length: 2 }, (_, i) => ({ id: `h${i}`, difficulty: 3 })),
];

test("difficulty follows the room: early guesses go harder, misses go easier", () => {
  assert.equal(nextLevel(2, 4), 3);
  assert.equal(nextLevel(2, 3), 3);
  assert.equal(nextLevel(2, 2), 2);
  assert.equal(nextLevel(2, 0), 1);
  assert.equal(nextLevel(3, 4), 3, "never above hard");
  assert.equal(nextLevel(1, 0), 1, "never below easy");
});

test("next film is at the asked level, unseen, and never repeats in a game", () => {
  assert.equal(pickNext(rated, 3, [])!.difficulty, 3);
  // Both hard films seen: the closest level (medium) is used, not a repeat.
  const m = pickNext(rated, 3, ["h0", "h1"])!;
  assert.equal(m.difficulty, 2);
  // Whole bank seen: the one seen longest ago at that level comes back.
  const all = rated.map((r) => r.id);
  assert.equal(pickNext(rated, 3, ["h1", ...all.filter((x) => x !== "h1")])!.id, "h1");
  // Films already in this game are never picked again.
  assert.equal(pickNext(rated, 1, [], ["e0", "e1", "e2", "e3"])!.difficulty, 2);
});
