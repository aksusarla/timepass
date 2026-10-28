"use client";

import { useEffect, useRef, useState } from "react";
import { LANGS, MOVIES, poolFor, type Lang, type Movie } from "@/content/movies";
import { shuffle } from "@/lib/game";
import { track } from "@/lib/analytics";
import { usePersistentState } from "@/lib/store";
import { beep, buzz, unlockAudio, useWakeLock } from "@/lib/device";
import { Board, Countdown, GameTools, HowToPlay, NameList, Seg, Words, speak, stopSpeaking } from "./ui";

// PRD section 7: storyline -> hero -> heroine -> director -> reveal.
const CLUES: { key: keyof Movie; label: string; pts: number }[] = [
  { key: "storyline", label: "The story", pts: 4 },
  { key: "hero", label: "Hero", pts: 3 },
  { key: "heroine", label: "Heroine", pts: 2 },
  { key: "director", label: "Director", pts: 1 },
];
const CLUE_SECONDS = 20;
const UNDO_MS = 5000;

type Pool = "te" | "ta" | "both";
type Setup = { pool: Pool; rounds: 5 | 10; teams: string[] };
type RoundResult = { movieId: string; winner: string | null; points: number };
type Award = { winner: string | null; points: number };

/** Everything needed to resume after a refresh. Saved on this phone. */
type MGState = {
  setup: Setup;
  phase: "setup" | "playing" | "final";
  deckIds: string[];
  results: RoundResult[];
  clue: number; // index into CLUES for the current round
  award: Award | null; // set once the current round is decided
  sound: boolean;
};

export const MG_KEY = "game:movie-guess";

const INITIAL: MGState = {
  setup: { pool: "te", rounds: 5, teams: ["Team A", "Team B"] },
  phase: "setup",
  deckIds: [],
  results: [],
  clue: 0,
  award: null,
  sound: true,
};

const byId = (id: string) => MOVIES.find((m) => m.id === id);
const poolLabel = (p: Pool) => (p === "both" ? "Telugu + Tamil" : LANGS.find((l) => l.code === p)!.name);

export default function MovieGuess() {
  const [s, setS] = usePersistentState<MGState>(MG_KEY, INITIAL);
  const deck = s.deckIds.map(byId).filter((m): m is Movie => !!m);
  useWakeLock(s.phase === "playing");

  function start(setup: Setup) {
    unlockAudio();
    const langs: Lang[] = setup.pool === "both" ? ["te", "ta"] : [setup.pool];
    const deckIds = shuffle(poolFor(langs)).slice(0, setup.rounds).map((m) => m.id);
    setS({ ...s, setup, phase: "playing", deckIds, results: [], clue: 0, award: null });
    track("game_started", { game: "movie_guess", mode: "same_room", language_pool: setup.pool, teams: setup.teams.length, rounds: deckIds.length });
  }

  const scores = s.setup.teams.map((name) => ({
    name,
    score: s.results.filter((r) => r.winner === name).reduce((a, r) => a + r.points, 0),
  }));

  if (s.phase === "setup" || deck.length === 0) {
    return <SetupScreen setup={s.setup} setSetup={(setup) => setS({ ...s, setup })} onStart={start} />;
  }

  if (s.phase === "final") {
    return (
      <Final
        scores={scores}
        onAgain={() => {
          track("play_again", { next_game: "movie_guess" });
          start(s.setup);
        }}
        onSetup={() => setS({ ...s, phase: "setup" })}
      />
    );
  }

  const idx = s.results.length;
  const movie = deck[idx];
  return (
    <Round
      key={movie.id}
      movie={movie}
      number={idx + 1}
      total={deck.length}
      teams={s.setup.teams}
      scores={scores}
      clue={s.clue}
      award={s.award}
      sound={s.sound}
      setSound={(sound) => setS({ ...s, sound })}
      onNextClue={() => {
        track("clue_played", { game: "movie_guess", clue_index: s.clue + 2 });
        setS({ ...s, clue: s.clue + 1 });
      }}
      onAward={(award) => {
        track("answer_submitted", { game: "movie_guess", correct: !!award.winner, clue_index: s.clue + 1, input_script: "spoken" });
        setS({ ...s, award });
      }}
      onUndo={() => setS({ ...s, award: null })}
      onNext={() => {
        const results = [...s.results, { movieId: movie.id, winner: s.award?.winner ?? null, points: s.award?.points ?? 0 }];
        const done = results.length >= deck.length;
        if (done) track("game_completed", { game: "movie_guess", rounds: results.length });
        setS({ ...s, results, clue: 0, award: null, phase: done ? "final" : "playing" });
      }}
      onEnd={() => setS({ ...s, phase: "setup", deckIds: [], results: [], clue: 0, award: null })}
    />
  );
}

