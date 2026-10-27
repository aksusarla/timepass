"use client";

import { useEffect, useMemo, useState } from "react";
import { LANGS, poolFor, type Lang, type Movie } from "@/content/movies";
import { shuffle } from "@/lib/game";
import { track } from "@/lib/analytics";
import { Board, NameList, Seg, speak, stopSpeaking } from "./ui";

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

export default function MovieGuess() {
  const [setup, setSetup] = useState<Setup>({ pool: "te", rounds: 5, teams: ["Team A", "Team B"] });
  const [game, setGame] = useState<{ deck: Movie[]; results: RoundResult[] } | null>(null);

  function start(s: Setup) {
    const langs: Lang[] = s.pool === "both" ? ["te", "ta"] : [s.pool];
    const deck = shuffle(poolFor(langs)).slice(0, s.rounds);
    setGame({ deck, results: [] });
    track("game_started", { game: "movie_guess", mode: "same_room", language_pool: s.pool, teams: s.teams.length, rounds: deck.length });
  }

  if (!game) return <SetupScreen setup={setup} setSetup={setSetup} onStart={start} />;

  const scores = setup.teams.map((name) => ({
    name,
    score: game.results.filter((r) => r.winner === name).reduce((a, r) => a + r.points, 0),
  }));

  if (game.results.length >= game.deck.length) {
    return (
      <Final
        scores={scores}
        onAgain={() => {
          track("play_again", { next_game: "movie_guess" });
          start(setup);
        }}
        onSetup={() => setGame(null)}
      />
    );
  }

  const idx = game.results.length;
  return (
    <Round
      key={game.deck[idx].id}
      movie={game.deck[idx]}
      number={idx + 1}
      total={game.deck.length}
      teams={setup.teams}
      scores={scores}
      onDone={(r) => setGame({ ...game, results: [...game.results, r] })}
    />
  );
}

/* ---------- Setup (PRD MG-1) ---------- */

function SetupScreen({ setup, setSetup, onStart }: { setup: Setup; setSetup: (s: Setup) => void; onStart: (s: Setup) => void }) {
  const poolSize = poolFor(setup.pool === "both" ? ["te", "ta"] : [setup.pool]).length;
  return (
    <div className="rise">
      <div className="screen-head">
        <span className="meta">G-01 / Setup</span>
        <h2 className="title">Movie Guess</h2>
        <p className="muted">Hold this phone, read the clues out (or tap Read aloud), and award points to whoever shouts the answer first.</p>
      </div>
      <div className="panel stack">
        <span className="label">Mode</span>
        <Seg
          label="Mode"
          value="room"
          onChange={() => {}}
          options={[
            { value: "room", label: "Same room" },
            { value: "online", label: "Online · soon", disabled: true },
          ]}
        />
      </div>
      <div className="panel stack">
        <span className="label">Movies from</span>
        <Seg<Pool>
          label="Movie pool"
          value={setup.pool}
          onChange={(pool) => setSetup({ ...setup, pool })}
          options={[
            ...LANGS.map((l) => ({ value: l.code as Pool, label: `${l.native} ${l.name}` })),
            { value: "both", label: "Both" },
          ]}
        />
      </div>
      <div className="panel stack">
        <span className="label">Rounds</span>
        <Seg<5 | 10>
          label="Rounds"
          value={setup.rounds}
          onChange={(rounds) => setSetup({ ...setup, rounds })}
          options={[
            { value: 5, label: "5 rounds" },
            { value: 10, label: "10 rounds", disabled: poolSize < 10 },
          ]}
        />
      </div>
      <div className="panel stack">
        <div className="sec-head" style={{ margin: 0 }}>
          <span className="label">Teams</span>
          <span className="label">{setup.teams.length} / 6</span>
        </div>
        <NameList names={setup.teams} setNames={(teams) => setSetup({ ...setup, teams })} min={2} max={6} noun="a team" />
      </div>
      <div className="panel">
        <button className="btn block" onClick={() => onStart(setup)}>
          Start game
        </button>
      </div>
    </div>
  );
}

/* ---------- One round ---------- */

