"use client";

import { COUNTS, LANGS, prefetch, usePool, type Lang, type Movie } from "@/content/movies";
import { useEffect, useState } from "react";
import { landingParams, track } from "@/lib/analytics";
import { loadState, saveState } from "@/lib/store";
import { remember } from "@/lib/selection";
import { Arrow, Words, href, useSavedGame } from "./ui";
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
            <Words text="Movie games for the whole room." />
            <span className="g">
              <Words text="No app, no login. Just play." />
            </span>
          </h1>
          <p className="lede">
            Original games built on Telugu and Tamil cinema. One phone runs the game, so grandparents and kids can play
            along.
          </p>
          <ul className="langs" aria-label="Languages">
            {LANGS.map((l) => (
              <li key={l.code}>
                <span className="native">{l.native}</span> {l.name}
              </li>
            ))}
            <li className="more-soon">More languages soon</li>
          </ul>
        </div>
        <Taster />
      </section>

      <section className="cards" aria-label="Games">
        <a className="gcard" href={href("movie-guess")} onClick={() => track("game_selected", { game: "movie_guess", resumed: !!mgResume })}>
          <div className="gcard-top">
            <h2>
              <Words text="Movie Guess" />
            </h2>
            {mgResume && <span className="status live">In progress</span>}
          </div>
          <p>Guess the film from clues that get easier: the story, then the hero, heroine and director. Guess early, score more.</p>
          <ul className="tags">
            <li>Solo or 2–6 teams</li>
            <li>8–15 min</li>
            <li>{totalFilms} films</li>
          </ul>
          <span className="btn block">
            {mgResume ? `Resume, round ${mgResume.replace("Round ", "")}` : "Play Movie Guess"} <Arrow />
          </span>
        </a>

        <a className="gcard" href={href("imposter")} onClick={() => track("game_selected", { game: "imposter", resumed: !!imResume })}>
          <div className="gcard-top">
            <h2>
              <Words text="Imposter Movie" />
            </h2>
            {imResume && <span className="status live">In progress</span>}
          </div>
          <p>Everyone secretly picks a film. One player ends up seeing the wrong one, and they might not even know it. Give clues, then catch them.</p>
          <ul className="tags">
            <li>4–12 players</li>
            <li>5 min a round</li>
            <li>Pass the phone</li>
          </ul>
          <span className="btn block">
            {imResume ? `Resume, round ${imResume.replace("Round ", "")}` : "Play Imposter Movie"} <Arrow />
          </span>
        </a>
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
          <div>
            <h3>Rail Gaadi</h3>
            <p>Link each film to the last through a shared star or director, before the timer runs out.</p>
          </div>
          <div>
            <h3>Play from every phone</h3>
            <p>Online rooms, so everyone joins from their own phone, wherever they are. For now, one phone runs the game.</p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- "Try one": a real clue from the film bank ---------- */

const TASTER_CLUES: { key: "storyline" | "hero" | "heroine" | "director"; label: string }[] = [
  { key: "storyline", label: "The story" },
  { key: "hero", label: "Hero" },
  { key: "heroine", label: "Heroine" },
  { key: "director", label: "Director" },
];

function pickTaster(pool: Movie[], seed: number): Movie | undefined {
  // Easy, family-safe films make the best first impression.
  const easy = pool.filter((m) => m.familySafe && (m.difficulty ?? 1) === 1);
  const list = easy.length ? easy : pool;
  return list[Math.floor(seed * list.length) % Math.max(list.length, 1)];
}

function Taster() {
  const [lang, setLang] = useState<Lang>(LANGS[0].code);
  const [seed, setSeed] = useState(() => Math.random());
  const [step, setStep] = useState(0); // clues shown, 0-based
  const [revealed, setRevealed] = useState(false);
  const pool = usePool([lang]);
  const movie = pool ? pickTaster(pool, seed) : undefined;

  function reset(next: Partial<{ lang: Lang; seed: number }>) {
    if (next.lang) setLang(next.lang);
    if (next.seed !== undefined) setSeed(next.seed);
    setStep(0);
    setRevealed(false);
  }

  function reveal() {
    setRevealed(true);
    // A film answered here won't come up in this phone's next Movie Guess.
    if (movie) saveState(SEEN_KEY, remember(loadState<string[]>(SEEN_KEY, []), [movie.id]));
  }

  return (
    <aside className="taster rise" aria-labelledby="taster-title">
      <div className="taster-top">
        <h2 id="taster-title">Try one</h2>
        <div className="lang-switch" role="group" aria-label="Film language">
          {LANGS.map((l) => (
            <button key={l.code} type="button" aria-pressed={lang === l.code} onClick={() => reset({ lang: l.code })}>
              {l.native}
            </button>
          ))}
        </div>
      </div>

      {!movie ? (
        <p className="taster-wait">Picking a film…</p>
      ) : (
        <>
          <ol className="taster-clues" aria-live="polite">
            {TASTER_CLUES.map((c, i) => (
              <li key={c.key} className={i === 0 ? "story" : undefined} data-hidden={!revealed && i > step}>
                <span className="taster-label">{c.label}</span>
                <span className="taster-value">{revealed || i <= step ? String(movie[c.key]) : "Hidden"}</span>
              </li>
            ))}
          </ol>

          {revealed ? (
            <div className="taster-answer">
              <p className="taster-title">
                {movie.title}
                {movie.titleNative && <span className="native"> {movie.titleNative}</span>}
              </p>
              <p className="taster-meta">{movie.year}</p>
              <div className="taster-actions">
                <a className="btn" href={href("movie-guess")} onClick={() => track("game_selected", { game: "movie_guess", resumed: false })}>
                  Play a full game <Arrow />
                </a>
                <button type="button" className="btn ghost" onClick={() => reset({ seed: Math.random() })}>
                  Another film
                </button>
              </div>
            </div>
          ) : (
            <div className="taster-actions">
              {step < TASTER_CLUES.length - 1 && (
                <button type="button" className="btn ghost" onClick={() => setStep(step + 1)}>
                  Next clue
                </button>
              )}
              <button type="button" className="btn" onClick={reveal}>
                Show the film
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