/* ---------- Setup: one big Start, settings below (PRD MG-1) ---------- */

function SetupScreen({ setup, setSetup, onStart }: { setup: Setup; setSetup: (s: Setup) => void; onStart: (s: Setup) => void }) {
  const poolSize = poolFor(setup.pool === "both" ? ["te", "ta"] : [setup.pool]).length;
  const rounds = Math.min(setup.rounds, poolSize) as 5 | 10;
  return (
    <div className="rise setup">
      <div className="screen-head">
        <span className="meta">Movie Guess</span>
        <h2 className="title">
          <Words text="Guess the film from the clues." />
        </h2>
        <p className="muted">One phone runs the game. Read each clue out, and tap the team that shouts the right answer first.</p>
      </div>

      <HowToPlay
        id="movie-guess"
        title="How to play"
        steps={[
          "The host reads the story clue out loud (or taps Read aloud).",
          "Nobody got it? Tap Next clue for the hero, then heroine, then director.",
          "Tap the team that guessed right. Earlier clues score more: 4, 3, 2, 1.",
        ]}
      />

      <div className="panel stack">
        <button className="btn block xl" onClick={() => onStart({ ...setup, rounds })}>
          Start game
        </button>
        <p className="summary">
          {setup.teams.length} teams · {rounds} rounds · {poolLabel(setup.pool)} films
        </p>
      </div>

      <details className="settings" open={false}>
        <summary>Change teams and settings</summary>
        <div className="stack" style={{ gap: 20, paddingTop: 16 }}>
          <div className="stack">
            <span className="label">Teams · tap a name to rename</span>
            <NameList names={setup.teams} setNames={(teams) => setSetup({ ...setup, teams })} min={2} max={6} noun="a team" />
          </div>
          <div className="stack">
            <span className="label">Films from</span>
            <Seg<Pool>
              label="Movie pool"
              value={setup.pool}
              onChange={(pool) => setSetup({ ...setup, pool })}
              options={[...LANGS.map((l) => ({ value: l.code as Pool, label: l.name })), { value: "both", label: "Both" }]}
            />
          </div>
          <div className="stack">
            <span className="label">Rounds</span>
            <Seg<5 | 10>
              label="Rounds"
              value={rounds}
              onChange={(r) => setSetup({ ...setup, rounds: r })}
              options={[
                { value: 5, label: "5 · about 8 min" },
                { value: 10, label: "10 · about 15 min", disabled: poolSize < 10 },
              ]}
            />
          </div>
          <div className="stack">
            <span className="label">Mode</span>
            <Seg label="Mode" value="room" onChange={() => {}} options={[{ value: "room", label: "Same room" }, { value: "online", label: "Online · coming soon", disabled: true }]} />
          </div>
        </div>
      </details>
    </div>
  );
}

/* ---------- Clue timer: owns its countdown, restarts per clue ---------- */

