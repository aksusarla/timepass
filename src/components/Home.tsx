"use client";

import { COUNTS, LANGS, prefetch, usePool, type Lang, type Movie } from "@/content/movies";
import { useEffect, useState } from "react";
import { onlineEnabled } from "@/lib/online";
import { landingParams, track } from "@/lib/analytics";
import { loadState, saveState } from "@/lib/store";
import { remember } from "@/lib/selection";
import { Arrow, LangPicker, href, useSavedGame } from "./ui";
import { useFilmLang } from "@/lib/lang";
import { MG_KEY, SEEN_KEY } from "./MovieGuess";
import { IM_KEY } from "./Imposter";

/** Scores of a saved Movie Guess game, for the Continue banner. */
function savedScores(raw: string | null): string | null {
  try {
    const s = JSON.parse(raw ?? "");
    const names: string[] = s.setup?.mode === "solo" ? ["You"] : (s.setup?.teams ?? []);
    const pts = (n: string) => (s.results ?? []).filter((r: { winner: string | null }) => r.winner === n || (n === "You" && r.winner)).reduce((a: number, r: { points: number }) => a + r.points, 0);
    return names.map((n) => `${n} ${pts(n)}`).join(" · ") || null;
  } catch {
    return null;
  }
}

/** The first thing on the home page when a game was left unfinished. */
function ContinueBanner({ mg, im, mgRaw }: { mg: string | null; im: string | null; mgRaw: string | null }) {
  const [hidden, setHidden] = useState<string[]>([]);
  type Saved = { key: string; route: "movie-guess" | "imposter"; name: string; where: string; extra: string | null };
  const all: (Saved | null)[] = [
    mg ? { key: MG_KEY, route: "movie-guess", name: "Movie Guess", where: mg, extra: savedScores(mgRaw) } : null,
    im ? { key: IM_KEY, route: "imposter", name: "Imposter Movie", where: im, extra: null } : null,
  ];
  const games = all.filter((g): g is Saved => !!g && !hidden.includes(g.key));
  if (games.length === 0) return null;
  return (
    <section className="continue" aria-label="Unfinished games">
      {games.map((g) => (
        <div key={g.key} className="continue-card">
          <div>
            <span className="label">Continue your game</span>
            <h3>{g.name}</h3>
            <p className="muted">
              {g.where}
              {g.extra ? ` · ${g.extra}` : ""}
            </p>
          </div>
          <div className="row">
            <a className="btn" href={href(g.route)} onClick={() => track("game_selected", { game: g.route === "imposter" ? "imposter" : "movie_guess", resumed: true })}>
              Continue <Arrow />
            </a>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                saveState(g.key, null); // a new game starts fresh next time
                setHidden((h) => [...h, g.key]);
              }}
            >
              End it
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

function resumeLabel(key: string, raw: string | null): string | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (key === MG_KEY && s.phase === "playing" && s.deckIds?.length) {
      const total = s.setup?.rounds ?? s.deckIds.length;
      return `Round ${Math.min((s.results?.length ?? 0) + 1, total)} of ${total}`;
    }
    if (key === IM_KEY && s.phase?.kind && s.phase.kind !== "setup") return `Round ${s.roundNo}`;
  } catch {}
  return null;
}

export default function Home() {
  // The chosen language applies to every game, not just "Try one" (remembered on this phone).
  const filmLang = useFilmLang();
  const lang: Lang = filmLang === "ta" ? "ta" : "te";
  const langName = filmLang === "both" ? "Telugu + Tamil" : (LANGS.find((l) => l.code === filmLang)?.name ?? "");
  const films = filmLang === "both" ? LANGS.reduce((n, l) => n + (COUNTS[l.code]?.puzzles ?? 0), 0) : (COUNTS[filmLang]?.puzzles ?? 0);
  const mgRaw = useSavedGame(MG_KEY);
  const mgResume = resumeLabel(MG_KEY, mgRaw);
  const imResume = resumeLabel(IM_KEY, useSavedGame(IM_KEY));
  // The language chips in the hero also choose the film in "Try one".

  useEffect(() => {
    const { ref, utm_source } = landingParams();
    track("landing_viewed", { language: "en", browser_language: navigator.language, ref, utm_source });
    // Fetch the (small) puzzle files while the visitor reads the home page.
    const idle = window.setTimeout(() => prefetch(), 1500);
    return () => window.clearTimeout(idle);
  }, []);

  return (
    <div className="home">
      <ContinueBanner mg={mgResume} im={imResume} mgRaw={mgRaw} />
      <section className="hero">
        <div className="hero-copy rise">
          <h1>
            <span>Movie games for the whole room.</span>
            <span className="g">No app, no login. Just play.</span>
          </h1>
          <p className="lede">
            Original games built on Telugu and Tamil cinema. One phone runs the game, so grandparents and kids can play
            along.
          </p>
          <div className="lang-row">
            <span className="label">Play in</span>
            <LangPicker value={filmLang} label="Film language for every game" />
          </div>
        </div>
        <Taster lang={lang} />
      </section>

      <section className="games" aria-label="Games">
        <div className="cards">
          <GameCard
            title="Movie Guess"
            text="Guess the film from clues that get easier: the story, then the director, heroine and hero. Guess early, score more."
            tags={["Solo or 2–6 teams", "8–15 min", `${films} ${langName} films`]}
            route="movie-guess"
            cta={mgResume ? `Resume, round ${mgResume.replace("Round ", "")}` : `Play Movie Guess in ${langName}`}
            inProgress={!!mgResume}
            onPick={() => track("game_selected", { game: "movie_guess", resumed: !!mgResume })}
          />
          <GameCard
            title="Imposter Movie"
            text="Everyone secretly picks a film. One player ends up seeing the wrong one, and they might not even know it. Give clues, then catch them."
            tags={["4–12 players", "5 min a round", "Pass the phone"]}
            route="imposter"
            cta={imResume ? `Resume, round ${imResume.replace("Round ", "")}` : `Play Imposter in ${langName}`}
            inProgress={!!imResume}
            onPick={() => track("game_selected", { game: "imposter", resumed: !!imResume })}
          />
        </div>
      </section>

      <section className="steps" aria-labelledby="steps-title">
        <h2 id="steps-title">How a game night works</h2>
        <ol>
          <li>
            <h3>Open the link</h3>
            <p>On any phone or laptop. Nothing to install, no sign-up.</p>
          </li>
          <li>
            <h3>Pick a game</h3>
            <p>Choose the films, Telugu, Tamil or both, and name your teams.</p>
          </li>
          <li>
            <h3>Play together</h3>
            <p>Read the clues out and tap whoever got it. Scores are kept even if the phone locks.</p>
          </li>
        </ol>
      </section>

      <section className="next" aria-labelledby="next-title">
        <h2 id="next-title">Coming next</h2>
        <div className="next-grid">
          <div className="soon-card">
            <div className="soon-top">
              <h3>Rail Gaadi</h3>
              <span className="badge">Coming soon</span>
            </div>
            <p>Link each film to the last through a shared star or director, before the timer runs out. Coming after playtests.</p>
          </div>
          {onlineEnabled ? (
            <a className="soon-card live" href="#online" onClick={() => track("game_selected", { game: "movie_guess", mode: "online" })}>
              <div className="soon-top">
                <h3>Play from every phone</h3>
                <span className="badge on">Beta</span>
              </div>
              <p>Movie Guess online, in teams: everyone joins from their own phone with a room code.</p>
              <span className="btn ghost">
                Play online <Arrow />
              </span>
            </a>
          ) : (
            <div className="soon-card">
              <div className="soon-top">
                <h3>Play from every phone</h3>
                <span className="badge">Coming soon</span>
              </div>
              <p>Online rooms so everyone joins from their own phone, wherever they are. For now, one phone runs the game.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function GameCard(props: {
  title: string;
  text: string;
  tags: string[];
  route: "movie-guess" | "imposter";
  cta: string;
  inProgress: boolean;
  onPick: () => void;
}) {
  return (
    <a className="gcard" href={href(props.route)} onClick={props.onPick}>
      <div className="gcard-body">
        <div className="gcard-top">
          <h2>{props.title}</h2>
          {props.inProgress && <span className="status live">In progress</span>}
        </div>
        <p>{props.text}</p>
        <ul className="tags">
          {props.tags.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
      <div className="gcard-cta">
        <span className="btn block dark">
          {props.cta} <Arrow />
        </span>
      </div>
    </a>
  );
}

/* ---------- "Try one": a real clue from the film bank ---------- */

const TASTER_CLUES: { key: "storyline" | "hero" | "heroine" | "director"; label: string }[] = [
  { key: "storyline", label: "The story" },
  { key: "director", label: "Director" },
  { key: "heroine", label: "Heroine" },
  { key: "hero", label: "Hero" },
];

function pickTaster(pool: Movie[], seed: number): Movie | undefined {
  // Easy, family-safe films make the best first impression.
  const easy = pool.filter((m) => m.familySafe && (m.difficulty ?? 1) === 1);
  const list = easy.length ? easy : pool;
  return list[Math.floor(seed * list.length) % Math.max(list.length, 1)];
}

function Taster({ lang }: { lang: Lang }) {
  const [seed, setSeed] = useState(() => Math.random());
  const [step, setStep] = useState(0); // clues shown, 0-based
  const [revealed, setRevealed] = useState(false);
  const [shownFor, setShownFor] = useState(lang);
  const pool = usePool([lang]);
  const movie = pool ? pickTaster(pool, seed) : undefined;

  // A new language starts a fresh film.
  if (shownFor !== lang) {
    setShownFor(lang);
    setStep(0);
    setRevealed(false);
  }

  function another() {
    setSeed(Math.random());
    setStep(0);
    setRevealed(false);
  }

  function reveal() {
    setRevealed(true);
    // A film answered here won't come up in this phone's next Movie Guess.
    if (movie) saveState(SEEN_KEY, remember(loadState<string[]>(SEEN_KEY, []), [movie.id]));
  }

  const shown = (i: number) => revealed || i <= step;

  return (
    <aside className="taster rise" aria-labelledby="taster-title">
      <div className="taster-head">
        <h2 id="taster-title">Try one</h2>
        <ol className="taster-steps" aria-hidden="true">
          {TASTER_CLUES.map((c, i) => (
            <li key={c.key} className={shown(i) ? "on" : undefined}>
              {i === 0 ? "Story" : c.label}
            </li>
          ))}
        </ol>
      </div>

      {!movie ? (
        <p className="taster-wait">Picking a film…</p>
      ) : (
        <>
          <div className="taster-body" aria-live="polite">
            {revealed ? (
              <div className="taster-answer">
                <span className="taster-label">The film</span>
                <p className="taster-title">
                  {movie.title}
                  {movie.titleNative && <span className="native"> {movie.titleNative}</span>}
                </p>
                <p className="taster-meta">{movie.year}</p>
              </div>
            ) : (
              <>
                <span className="taster-label">The story</span>
                <p className="taster-story">{movie.storyline}</p>
              </>
            )}
          </div>

          <ul className="taster-grid">
            {TASTER_CLUES.slice(1).map((c, j) => {
              const i = j + 1;
              return (
                <li key={c.key} data-hidden={!shown(i)}>
                  <span className="taster-label">{c.label}</span>
                  {shown(i) ? <span className="taster-value">{String(movie[c.key])}</span> : <span className="taster-blank" aria-label="Hidden" />}
                </li>
              );
            })}
          </ul>

          <div className="taster-actions">
            {revealed ? (
              <>
                <button type="button" className="btn ghost" onClick={another}>
                  Another film
                </button>
                <a className="btn" href={href("movie-guess")} onClick={() => track("game_selected", { game: "movie_guess", resumed: false })}>
                  Play a full game <Arrow />
                </a>
              </>
            ) : (
              <>
                <button type="button" className="btn ghost" onClick={() => setStep(step + 1)} disabled={step >= TASTER_CLUES.length - 1}>
                  Next clue
                </button>
                <button type="button" className="btn" onClick={reveal}>
                  Show the film
                </button>
              </>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
