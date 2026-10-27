import { MOVIES, LANGS } from "@/content/movies";
import { Arrow, href } from "./ui";

export default function Home() {
  const perLang = LANGS.map((l) => MOVIES.filter((m) => m.lang === l.code).length);
  return (
    <>
      <div className="hero rise">
        <div className="meta">00 / Index</div>
        <h1>
          Timepass.
          <span className="g">Movie night, sorted.</span>
        </h1>
        <p className="lede">
          <b>Original movie games for Indian get-togethers.</b> One phone runs the room. No install, no
          login, just open the link and play.
        </p>
        <p className="focus">
          {LANGS.map((l, i) => (
            <span key={l.code}>
              {i > 0 && <i>|</i>}
              {l.native} {l.name}
            </span>
          ))}
        </p>
      </div>

      <div className="ledger" aria-label="Key numbers">
        <div className="stat"><span className="k">#01</span><span className="v">3</span><span className="d">original movie games</span></div>
        <div className="stat"><span className="k">#02</span><span className="v">2</span><span className="d">launch languages, more to follow</span></div>
        <div className="stat"><span className="k">#03</span><span className="v">0</span><span className="d">installs, logins or sign-ups</span></div>
        <div className="stat"><span className="k">#04</span><span className="v">12<small>max</small></span><span className="d">players per room</span></div>
      </div>

      <section style={{ marginTop: 48 }}>
        <div className="sec-head">
          <span className="sec-no">01 / Games</span>
          <span className="sec-no">Same room · one phone</span>
        </div>
        <div className="glist">
          <a className="game" href={href("movie-guess")}>
            <div className="gid"><b>G-01</b><span className="label">Flagship</span></div>
            <div>
              <div className="ghead"><h3>Movie Guess</h3><span className="status live">Playable</span><span className="go"><Arrow /></span></div>
              <p>Clues come one at a time: the story in simple words, then the hero, heroine and director. Guess early to score more.</p>
              <div className="tags"><span>4 → 3 → 2 → 1 pts</span><span>Teams</span><span>{perLang[0]} Telugu · {perLang[1]} Tamil films</span></div>
            </div>
          </a>
          <a className="game" href={href("imposter")}>
            <div className="gid"><b>G-02</b><span className="label">Deduction</span></div>
            <div>
              <div className="ghead"><h3>Imposter Movie</h3><span className="status live">Pass &amp; play</span><span className="go"><Arrow /></span></div>
              <p>Everyone secretly picks a movie. One becomes the real one, and one player is the imposter, but they don&apos;t know it. Give clues, then vote.</p>
              <div className="tags"><span>4–12 players</span><span>Clue rounds</span><span>Vote + steal</span></div>
            </div>
          </a>
          <div className="game" aria-disabled="true">
            <div className="gid"><b>G-03</b><span className="label">Fast</span></div>
            <div>
              <div className="ghead"><h3 style={{ color: "var(--muted)" }}>Rail Gaadi</h3><span className="status">Proposed</span></div>
              <p>Keep the movie train running: link each film to the last through a shared director or star, before the timer shrinks to nothing.</p>
              <div className="tags"><span>After paper playtest</span></div>
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 40 }}>
        <div className="sec-head">
          <span className="sec-no">02 / Coming next</span>
        </div>
        <p className="note">
          <b>Online mode.</b> Everyone plays from their own phone, wherever they are. This needs the live
          room server and arrives with Spike A. For now, one phone runs the game in the room.
        </p>
      </section>
    </>
  );
}
