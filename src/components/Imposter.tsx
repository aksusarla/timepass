"use client";

import { useState } from "react";
import { LANGS, titlesFor, type Lang } from "@/content/movies";
import { normalizeTitle, pickImposterRound, shuffle } from "@/lib/game";
import { track } from "@/lib/analytics";
import { Board, NameList, Seg, TitleInput } from "./ui";

// PRD section 8, played pass-and-play on one phone. The online version will
// hold the real movie and the imposter on the server instead.

type Pool = "te" | "ta" | "both";
type Phase =
  | { kind: "setup" }
  | { kind: "submit"; i: number; open: boolean; subs: string[] }
  | { kind: "reveal"; i: number; open: boolean }
  | { kind: "clues" }
  | { kind: "vote" }
  | { kind: "steal" }
  | { kind: "result"; caught: boolean; stole: boolean | null; guess?: string };

type RoundState = { subs: string[]; realMovie: string; ownerIdx: number; imposterIdx: number; order: number[] };

export default function Imposter() {
  const [players, setPlayers] = useState<string[]>([]);
  const [pool, setPool] = useState<Pool>("te");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [round, setRound] = useState<RoundState | null>(null);
  const [roundNo, setRoundNo] = useState(0);
  const [note, setNote] = useState("");

  const langs: Lang[] = pool === "both" ? ["te", "ta"] : [pool];
  const titles = titlesFor(langs);

  function begin() {
    setNote("");
    setRoundNo((n) => n + 1);
    setPhase({ kind: "submit", i: 0, open: false, subs: [] });
    track("game_started", { game: "imposter", mode: "same_room", player_count: players.length, language_pool: pool });
  }

  function submitted(subs: string[]) {
    const pick = pickImposterRound(subs);
    if (!pick) {
      setNote("Everyone picked the same movie, so there can't be an imposter. Pick again!");
      setPhase({ kind: "submit", i: 0, open: false, subs: [] });
      return;
    }
    setRound({ subs, ...pick, order: shuffle(players.map((_, i) => i)) });
    setPhase({ kind: "reveal", i: 0, open: false });
  }

  function finish(caught: boolean, stole: boolean | null, guess?: string) {
    if (!round) return;
    const next = { ...scores };
    const imp = players[round.imposterIdx];
    if (caught && !stole) players.forEach((p, i) => i !== round.imposterIdx && (next[p] = (next[p] ?? 0) + 1));
    else if (caught && stole) next[imp] = (next[imp] ?? 0) + 2;
    else next[imp] = (next[imp] ?? 0) + 3;
    setScores(next);
    setPhase({ kind: "result", caught, stole, guess });
    track("round_completed", { game: "imposter", caught, stole: !!stole });
  }

  const name = (i: number) => players[i];

  /* ----- Setup ----- */
  if (phase.kind === "setup") {
    return (
      <div className="rise">
        <div className="screen-head">
          <span className="meta">G-02 / Setup</span>
          <h2 className="title">Imposter Movie</h2>
          <p className="muted">Everyone secretly picks a movie. One becomes the real movie. One player, never its owner, is the imposter and sees their own pick instead. They might not even know.</p>
        </div>
        <div className="panel stack">
          <span className="label">Mode</span>
          <Seg label="Mode" value="room" onChange={() => {}} options={[{ value: "room", label: "Pass & play" }, { value: "online", label: "Online · soon", disabled: true }]} />
        </div>
        <div className="panel stack">
          <span className="label">Suggest movies from</span>
          <Seg<Pool>
            label="Movie pool"
            value={pool}
            onChange={setPool}
            options={[...LANGS.map((l) => ({ value: l.code as Pool, label: `${l.native} ${l.name}` })), { value: "both", label: "Both" }]}
          />
        </div>
        <div className="panel stack">
          <div className="sec-head" style={{ margin: 0 }}>
            <span className="label">Players</span>
            <span className="label">{players.length} / 12 · min 4</span>
          </div>
          <NameList names={players} setNames={setPlayers} min={0} max={12} noun="a player" />
        </div>
        <div className="panel stack">
          <button className="btn block" disabled={players.length < 4} onClick={begin}>
            {players.length < 4 ? `Add ${4 - players.length} more player${players.length === 3 ? "" : "s"}` : "Start round"}
          </button>
        </div>
      </div>
    );
  }

  /* ----- Submit: pass the phone, pick secretly ----- */
  if (phase.kind === "submit") {
    const p = name(phase.i);
    return (
      <div className="rise" key={`s${phase.i}${phase.open}`}>
        <Head step="Pick a movie" sub={`${phase.i + 1} of ${players.length}`} round={roundNo} />
        {note && phase.i === 0 && <p className="note" style={{ marginBottom: 16 }}><b>Oops.</b> {note}</p>}
        {!phase.open ? (
          <PassTo name={p} action={`I'm ${p}`} onGo={() => setPhase({ ...phase, open: true })} />
        ) : (
          <div className="panel stack">
            <p style={{ fontWeight: 700, fontSize: "var(--step-2)" }}>{p}, pick any movie. Keep it secret.</p>
            <TitleInput
              titles={titles}
              allowFreeText
              autoFocus
              placeholder="Type a movie name"
              onPick={(t) => {
                const subs = [...phase.subs, t];
                if (subs.length >= players.length) submitted(subs);
                else setPhase({ kind: "submit", i: phase.i + 1, open: false, subs });
              }}
            />
            <p className="small muted">Your pick stays hidden. The phone moves on the moment you choose.</p>
          </div>
        )}
      </div>
    );
  }

  if (!round) return null;

  /* ----- Reveal: identical screen for everyone ----- */
  if (phase.kind === "reveal") {
    const i = phase.i;
    const seen = i === round.imposterIdx ? round.subs[i] : round.realMovie;
    const last = i === players.length - 1;
    return (
      <div className="rise" key={`r${i}${phase.open}`}>
        <Head step="See your movie" sub={`${i + 1} of ${players.length}`} round={roundNo} />
        {!phase.open ? (
          <PassTo name={name(i)} action="Show my movie" onGo={() => setPhase({ ...phase, open: true })} />
        ) : (
          <div className="panel stack">
            <div className="secret">
              <span className="label">{name(i)} · your movie</span>
              <div className="big">{seen}</div>
              <span className="small muted">Never say “that’s my movie”.</span>
            </div>
            <button className="btn block" onClick={() => setPhase(last ? { kind: "clues" } : { kind: "reveal", i: i + 1, open: false })}>
              {last ? "Hide · everyone’s seen it" : "Hide & pass on"}
            </button>
          </div>
        )}
      </div>
    );
  }

  /* ----- Clues: spoken aloud, phone shows the order ----- */
  if (phase.kind === "clues") {
    return (
      <div className="rise">
        <Head step="Clue time" sub="2 rounds" round={roundNo} />
        <div className="panel stack">
          <p className="lede" style={{ fontSize: "var(--step-2)", maxWidth: "none" }}>
            <b>Go round twice in this order.</b> Each player says one word about their movie. Out loud, no repeats.
          </p>
          <ol className="ladder" style={{ marginTop: 8 }}>
            {round.order.map((i) => (
              <li key={i}>
                <div className="clue">{name(i)}</div>
              </li>
            ))}
          </ol>
          <p className="note">Most of you saw someone else’s pick and know you’re safe. Two of you saw your own. Only one of those two is innocent.</p>
          <button className="btn block" onClick={() => setPhase({ kind: "vote" })}>
            Clues done · vote
          </button>
        </div>
      </div>
    );
  }

  /* ----- Vote: point on three, host taps the result ----- */
  if (phase.kind === "vote") {
    return (
      <div className="rise">
        <Head step="Vote" sub="Point on three" round={roundNo} />
        <div className="panel stack">
          <p style={{ fontWeight: 700, fontSize: "var(--step-2)" }}>Everyone points at their suspect. Who got the most votes?</p>
          <div className="award">
            {players.map((p, i) => (
              <button
                key={p}
                className="btn ghost"
                onClick={() => {
                  track("vote_cast", { game: "imposter", round: roundNo });
                  if (i === round.imposterIdx) setPhase({ kind: "steal" });
                  else finish(false, null);
                }}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn ghost block" onClick={() => finish(false, null)}>
            It’s a tie · nobody caught
          </button>
        </div>
      </div>
    );
  }

  /* ----- Steal: the caught imposter guesses the real movie ----- */
  if (phase.kind === "steal") {
    const imp = name(round.imposterIdx);
    return (
      <div className="rise">
        <Head step="Caught!" sub="One guess to steal" round={roundNo} />
        <div className="panel stack">
          <div className="pass">
            {imp} was the imposter.
            <span className="g" style={{ display: "block" }}>Steal for +2?</span>
          </div>
          <p className="muted">{imp}, you saw “{round.subs[round.imposterIdx]}”. Everyone else saw a different movie. Name it to steal the round.</p>
          <TitleInput
            titles={titles}
            allowFreeText
            placeholder="Your guess"
            onPick={(g) => finish(true, normalizeTitle(g) === normalizeTitle(round.realMovie), g)}
          />
        </div>
      </div>
    );
  }

  /* ----- Result ----- */
  const imp = name(round.imposterIdx);
  const verdict = !phase.caught
    ? `${imp} got away with it. +3`
    : phase.stole
      ? `${imp} was caught, then stole it. +2`
      : `${imp} was caught. Everyone else +1`;
  return (
    <div className="rise">
      <Head step="Result" sub="" round={roundNo} />
      <div className="panel stack">
        <span className="label">The real movie · {name(round.ownerIdx)}’s pick</span>
        <div className="reveal-title">{round.realMovie}</div>
        <div className="facts">
          <span>Imposter <b>{imp}</b></span>
          <span>Imposter saw <b>{round.subs[round.imposterIdx]}</b></span>
          {phase.guess && <span>Steal guess <b>{phase.guess}</b></span>}
        </div>
        <p className="note"><b>{verdict}</b></p>
      </div>
      <div className="panel stack">
        <Board rows={players.map((p) => ({ name: p, score: scores[p] ?? 0 }))} />
        <div className="row">
          <button className="btn ghost" onClick={() => setPhase({ kind: "setup" })}>
            Change players
          </button>
          <button
            className="btn"
            onClick={() => {
              track("play_again", { next_game: "imposter" });
              begin();
            }}
          >
            Next round
          </button>
        </div>
      </div>
    </div>
  );
}

function Head({ step, sub, round }: { step: string; sub: string; round: number }) {
  return (
    <div className="screen-head">
      <div className="sec-head" style={{ margin: 0 }}>
        <span className="meta">G-02 / Round {String(round).padStart(2, "0")}</span>
        <span className="meta">{sub}</span>
      </div>
      <h2 className="title">{step}</h2>
    </div>
  );
}

function PassTo({ name, action, onGo }: { name: string; action: string; onGo: () => void }) {
  return (
    <div className="panel stack">
      <div className="pass">
        <span className="g">Pass the phone to</span>
        <span style={{ display: "block" }}>{name}.</span>
      </div>
      <p className="muted">Everyone else, look away.</p>
      <button className="btn block" onClick={onGo}>
        {action}
      </button>
    </div>
  );
}