function ClueTimer({ sound, paused }: { sound: boolean; paused: boolean }) {
  const [left, setLeft] = useState(CLUE_SECONDS);
  useEffect(() => {
    if (paused || left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left, paused]);
  // Cues fire on the transition into each second, not on every render.
  const last = useRef(left);
  useEffect(() => {
    if (last.current === left) return;
    last.current = left;
    if (left === 0) {
      if (sound) beep("end");
      buzz([80, 60, 80]);
    } else if (left <= 3 && sound) beep("tick");
  }, [left, sound]);
  return <Countdown left={left} total={CLUE_SECONDS} />;
}

/* ---------- One round ---------- */

function Round({
  movie,
  number,
  total,
  teams,
  scores,
  clue,
  award,
  sound,
  setSound,
  onNextClue,
  onAward,
  onUndo,
  onNext,
  onEnd,
}: {
  movie: Movie;
  number: number;
  total: number;
  teams: string[];
  scores: { name: string; score: number }[];
  clue: number;
  award: Award | null;
  sound: boolean;
  setSound: (v: boolean) => void;
  onNextClue: () => void;
  onAward: (a: Award) => void;
  onUndo: () => void;
  onNext: () => void;
  onEnd: () => void;
}) {
  const [undoable, setUndoable] = useState(false);
  const lang = LANGS.find((l) => l.code === movie.lang)!;
  const revealed = award !== null;

  useEffect(() => {
    if (!undoable) return;
    const t = setTimeout(() => setUndoable(false), UNDO_MS);
    return () => clearTimeout(t);
  }, [undoable]);
  useEffect(() => () => stopSpeaking(), []);

  function give(winner: string | null) {
    stopSpeaking();
    onAward({ winner, points: winner ? CLUES[clue].pts : 0 });
    setUndoable(true);
    if (winner) {
      if (sound) beep("win");
      buzz(40);
    }
  }

  const preview = award?.winner ? scores.map((x) => (x.name === award.winner ? { ...x, score: x.score + award.points } : x)) : scores;

  return (
    <div className="rise round">
      <div className="round-top">
        <span className="meta">
          Round {number} of {total} · {lang.name}
        </span>
        <GameTools sound={sound} setSound={setSound} onEnd={onEnd} />
      </div>

      {!revealed ? (
        <div className="round-grid">
          <div className="round-main">
            <ol className="ladder">
              {CLUES.map((c, i) => (
                <li key={c.key} className={i === clue ? "on" : i > clue ? "locked" : undefined}>
                  <span className="label">
                    {c.label} · {c.pts} {c.pts === 1 ? "pt" : "pts"}
                  </span>
                  <div className="clue">{i <= clue ? String(movie[c.key]) : "Hidden"}</div>
                </li>
              ))}
            </ol>
          </div>
          <div className="round-side">
            <div className="timer-row">
              <ClueTimer key={clue} sound={sound} paused={false} />
              <div>
                <span className="label">Clue {clue + 1} of 4</span>
                <p className="worth">Worth {CLUES[clue].pts}</p>
              </div>
            </div>
            <span className="label">Who got it?</span>
            <div className="award">
              {teams.map((t) => (
                <button key={t} className="btn" onClick={() => give(t)}>
                  {t}
                  <small>+{CLUES[clue].pts}</small>
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn ghost" onClick={() => speak(`${CLUES[clue].label}. ${movie[CLUES[clue].key]}`)}>
                Read aloud
              </button>
              {clue < CLUES.length - 1 ? (
                <button className="btn ghost" onClick={onNextClue}>
                  Next clue
                </button>
              ) : (
                <button className="btn ghost" onClick={() => give(null)}>
                  Reveal
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="round-grid">
          <div className="round-main panel">
            <span className="label">{award.winner ? `${award.winner} got it · +${award.points}` : "Nobody got it"}</span>
            <div className="reveal-title">
              <Words text={movie.title} />
            </div>
            <div className="facts">
              <span>
                <b>{movie.year}</b> · {movie.genre}
              </span>
              <span>
                Hero <b>{movie.hero}</b>
              </span>
              <span>
                Heroine <b>{movie.heroine}</b>
              </span>
              <span>
                Director <b>{movie.director}</b>
              </span>
            </div>
          </div>
          <div className="round-side stack">
            <Board rows={preview} big />
            <div className="row">
              {undoable && (
                <button
                  className="btn ghost"
                  onClick={() => {
                    onUndo();
                    setUndoable(false);
                  }}
                >
                  Undo
                </button>
              )}
              <button className="btn" onClick={onNext}>
                {number < total ? "Next round" : "See final scores"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Final ---------- */

function Final({ scores, onAgain, onSetup }: { scores: { name: string; score: number }[]; onAgain: () => void; onSetup: () => void }) {
  const top = Math.max(...scores.map((x) => x.score));
  const winners = scores.filter((x) => x.score === top).map((x) => x.name);
  const headline = top === 0 ? "Nobody scored. Tough crowd." : winners.length > 1 ? `${winners.join(" and ")} tie!` : `${winners[0]} wins!`;
  return (
    <div className="rise">
      <div className="screen-head">
        <span className="meta">Movie Guess · Final scores</span>
        <div className="pass">
          <Words text={headline} />
          <span className="g" style={{ display: "block" }}>
            <Words text="Another round?" />
          </span>
        </div>
      </div>
      <div className="panel stack">
        <Board rows={scores} big />
        <div className="row">
          <button className="btn ghost" onClick={onSetup}>
            Change teams
          </button>
          <button className="btn" onClick={onAgain}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
