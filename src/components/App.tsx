"use client";

import { useEffect } from "react";
import { pageview } from "@/lib/analytics";
import { Bar, useRoute } from "./ui";
import Home from "./Home";
import MovieGuess from "./MovieGuess";
import Imposter from "./Imposter";

export default function App() {
  const route = useRoute();

  useEffect(() => {
    window.scrollTo(0, 0);
    if (route) pageview(route);
  }, [route]);

  return (
    <>
      <Bar route={route} />
      <main className="wrap">
        {route === "movie-guess" ? <MovieGuess /> : route === "imposter" ? <Imposter /> : <Home />}
        <footer>
          <span>Timepass Beta · v0.4</span>
          <span>No clips, stills or songs. Our words, our voice.</span>
          <span className="privacy">
            Privacy: we count anonymous usage (which games are played, how far) to improve Timepass. No names, numbers or
            personal data are collected, and nothing is ever sold.
          </span>
        </footer>
      </main>
    </>
  );
}
