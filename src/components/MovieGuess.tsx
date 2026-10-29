"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGS, MOVIES, aliasesFor, poolFor, titlesFor, type Lang, type Movie } from "@/content/movies";
import { isCorrectGuess, shuffle } from "@/lib/game";
import { newRoomId, nowMs, secondsSince, track } from "@/lib/analytics";
import { usePersistentState } from "@/lib/store";
import { beep, buzz, unlockAudio, useWakeLock } from "@/lib/device";
import { Board, Countdown, GameTools, HowToPlay, NameList, Seg, ShareCard, TitleInput, Words, speak, stopSpeaking } from "./ui";

// PRD section 7: storyline -> hero -> heroine -> director -> reveal.
const CLUES: { key: keyof Movie; label: string; pts: number }[] = [
  { key: "storyline", label: "The story", pts: 4 },
  { key: "hero", label: "Hero", pts: 3 },
  { key: "heroine", label: "Heroine", pts: 2 },
  { key: "director", label: "Director", pts: 1 },
];
const CLUE_SECONDS = 20;
const GRACE_SECONDS = 3;
const UNDO_MS = 5000;

type Pool = "te" | "ta" | "both";
// autoNext: when a clue's timer runs out, open the next clue (or reveal) by
// itself after a 3-second warning the host can stop. Missing in older saves = on.
// mode: "teams" = host-led on one phone; "solo" = one player types answers.
// Missing in older saves = teams (PRD v0.3 tab, CR-6).
type Mode = "teams" | "solo";
type Setup = { pool: Pool; rounds: 5 | 10; teams: string[]; autoNext?: boolean; mode?: Mode };
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
  guesses?: string[]; // solo: wrong titles picked this round
  sound: boolean;
  // Analytics (tracking plan v1): one room per hosting session; timestamps
  // for game and round durations. Missing in older saves.
  roomId?: string;
  gameStartedAt?: number;
  roundStartedAt?: number;
};

export const MG_KEY = "game:movie-guess";

const INITIAL: MGState = {
  setup: { pool: "te", rounds: 5, teams: ["Team A", "Team B"], autoNext: true },
  phase: "setup",
  deckIds: [],
  results: [],
  clue: 0,
  award: null,
  sound: true,
};

const SOLO = "You";

const byId = (id: string) => MOVIES.find((m) => m.id === id);
const langsOf = (p: Pool): Lang[] => (p === "both" ? ["te", "ta"] : [p]);
const poolLabel = (p: Pool) => (p === "both" ? "Telugu + Tamil" : LANGS.find((l) => l.code === p)!.name);

