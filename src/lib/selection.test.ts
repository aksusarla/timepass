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
