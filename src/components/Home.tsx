"use client";

import { COUNTS, LANGS, prefetch, usePool, type Lang, type Movie } from "@/content/movies";
import { useEffect, useState } from "react";
import { onlineEnabled } from "@/lib/online";
import { landingParams, track } from "@/lib/analytics";
import { loadState, saveState } from "@/lib/store";
import { remember } from "@/lib/selection";
import { Arrow, href, useSavedGame } from "./ui";
import { MG_KEY, SEEN_KEY } from "./MovieGuess";
import { IM_KEY } from "./Imposter";

function resumeLabel(key: string, raw: string | null): string | null {
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    if (key === MG_KEY && s.phase === "playing" && s.deckIds?.length) {
      return `Round ${Math.min((s.results?.length ?? 0) + 1, s.deckIds.length)} of ${s.deckIds.length}`;
    }
    if (key === IM_KEY && s.phase?.kind && s.phase.kind !== "setup") return `Round ${s.roundNo}`;
  } catch {}
  return null;
}

export default function Home() {
  const totalFilms = LANGS.reduce((n, l) => n + (COUNTS[l.code]?.puzzles ?? 0), 0);
  const mgResume = resumeLabel(MG_KEY, useSavedGame(MG_KEY));
  const imResume = resumeLabel(IM_KEY, useSavedGame(IM_KEY));
  // The language chips in the hero also choose the film in "Try one".
  const [lang, setLang] = useState<Lang>(LANGS[0].code);

  useEffect(() => {
    const { ref, utm_source } = landingParams();
    track("landing_viewed", { language: "en", browser_language: navigator.language, ref, utm_source });
    // Fetch the (small) puzzle files while the visitor reads the home page.
    const idle = window.setTimeout(() => prefetch(), 1500);
    return () => window.clearTimeout(idle);
  }, []);

  return (
    <div className="home">
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
          <div className="langs" role="group" aria-label="Film language for Try one">
            {LANGS.map((l) => (
              <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => setLang(l.code)}>
                <span className="native">{l.native}</span> {l.name}
              </button>
            ))}
            <span className="more-soon">More languages soon</span>
          </div>
        </div>
        <Taster lang={lang} />
      </section>

      <section className="games" aria-label="Games">
        <div className="cards">
          <GameCard
            title="Movie Guess"
            text="Guess the film from clues that get easier: the story, then the director, heroine and hero. Guess early, score more."
            tags={["Solo or 2–6 teams", "8–15 min", `${totalFilms} films`]}
            route="movie-guess"
            cta={mgResume ? `Resume, round ${mgResume.replace("Round ", "")}` : "Play Movie Guess"}
            inProgress={!!mgResume}
            onPick={() => track("game_selected", { game: "movie_guess", resumed: !!mgResume })}
          />
          <GameCard
            title="Imposter Movie"
            text="Everyone secretly picks a film. One player ends up seeing the wrong one, and they might not even know it. Give clues, then catch them."
            tags={["4–12 players", "5 min a round", "Pass the phone"]}
            route="imposter"
            cta={imResume ? `Resume, round ${imResume.replace("Round ", "")}` : "Play Imposter Movie"}
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
