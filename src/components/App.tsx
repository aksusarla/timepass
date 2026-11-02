"use client";

import { useEffect } from "react";
import { pageview } from "@/lib/analytics";
import { Bar, Wordmark, href, useRoute } from "./ui";
import Home from "./Home";
import MovieGuess from "./MovieGuess";
import Imposter from "./Imposter";
import Online from "./Online";

export default function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
    if (route) pageview(route);
  }, [route]);

  return (
    <>
      <Bar route={route} />
      <main className={route === "home" || route === null ? "wrap wide" : "wrap"}>
        {route === "movie-guess" ? <MovieGuess /> : route === "imposter" ? <Imposter /> : route === "online" ? <Online /> : <Home />}
        <footer>
          <div className="foot-top">
            <div className="foot-brand">
              <Wordmark asLink={false} />
              <p>
                Movie games for get-togethers.
                <br />
                No app, no login, no sign-up. Just play.
              </p>
            </div>
            <nav className="foot-col" aria-label="Play something">
              <span className="foot-label">Play something</span>
              <a href={href("movie-guess")}>Movie Guess</a>
              <a href={href("imposter")}>Imposter Movie</a>
              <span className="soon">Rail Gaadi (soon)</span>
            </nav>
          </div>
          <div className="foot-legal">
            <div className="foot-row">
              <span className="mono">© 2026 Timepass. Play a little.</span>
              <span>No clips, stills or songs. Our words, our voice.</span>
            </div>
            <p className="privacy">
              Timepass Beta · v0.7 · Privacy: we count anonymous usage (which games are played, how far) to improve
              Timepass. No names, numbers or personal data are collected, and nothing is ever sold.
            </p>
          </div>
        </footer>
      </main>
    </>
  );
}