function Round({
  movie,
  number,
  total,
  teams,
  scores,
  onDone,
}: {
  movie: Movie;
  number: number;
  total: number;
  teams: string[];
  scores: { name: string; score: number }[];
  onDone: (r: RoundResult) => void;
}) {
  const [clue, setClue] = useState(0); // index into CLUES
  const [left, setLeft] = useState(CLUE_SECONDS);
  const [result, setResult] = useState<{ winner: string | null; points: number } | null>(null);
  const [undoable, setUndoable] = useState(false);

  const revealed = result !== null;
  const lang = LANGS.find((l) => l.code === movie.lang)!;

  // Clue timer; host can still skip early or wait past zero.
  useEffect(() => {
    if (revealed) return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [revealed, clue]);

  // Undo is offered for 5 seconds after awarding (PRD MG-4).
  useEffect(() => {
    if (!undoable) return;
    const t = setTimeout(() => setUndoable(false), UNDO_MS);
    return () => clearTimeout(t);
  }, [undoable]);

  useEffect(() => () => stopSpeaking(), []);

  function nextClue() {
    track("clue_played", { game: "movie_guess", clue_index: clue + 2 });
    setClue((c) => c + 1);
    setLeft(CLUE_SECONDS);
  }

  function award(winner: string | null) {
    const points = winner ? CLUES[clue].pts : 0;
    stopSpeaking();
    setResult({ winner, points });
    setUndoable(true);
    track("answer_submitted", { game: "movie_guess", correct: !!winner, clue_index: clue + 1, input_script: "spoken" });
  }

  function readAloud() {
    speak(`${CLUES[clue].label}. ${movie[CLUES[clue].key]}`);
  }

  const canUndo = result !== null && undoable;
  const preview = result?.winner
    ? scores.map((s) => (s.name === result.winner ? { ...s, score: s.score + result.points } : s))
    : scores;

  return (
    <div className="rise">
      <div className="screen-head">
        <div className="sec-head" style={{ margin: 0 }}>
          <span className="meta">Round {String(number).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
          <span className="meta">{lang.native} {lang.name}</span>
        </div>
      </div>

      {!revealed ? (
        <>
          <div className="timer" aria-hidden>
            <i style={{ transform: `scaleX(${left / CLUE_SECONDS})` }} />
          </div>
          <div className="sec-head" style={{ marginBottom: 16 }}>
            <span className="label">Clue {clue + 1} of 4 · worth {CLUES[clue].pts}</span>
            <span className="label" style={{ color: left <= 5 ? "var(--danger)" : undefined }}>
              {left > 0 ? `${left}s` : "Time’s up"}
            </span>
          </div>
          <ol className="ladder">
            {CLUES.map((c, i) => (
              <li key={c.key} className={i === clue ? "on" : i > clue ? "locked" : undefined}>
                <span className="label">
                  {c.label} · <span className="pts">{c.pts} pts</span>
                </span>
                <div className="clue">{i <= clue ? String(movie[c.key]) : "—"}</div>
              </li>
            ))}
          </ol>

          <div className="panel stack">
            <span className="label">Who got it?</span>
            <div className="award">
              {teams.map((t) => (
                <button key={t} className="btn" onClick={() => award(t)}>
                  {t}
                  <small>+{CLUES[clue].pts}</small>
                </button>
              ))}
            </div>
            <div className="row">
              <button className="btn ghost" onClick={readAloud}>
                Read aloud
              </button>
              {clue < CLUES.length - 1 ? (
                <button className="btn ghost" onClick={nextClue}>
                  Next clue
                </button>
              ) : (
                <button className="btn ghost" onClick={() => award(null)}>
                  Reveal
                </button>
              )}
            </div>
            <p className="small muted">Read aloud uses your phone&apos;s voice for now. Recorded Telugu and Tamil narration comes later.</p>
          </div>
        </>
      ) : (
        <>
          <div className="panel">
            <span className="label">{result.winner ? `${result.winner} · +${result.points}` : "Nobody got it"}</span>
            <div className="reveal-title">{movie.title}</div>
            <div className="facts">
              <span><b>{movie.year}</b> · {movie.genre}</span>
              <span>Hero <b>{movie.hero}</b></span>
              <span>Heroine <b>{movie.heroine}</b></span>
              <span>Director <b>{movie.director}</b></span>
            </div>
          </div>
          <div className="panel stack">
            <Board rows={preview} />
            <div className="row">
              {canUndo && (
                <button className="btn ghost" onClick={() => {
                    setResult(null);
                    setUndoable(false);
                  }}>
                  Undo
                </button>
              )}
              <button className="btn" onClick={() => onDone({ movieId: movie.id, winner: result.winner, points: result.points })}>
                {number < total ? "Next round" : "Final scores"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- Final ---------- */

function Final({ scores, onAgain, onSetup }: { scores: { name: string; score: number }[]; onAgain: () => void; onSetup: () => void }) {
  const top = Math.max(...scores.map((s) => s.score));
  const winners = scores.filter((s) => s.score === top).map((s) => s.name);
  const headline = useMemo(
    () => (top === 0 ? "Nobody scored. Tough crowd." : winners.length > 1 ? `${winners.join(" & ")} tie.` : `${winners[0]} wins.`),
    [top, winners],
  );
  useEffect(() => {
    track("game_completed", { game: "movie_guess" });
  }, []);
  return (
    <div className="rise">
      <div className="screen-head">
        <span className="meta">G-01 / Final</span>
        <div className="pass">
          {headline}
          <span className="g" style={{ display: "block" }}>Another round?</span>
        </div>
      </div>
      <div className="panel stack">
        <Board rows={scores} />
        <div className="row">
          <button className="btn ghost" onClick={onSetup}>
            Change setup
          </button>
          <button className="btn" onClick={onAgain}>
            Play again
          </button>
        </div>
      </div>
    </div>
  );
}
