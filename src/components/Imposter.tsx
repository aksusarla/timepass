"use client";

import { useState } from "react";
import { LANGS, titlesFor, type Lang } from "@/content/movies";
import { normalizeTitle, pickImposterRound, shuffle } from "@/lib/game";
import { track } from "@/lib/analytics";
import { usePersistentState } from "@/lib/store";
import { unlockAudio, useWakeLock } from "@/lib/device";
import { Board, GameTools, HoldReveal, HowToPlay, NameList, Seg, TitleInput, Words } from "./ui";

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

type IMState = {
  players: string[];
  pool: Pool;
  scores: Record<string, number>;
  phase: Phase;
  round: RoundState | null;
  roundNo: number;
  note: string;
};

export const IM_KEY = "game:imposter";

const INITIAL: IMState = { players: [], pool: "te", scores: {}, phase: { kind: "setup" }, round: null, roundNo: 0, note: "" };

export default function Imposter() {
  const [s, setS] = usePersistentState<IMState>(IM_KEY, INITIAL);
  const { players, pool, scores, phase, round, roundNo, note } = s;
  const set = (patch: Partial<IMState>) => setS({ ...s, ...patch });
  useWakeLock(phase.kind !== "setup");

  const langs: Lang[] = pool === "both" ? ["te", "ta"] : [pool];
  const titles = titlesFor(langs);
  const name = (i: number) => players[i];
  const endGame = () => setS({ ...INITIAL, players, pool });

  function begin() {
    unlockAudio();
    set({ note: "", roundNo: roundNo + 1, phase: { kind: "submit", i: 0, open: false, subs: [] }, round: null });
    track("game_started", { game: "imposter", mode: "same_room", player_count: players.length, language_pool: pool });
  }

  function submitted(subs: string[]) {
    const pick = pickImposterRound(subs);
    if (!pick) {
      set({ note: "Everyone picked the same movie, so nobody can be the imposter. Pick again!", phase: { kind: "submit", i: 0, open: false, subs: [] } });
      return;
    }
    set({ round: { subs, ...pick, order: shuffle(players.map((_, i) => i)) }, phase: { kind: "reveal", i: 0, open: false } });
  }

  function finish(caught: boolean, stole: boolean | null, guess?: string) {
    if (!round) return;
    const next = { ...scores };
    const imp = players[round.imposterIdx];
    if (caught && !stole) players.forEach((p, i) => i !== round.imposterIdx && (next[p] = (next[p] ?? 0) + 1));
    else if (caught && stole) next[imp] = (next[imp] ?? 0) + 2;
    else next[imp] = (next[imp] ?? 0) + 3;
    set({ scores: next, phase: { kind: "result", caught, stole, guess } });
    track("round_completed", { game: "imposter", caught, stole: !!stole });
  }

  /* ----- Setup ----- */
  if (phase.kind === "setup") {
    const need = Math.max(0, 4 - players.length);
    return (
      <div className="rise setup">
        <div className="screen-head">
          <span className="meta">Imposter Movie</span>
          <h2 className="title">
            <Words text="Find the player with the wrong movie." />
          </h2>
          <p className="muted">Pass one phone around. Everyone secretly picks a film, then one player ends up seeing a different one.</p>
        </div>

        <HowToPlay
          id="imposter"
          title="How to play"
          steps={[
            "Pass the phone. Each player secretly types any well-known movie.",
            "Everyone then holds the screen to see “your movie”. One player, the imposter, sees their own pick instead of the real one, and two of you will see your own pick.",
            "Go round twice, one word each about your movie. Then point at the imposter. If caught, they get one guess at the real movie.",
          ]}
        />

        <div className="panel stack">
          <div className="sec-head" style={{ margin: 0 }}>
            <span className="label">Players · tap a name to rename</span>
            <span className="label">{players.length} of 4–12</span>
          </div>
          <NameList names={players} setNames={(p) => set({ players: p })} min={0} max={12} noun="a player" />
        </div>
        <div className="panel stack">
          <button className="btn block xl" disabled={need > 0} onClick={begin}>
            {need > 0 ? `Add ${need} more player${need === 1 ? "" : "s"} to start` : "Start round"}
          </button>
          {Object.keys(scores).length > 0 && (
            <button type="button" className="link" onClick={() => set({ scores: {} })}>
              Reset scores
            </button>
          )}
        </div>
        <details className="settings">
          <summary>Settings</summary>
          <div className="stack" style={{ gap: 20, paddingTop: 16 }}>
            <div className="stack">
              <span className="label">Suggest films from</span>
              <Seg<Pool>
                label="Movie pool"
                value={pool}
                onChange={(p) => set({ pool: p })}
                options={[...LANGS.map((l) => ({ value: l.code as Pool, label: l.name })), { value: "both", label: "Both" }]}
              />
            </div>
            <div className="stack">
              <span className="label">Mode</span>
              <Seg label="Mode" value="room" onChange={() => {}} options={[{ value: "room", label: "Pass & play" }, { value: "online", label: "Online · coming soon", disabled: true }]} />
            </div>
          </div>
        </details>
      </div>
    );
  }

  const tools = <GameTools onEnd={endGame} />;

  /* ----- Submit: pass the phone, pick secretly ----- */
  if (phase.kind === "submit") {
    const p = name(phase.i);
    return (
      <div className="rise" key={`s${phase.i}${phase.open}`}>
        <Head step="Pick a movie" sub={`Player ${phase.i + 1} of ${players.length}`} round={roundNo} tools={tools} />
        {note && phase.i === 0 && (
          <p className="note" style={{ marginBottom: 16 }}>
            <b>Oops.</b> {note}
          </p>
        )}
        {!phase.open ? (
          <PassTo name={p} action={`I'm ${p}`} onGo={() => set({ phase: { ...phase, open: true } })} />
        ) : (
          <div className="panel stack">
            <p className="ask">{p}, pick any well-known movie. Keep it secret.</p>
            <TitleInput
              titles={titles}
              allowFreeText
              autoFocus
              placeholder="Type a movie name"
              onPick={(t) => {
                const subs = [...phase.subs, t];
                if (subs.length >= players.length) submitted(subs);
                else set({ phase: { kind: "submit", i: phase.i + 1, open: false, subs } });
              }}
            />
            <p className="small muted">Pick something everyone has heard of, or nobody can give clues. The phone moves on as soon as you choose.</p>
          </div>
        )}
      </div>
    );
  }

  if (!round) return null;

  /* ----- Reveal: press and hold, identical for everyone ----- */
  if (phase.kind === "reveal") {
    const i = phase.i;
    const seen = i === round.imposterIdx ? round.subs[i] : round.realMovie;
    const last = i === players.length - 1;
    return (
      <div className="rise" key={`r${i}${phase.open}`}>
        <Head step="See your movie" sub={`Player ${i + 1} of ${players.length}`} round={roundNo} tools={tools} />
        {!phase.open ? (
          <PassTo name={name(i)} action={`I'm ${name(i)}`} onGo={() => set({ phase: { ...phase, open: true } })} />
        ) : (
          <RevealStep
            player={name(i)}
            secret={seen}
            lastLabel={last ? "Done · everyone has seen" : "Done · pass the phone on"}
            onDone={() => set({ phase: last ? { kind: "clues" } : { kind: "reveal", i: i + 1, open: false } })}
          />
        )}
      </div>
    );
  }

  /* ----- Clues: spoken aloud, phone shows the order ----- */
  if (phase.kind === "clues") {
    return (
      <div className="rise">
        <Head step="Clue time" sub="2 rounds" round={roundNo} tools={tools} />
        <div className="panel stack">
          <p className="ask">Go round twice in this order. One word each about your movie, out loud. No repeats.</p>
          <ol className="ladder" style={{ marginTop: 8 }}>
            {round.order.map((i) => (
              <li key={i}>
                <div className="clue">{name(i)}</div>
              </li>
            ))}
          </ol>
          <p className="note">Never say “that’s my movie”. Two of you saw your own pick, and only one of you is innocent.</p>
          <button className="btn block xl" onClick={() => set({ phase: { kind: "vote" } })}>
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
        <Head step="Vote" sub="Point on three" round={roundNo} tools={tools} />
        <div className="panel stack">
          <p className="ask">On three, everyone points at their suspect. Who got the most fingers?</p>
          <div className="award">
            {players.map((p, i) => (
              <button
                key={p}
                className="btn ghost"
                onClick={() => {
                  track("vote_cast", { game: "imposter", round: roundNo });
                  if (i === round.imposterIdx) set({ phase: { kind: "steal" } });
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
        <Head step="Caught!" sub="One guess to steal" round={roundNo} tools={tools} />
        <div className="panel stack">
          <div className="pass">
            {imp} was the imposter.
            <span className="g" style={{ display: "block" }}>
              Steal for +2?
            </span>
          </div>
          <p className="muted">
            {imp}, you saw “{round.subs[round.imposterIdx]}”. Everyone else saw a different movie. Name it to steal the round.
          </p>
          <TitleInput titles={titles} allowFreeText placeholder="Your guess" onPick={(g) => finish(true, normalizeTitle(g) === normalizeTitle(round.realMovie), g)} />
        </div>
      </div>
    );
  }

  /* ----- Result ----- */
  const imp = name(round.imposterIdx);
  const verdict = !phase.caught ? `${imp} got away with it! +3` : phase.stole ? `${imp} was caught, then stole it! +2` : `${imp} was caught. Everyone else +1`;
  return (
    <div className="rise">
      <Head step="Result" sub="" round={roundNo} tools={tools} />
      <div className="round-grid">
        <div className="round-main panel stack">
          <span className="label">The real movie · {name(round.ownerIdx)}’s pick</span>
          <div className="reveal-title">
            <Words text={round.realMovie} />
          </div>
          <div className="facts">
            <span>
              Imposter <b>{imp}</b>
            </span>
            <span>
              Imposter saw <b>{round.subs[round.imposterIdx]}</b>
            </span>
            {phase.guess && (
              <span>
                Steal guess <b>{phase.guess}</b>
              </span>
            )}
          </div>
          <p className="note">
            <b>{verdict}</b>
          </p>
        </div>
        <div className="round-side stack">
          <Board rows={players.map((p) => ({ name: p, score: scores[p] ?? 0 }))} big />
          <div className="row">
            <button className="btn ghost" onClick={() => set({ phase: { kind: "setup" }, round: null })}>
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
    </div>
  );
}

function RevealStep({ player, secret, lastLabel, onDone }: { player: string; secret: string; lastLabel: string; onDone: () => void }) {
  const [seen, setSeen] = useState(false);
  return (
    <div className="panel stack">
      <HoldReveal label={`${player} · your movie`} secret={secret} onSeen={() => setSeen(true)} />
      <p className="small muted" style={{ textAlign: "center" }}>
        Never say “that’s my movie”.
      </p>
      <button className="btn block" disabled={!seen} onClick={onDone}>
        {seen ? lastLabel : "Hold the card above first"}
      </button>
    </div>
  );
}

function Head({ step, sub, round, tools }: { step: string; sub: string; round: number; tools: React.ReactNode }) {
  return (
    <div className="screen-head">
      <div className="round-top">
        <span className="meta">
          Imposter · Round {round}
          {sub ? ` · ${sub}` : ""}
        </span>
        {tools}
      </div>
      <h2 className="title">
        <Words text={step} />
      </h2>
    </div>
  );
}

function PassTo({ name, action, onGo }: { name: string; action: string; onGo: () => void }) {
  return (
    <div className="panel stack">
      <div className="pass">
        <span className="g">
          <Words text="Pass the phone to" />
        </span>
        <span style={{ display: "block" }}>
          <Words text={name} />
        </span>
      </div>
      <p className="muted">Everyone else, look away.</p>
      <button className="btn block xl" onClick={onGo}>
        {action}
      </button>
    </div>
  );
}