export default function MovieGuess() {
  const [s, setS] = usePersistentState<MGState>(MG_KEY, INITIAL);
  const deck = s.deckIds.map(byId).filter((m): m is Movie => !!m);
  useWakeLock(s.phase === "playing");
  const solo = s.setup.mode === "solo";
  const players = solo ? [SOLO] : s.setup.teams;

  // Properties shared by every Movie Guess event.
  const ctx = (setup: Setup = s.setup, roomId: string | undefined = s.roomId) => ({
    game: "movie_guess",
    language: setup.pool,
    mode: setup.mode === "solo" ? "solo" : "same_room",
    role: "host",
    room_id: roomId,
  });
  const playerCount = (setup: Setup) => (setup.mode === "solo" ? 1 : setup.teams.length);

  // fresh = started from the setup screen (new room); Play again keeps the room.
  function start(setup: Setup, fresh = true) {
    unlockAudio();
    const deckIds = shuffle(poolFor(langsOf(setup.pool))).slice(0, setup.rounds).map((m) => m.id);
    const roomId = fresh || !s.roomId ? newRoomId() : s.roomId;
    const t = nowMs();
    setS({ ...s, setup, phase: "playing", deckIds, results: [], clue: 0, award: null, guesses: [], roomId, gameStartedAt: t, roundStartedAt: t });
    if (fresh) track("room_created", ctx(setup, roomId));
    track("game_started", { ...ctx(setup, roomId), player_count: playerCount(setup), rounds: deckIds.length });
  }

  function ended(endedBy: "finished" | "quit", roundsPlayed: number, topScore: number) {
    track("game_ended", {
      ...ctx(),
      rounds_played: roundsPlayed,
      player_count: playerCount(s.setup),
      duration_s: secondsSince(s.gameStartedAt),
      ended_by: endedBy,
      top_score: topScore,
    });
  }

  const scores = players.map((name) => ({
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
        solo={solo}
        maxScore={s.results.length * CLUES[0].pts}
        roomId={s.roomId}
        analytics={ctx()}
        onAgain={() => {
          track("play_again", { ...ctx(), next_game: "movie_guess" });
          start(s.setup, false);
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
      teams={players}
      solo={solo}
      titles={titlesFor(langsOf(s.setup.pool))}
      aliases={aliasesFor(langsOf(s.setup.pool))}
      guesses={s.guesses ?? []}
      scores={scores}
      clue={s.clue}
      award={s.award}
      sound={s.sound}
      setSound={(sound) => setS({ ...s, sound })}
      autoNext={s.setup.autoNext !== false}
      onNextClue={() => {
        track("clue_played", { ...ctx(), clue_index: s.clue + 2 });
        setS({ ...s, clue: s.clue + 1 });
      }}
      onAward={(award) => {
        track("answer_submitted", { ...ctx(), correct: !!award.winner, clue_index: s.clue + 1, input_script: solo ? "typed" : "spoken" });
        setS({ ...s, award });
      }}
      onWrongGuess={(title) => {
        // One update: log the miss, then open the next clue or reveal (PM-2).
        track("answer_submitted", { ...ctx(), correct: false, clue_index: s.clue + 1, input_script: "typed" });
        const guesses = [...(s.guesses ?? []), title];
        if (s.clue < CLUES.length - 1) setS({ ...s, guesses, clue: s.clue + 1 });
        else setS({ ...s, guesses, award: { winner: null, points: 0 } });
      }}
      onUndo={() => setS({ ...s, award: null })}
      onNext={() => {
        const results = [...s.results, { movieId: movie.id, winner: s.award?.winner ?? null, points: s.award?.points ?? 0 }];
        const done = results.length >= deck.length;
        track("round_completed", {
          ...ctx(),
          round_number: results.length,
          correct: !!s.award?.winner,
          points: s.award?.points ?? 0,
          clue_index: s.clue + 1,
          time_taken_s: secondsSince(s.roundStartedAt),
        });
        if (done) {
          const totals = players.map((p) => results.filter((r) => r.winner === p).reduce((a, r) => a + r.points, 0));
          ended("finished", results.length, Math.max(0, ...totals));
        }
        setS({ ...s, results, clue: 0, award: null, guesses: [], phase: done ? "final" : "playing", roundStartedAt: nowMs() });
      }}
      onEnd={() => {
        ended("quit", s.results.length, Math.max(0, ...scores.map((x) => x.score)));
        setS({ ...s, phase: "setup", deckIds: [], results: [], clue: 0, award: null, guesses: [] });
      }}
    />
  );
}

/* ---------- Setup: one big Start, settings below (PRD MG-1) ---------- */

function SetupScreen({ setup, setSetup, onStart }: { setup: Setup; setSetup: (s: Setup) => void; onStart: (s: Setup) => void }) {
  const poolSize = poolFor(langsOf(setup.pool)).length;
  const rounds = Math.min(setup.rounds, poolSize) as 5 | 10;
  const solo = setup.mode === "solo";
  return (
    <div className="rise setup">
      <div className="screen-head">
        <span className="meta">Movie Guess</span>
        <h2 className="title">
          <Words text="Guess the film from the clues." />
        </h2>
        <p className="muted">
          {solo
            ? "Just you and your phone. Type the film and pick it from the list. A wrong guess opens the next clue."
            : "One phone runs the game. Read each clue out, and tap the team that shouts the right answer first."}
        </p>
      </div>

      <div className="stack">
        <span className="label">Play as</span>
        <Seg<Mode>
          label="Play as"
          value={solo ? "solo" : "teams"}
          onChange={(mode) => setSetup({ ...setup, mode })}
          options={[
            { value: "teams", label: "Teams" },
            { value: "solo", label: "Solo" },
          ]}
        />
      </div>

      {solo ? (
        <HowToPlay
          id="movie-guess-solo"
          title="How to play solo"
          steps={[
            "Read the story clue, then type the film's name.",
            "Pick it from the list, so spelling never costs you.",
            "Wrong, or tapped Skip? The next clue opens: hero, heroine, then director. Earlier guesses score more: 4, 3, 2, 1.",
          ]}
        />
      ) : (
        <HowToPlay
          id="movie-guess"
          title="How to play"
          steps={[
            "The host reads the story clue out loud (or taps Read aloud).",
            "Nobody got it? Tap Next clue for the hero, then heroine, then director.",
            "Tap the team that guessed right. Earlier clues score more: 4, 3, 2, 1.",
          ]}
        />
      )}

      <div className="panel stack">
        <button className="btn block xl" onClick={() => onStart({ ...setup, rounds })}>
          Start game
        </button>
        <p className="summary">
          {solo ? "Solo" : `${setup.teams.length} teams`} · {rounds} rounds · {poolLabel(setup.pool)} films
        </p>
      </div>

      <details className="settings" open={false}>
        <summary>{solo ? "Change settings" : "Change teams and settings"}</summary>
        <div className="stack" style={{ gap: 20, paddingTop: 16 }}>
          {!solo && (
            <div className="stack">
              <span className="label">Teams · tap a name to rename</span>
              <NameList names={setup.teams} setNames={(teams) => setSetup({ ...setup, teams })} min={2} max={6} noun="a team" />
            </div>
          )}
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
            <span className="label">When time runs out</span>
            <Seg<"auto" | "host">
              label="When time runs out"
              value={setup.autoNext === false ? "host" : "auto"}
              onChange={(v) => setSetup({ ...setup, autoNext: v === "auto" })}
              options={[
                { value: "auto", label: "Next clue by itself" },
                { value: "host", label: "Host decides" },
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

function ClueTimer({ sound, paused, onZero }: { sound: boolean; paused: boolean; onZero: () => void }) {
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
      onZero();
    } else if (left <= 3 && sound) beep("tick");
  }, [left, sound, onZero]);
  return <Countdown left={left} total={CLUE_SECONDS} />;
}

/* ---------- Clock + auto-advance for one clue (remounts per clue) ---------- */

function ClueClock({
  clue,
  sound,
  auto,
  onAdvance,
}: {
  clue: number;
  sound: boolean;
  auto: boolean;
  onAdvance: () => void;
}) {
  // null = timer still running; a number = seconds until auto-advance;
  // "held" = time is up and the host is in charge.
  const [grace, setGrace] = useState<number | "held" | null>(null);
  const isLast = clue === CLUES.length - 1;

  useEffect(() => {
    if (typeof grace !== "number") return;
    const t = setTimeout(() => {
      if (grace <= 1) onAdvance();
      else setGrace(grace - 1);
    }, 1000);
    return () => clearTimeout(t);
  }, [grace, onAdvance]);

  return (
    <div className="timer-row">
      <ClueTimer sound={sound} paused={false} onZero={() => setGrace(auto ? GRACE_SECONDS : "held")} />
      {typeof grace === "number" ? (
        <div className="grace" role="status" aria-live="polite">
          <span className="label">Time’s up</span>
          <p className="worth">
            {isLast ? "Revealing" : "Next clue"} in {grace}
          </p>
          <button type="button" className="chipbtn" onClick={() => setGrace("held")}>
            Wait
          </button>
        </div>
      ) : (
        <div>
          <span className="label">{grace === "held" ? "Time’s up" : `Clue ${clue + 1} of 4`}</span>
          <p className="worth">{grace === "held" ? (isLast ? "Tap Reveal" : "Tap Next clue") : `Worth ${CLUES[clue].pts}`}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- One round ---------- */

function Round({
  movie,
  number,
  total,
  teams,
  solo,
  titles,
  aliases,
  guesses,
  scores,
  clue,
  award,
  sound,
  setSound,
  autoNext,
  onNextClue,
  onAward,
  onWrongGuess,
  onUndo,
  onNext,
  onEnd,
}: {
  movie: Movie;
  number: number;
  total: number;
  teams: string[];
  solo: boolean;
  titles: string[];
  aliases: Record<string, string[]>;
  guesses: string[];
  scores: { name: string; score: number }[];
  clue: number;
  award: Award | null;
  sound: boolean;
  setSound: (v: boolean) => void;
  autoNext: boolean;
  onNextClue: () => void;
  onAward: (a: Award) => void;
  onWrongGuess: (title: string) => void;
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
    setUndoable(!solo); // undo is for a host's mis-tap; a solo guess is final
    if (winner) {
      if (sound) beep("win");
      buzz(40);
    }
  }

  // Auto-advance target: next clue, or reveal with no winner after clue 4.
  const advance = useCallback(() => {
    if (clue < CLUES.length - 1) onNextClue();
    else give(null);
    // give() only reads props that change with clue/award.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clue, onNextClue]);

  function guess(title: string) {
    stopSpeaking();
    if (isCorrectGuess(title, movie)) give(SOLO);
    else {
      if (sound) beep("tick");
      buzz(60);
      onWrongGuess(title);
    }
  }

  // Titles already tried this round are taken out of the list.
  const open = titles.filter((t) => !guesses.includes(t));

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
            <ClueClock key={clue} clue={clue} sound={sound} auto={autoNext} onAdvance={advance} />
            {solo ? (
              <div className="stack">
                <span className="label">Your guess · pick from the list</span>
                <TitleInput key={clue} titles={open} aliases={aliases} onPick={guess} placeholder="Type the film's name" />
                {guesses.length > 0 && (
                  <p className="muted" role="status" aria-live="polite">
                    Not {guesses.join(", not ")}
                  </p>
                )}
              </div>
            ) : (
              <>
                <span className="label">Who got it?</span>
                <div className="award">
                  {teams.map((t) => (
                    <button key={t} className="btn" onClick={() => give(t)}>
                      {t}
                      <small>+{CLUES[clue].pts}</small>
                    </button>
                  ))}
                </div>
              </>
            )}
            <div className="row">
              <button className="btn ghost" onClick={() => speak(`${CLUES[clue].label}. ${movie[CLUES[clue].key]}`)}>
                Read aloud
              </button>
              {clue < CLUES.length - 1 ? (
                <button className="btn ghost" onClick={onNextClue}>
                  {solo ? "Skip" : "Next clue"}
                </button>
              ) : (
                <button className="btn ghost" onClick={() => give(null)}>
                  {solo ? "Give up" : "Reveal"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="round-grid">
          <div className="round-main panel">
            <span className="label">{award.winner ? `${award.winner} got it · +${award.points}` : solo ? "Not this time" : "Nobody got it"}</span>
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

function Final({
  scores,
  solo,
  maxScore,
  roomId,
  analytics,
  onAgain,
  onSetup,
}: {
  scores: { name: string; score: number }[];
  solo: boolean;
  maxScore: number;
  roomId?: string;
  analytics: Record<string, string | number | boolean | null | undefined>;
  onAgain: () => void;
  onSetup: () => void;
}) {
  const top = Math.max(...scores.map((x) => x.score));
  const winners = scores.filter((x) => x.score === top).map((x) => x.name);
  const headline = solo
    ? `You scored ${top} of ${maxScore}.`
    : top === 0
      ? "Nobody scored. Tough crowd."
      : winners.length > 1
        ? `${winners.join(" and ")} tie!`
        : `${winners[0]} wins!`;
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
            {solo ? "Change settings" : "Change teams"}
          </button>
          <button className="btn" onClick={onAgain}>
            Play again
          </button>
        </div>
        <ShareCard
          roomId={roomId}
          analytics={analytics}
          text={solo ? `I scored ${top} of ${maxScore} in Movie Guess on Timepass. Can you beat it?` : `${headline} We just played Movie Guess on Timepass.`}
        />
      </div>
    </div>
  );
}
