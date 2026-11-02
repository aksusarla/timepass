import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, newRoom, nextWake, setConnected, tick, view, CLUE_MS, HOST_AWAY_MS, type Action, type Puzzle, type RoomState } from "./rooms.ts";

const puzzles: Puzzle[] = Array.from({ length: 8 }, (_, i) => ({
  id: `te-${i}`,
  lang: i < 6 ? "te" : "ta",
  title: `Film ${"ABCDEFGH"[i]}`,
  aliases: [],
  year: 2000 + i,
  storyline: `Story ${i}`,
  hero: `Hero ${i}`,
  heroine: `Heroine ${i}`,
  director: `Director ${i}`,
}));
let t = 1_000;
function act(s: RoomState, by: string, a: Action) {
  const out = apply(s, by, a, (t += 10), puzzles);
  return out;
}
function ok(s: RoomState, by: string, a: Action) {
  const out = act(s, by, a);
  assert.equal(out.error, undefined, out.error);
  return out.state;
}
function lobby() {
  let s = newRoom("ABCD", t);
  s = ok(s, "h", { type: "join", name: "Abhi" });
  s = ok(s, "p1", { type: "join", name: "Sam" });
  s = ok(s, "p2", { type: "join", name: "Ravi" });
  return s;
}

test("first player hosts; players spread across teams; names must be unique", () => {
  const s = lobby();
  assert.equal(s.hostId, "h");
  assert.deepEqual(s.players.map((p) => p.team), [0, 1, 0]);
  assert.match(act(s, "p3", { type: "join", name: "sam" }).error!, /already called/);
  assert.match(act(s, "p3", { type: "join", name: "A" }).error!, /2 to 16/);
});

test("only the host can start, and it needs two teams with players", () => {
  let s = lobby();
  assert.match(act(s, "p1", { type: "start" }).error!, /Only the host/);
  s = ok(s, "p1", { type: "setTeam", team: 0 });
  assert.match(act(s, "h", { type: "start" }).error!, /at least 2 teams/);
  s = ok(s, "p1", { type: "setTeam", team: 1 });
  s = ok(s, "h", { type: "configure", pool: "te", rounds: 5 });
  s = ok(s, "h", { type: "start" });
  assert.equal(s.phase, "clue");
  assert.equal(s.deck.length, 5);
  assert.ok(s.deck.every((id) => puzzles.find((m) => m.id === id)!.lang === "te"));
});

test("the answer is never sent before the reveal; clues appear one at a time", () => {
  let s = ok(lobby(), "h", { type: "start" });
  const v = view(s, "p1", t, puzzles);
  const movie = puzzles.find((m) => m.id === s.deck[0])!;
  assert.equal(v.answer, null);
  assert.equal(v.clues.length, 1);
  assert.ok(!JSON.stringify(v).includes(movie.title), "title leaked");
  assert.ok(!JSON.stringify(v).includes(movie.hero), "later clue leaked");
  s = ok(s, "h", { type: "nextClue" });
  assert.equal(view(s, "p1", t, puzzles).clues.length, 2);
});

test("wrong guess locks only that team; a right guess scores by clue and reveals", () => {
  let s = ok(lobby(), "h", { type: "start" });
  const movie = puzzles.find((m) => m.id === s.deck[0])!;
  s = ok(s, "p1", { type: "guess", title: "Not it" });
  assert.deepEqual(s.locked, [1]);
  assert.match(act(s, "p1", { type: "guess", title: movie.title }).error!, /already guessed/);
  s = ok(s, "p2", { type: "guess", title: movie.title.toLowerCase() });
  assert.equal(s.phase, "reveal");
  assert.deepEqual(s.results[0], { movieId: movie.id, team: 0, points: 4, by: "Ravi" });
  const v = view(s, "p1", t, puzzles);
  assert.equal(v.answer!.title, movie.title);
  assert.equal(v.teams[0].score, 4);
});

test("when every team is locked, the next clue opens at once", () => {
  let s = ok(lobby(), "h", { type: "start" });
  s = ok(s, "p1", { type: "guess", title: "Nope" });
  s = ok(s, "h", { type: "guess", title: "Nope again" });
  assert.equal(s.clue, 1);
  assert.deepEqual(s.locked, []);
});

test("timer moves the clue on; after the last clue nobody scores", () => {
  let s = ok(lobby(), "h", { type: "start" });
  assert.equal(nextWake(s), s.clueEndsAt);
  for (let i = 0; i < 4; i++) s = tick(s, s.clueEndsAt! + 1);
  assert.equal(s.phase, "reveal");
  assert.deepEqual(s.results[0].team, null);
  assert.equal(tick(s, t + CLUE_MS * 10), s, "no change outside a clue");
});

test("game ends after the last round; play again keeps players and avoids repeats", () => {
  let s = ok(lobby(), "h", { type: "configure", pool: "te", rounds: 5 });
  s = ok(s, "h", { type: "start" });
  const first = [...s.deck];
  for (let r = 0; r < 5; r++) {
    s = ok(s, "h", { type: "reveal" });
    s = ok(s, "h", { type: "nextRound" });
  }
  assert.equal(s.phase, "over");
  s = ok(s, "h", { type: "playAgain" });
  assert.equal(s.players.length, 3);
  s = ok(s, "h", { type: "start" });
  const fresh = s.deck.filter((id) => !first.includes(id));
  assert.equal(fresh.length, 1, "the one unplayed Telugu film comes first");
});

test("rejoin keeps the seat; host can be taken over only after a minute away", () => {
  let s = lobby();
  s = setConnected(s, "h", false, t);
  s = ok(s, "h", { type: "join", name: "Abhi" });
  assert.equal(s.players.length, 3);
  assert.equal(s.players[0].connected, true);
  s = setConnected(s, "h", false, t);
  assert.match(act(s, "p1", { type: "claimHost" }).error!, /still here/);
  const out = apply(s, "p1", { type: "claimHost" }, t + HOST_AWAY_MS + 1, puzzles);
  assert.equal(out.state.hostId, "p1");
});
