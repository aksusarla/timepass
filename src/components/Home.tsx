"use client";

import { MOVIES, LANGS } from "@/content/movies";
import { Arrow, href, useSavedGame } from "./ui";
import { MG_KEY } from "./MovieGuess";
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
  const perLang = LANGS.map((l) => MOVIES.filter((m) => m.lang === l.code).length);
  const mgResume = resumeLabel(MG_KEY, useSavedGame(MG_KEY));
  const imResume = resumeLabel(IM_KEY, useSavedGame(IM_KEY));

  return (
    <>
      <div className="intro rise">
        <h1>
          Movie games for get-togethers.
          <span className="g">No app, no login. Just play.</span>
        </h1>
      </div>

      <div className="cards">
        <a className="gcard" href={href("movie-guess")}>
          <div className="gcard-top">
            <h3>Movie Guess</h3>
            {mgResume ? <span className="status live">In progress</span> : <span className="status">Teams</span>}
          </div>
          <p>Guess the film from clues that get easier: the story, then the hero, heroine and director. Guess early, score more.</p>
          <div className="tags">
            <span>2–6 teams</span>
            <span>8–15 min</span>
            <span>{perLang[0]} Telugu · {perLang[1]} Tamil films</span>
          </div>
          <span className="btn block">
            {mgResume ? `Resume · ${mgResume}` : "Play"} <Arrow />
          </span>
        </a>

        <a className="gcard" href={href("imposter")}>
          <div className="gcard-top">
            <h3>Imposter Movie</h3>
            {imResume ? <span className="status live">In progress</span> : <span className="status">Pass & play</span>}
          </div>
          <p>Everyone secretly picks a film. One player ends up seeing the wrong one, and they might not even know it. Give clues, then catch them.</p>
          <div className="tags">
            <span>4–12 players</span>
            <span>5 min a round</span>
            <span>One phone</span>
          </div>
          <span className="btn block">
            {imResume ? `Resume · ${imResume}` : "Play"} <Arrow />
          </span>
        </a>
      </div>

      <section className="more">
        <div className="soon">
          <h4>Rail Gaadi</h4>
          <p>Link each film to the last through a shared star or director, before the timer runs out. Coming after playtests.</p>
        </div>
        <div className="soon">
          <h4>Play from every phone</h4>
          <p>Online rooms, so everyone can join from their own phone, wherever they are. Coming soon. For now, one phone runs the game.</p>
        </div>
      </section>
    </>
  );
}
