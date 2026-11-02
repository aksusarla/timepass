"use client";

// Online rooms: everyone plays Movie Guess (Teams) from their own phone.
// #online shows create/join; #room=ABCD is one room. Rules: src/lib/rooms.ts.
import { useEffect, useState, useSyncExternalStore } from "react";
import { ALL_LANGS, LANGS, COUNTS, useSearch } from "@/content/movies";
import { CLUES, CLUE_MS, type Pool, type RoomView } from "@/lib/rooms";
import { CODE_RE, codeFromHash, createRoom, onlineEnabled, roomHash, roomLink, useRoom, useSecondsLeft } from "@/lib/online";
import { loadState, saveState } from "@/lib/store";
import { track } from "@/lib/analytics";
import { buzz, useWakeLock } from "@/lib/device";
import { Board, Countdown, HowToPlay, NameList, Seg, TitleInput, Words } from "./ui";

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export default function Online() {
  const code = useSyncExternalStore(subscribeHash, codeFromHash, () => null);
  if (!onlineEnabled) return <ComingSoon />;
  return code ? <RoomScreen key={code} code={code} /> : <Entry />;
}

function ComingSoon() {
  return (
    <div className="setup stack">
      <div className="screen-head">
        <h2>
          <Words text="Play online" />
        </h2>
      </div>
      <p className="muted">Online rooms are being tested. For now, one phone runs the game.</p>
    </div>
  );
}

/* ---------- Create or join ---------- */

function Entry() {
  const [join, setJoin] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setErr(null);
    try {
      const code = await createRoom();
      track("room_created", { game: "movie_guess", mode: "online" });
      window.location.hash = roomHash(code);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };
  const go = () => {
    const c = join.trim().toUpperCase();
    if (CODE_RE.test(c)) window.location.hash = roomHash(c);
    else setErr("Room codes are 4 letters, like KPMV.");
  };
  return (
    <div className="setup stack">
      <div className="screen-head">
        <h2>
          <Words text="Movie Guess online" />
        </h2>
        <p className="muted">Everyone plays from their own phone, in teams. Great on a video call or across the room.</p>
      </div>
      <div className="panel stack">
        <span className="label">Host a game</span>
        <button className="btn block xl" disabled={busy} onClick={create}>
          {busy ? "Creating room…" : "Create a room"}
        </button>
      </div>
      <div className="panel stack">
        <span className="label">Join with a code</span>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            go();
          }}
        >
          <input
            className="input"
            value={join}
            onChange={(e) => setJoin(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            aria-label="Room code"
            autoCapitalize="characters"
            autoComplete="off"
            inputMode="text"
          />
          <button className="btn" type="submit">
            Join
          </button>
        </form>
      </div>
      {err && (
        <p className="note" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}

/* ---------- One room ---------- */

function RoomScreen({ code }: { code: string }) {
  const { view, status, error, send, offset } = useRoom(code);
  useWakeLock(!!view && view.phase !== "lobby" && view.phase !== "over");

  if (status === "gone")
    return <Message title="Room not found" text={`There's no room ${code}. It may have expired. Ask the host for a new code.`} />;
  if (status === "kicked") return <Message title="You were removed" text="The host removed you from this room." />;
  if (!view) return <div className="loading" role="status">Connecting to room {code}…</div>;

  return (
    <div className="stack online">
      {status === "reconnecting" && (
        <p className="note" role="status">
          Connection lost. Reconnecting…
        </p>
      )}
      {error && (
        <p className="note" role="alert">
          {error}
        </p>
      )}
      {view.hostAway && !view.me?.isHost && view.me && (
        <div className="note row">
          <span>The host has left.</span>
          <button className="btn ghost" onClick={() => send({ type: "claimHost" })}>
            Take over as host
          </button>
        </div>
      )}
      {!view.me ? (
        <JoinForm code={code} view={view} onJoin={(name) => send({ type: "join", name })} />
      ) : view.phase === "lobby" ? (
        <Lobby view={view} send={send} />
      ) : view.phase === "clue" ? (
        <Round view={view} send={send} offset={offset} />
      ) : view.phase === "reveal" ? (
        <Reveal view={view} send={send} />
      ) : (
        <Over view={view} send={send} />
      )}
    </div>
  );
}

type Send = ReturnType<typeof useRoom>["send"];

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="setup stack">
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      <a className="btn" href="#online">
        Back to online games
      </a>
    </div>
  );
}

function JoinForm({ code, view, onJoin }: { code: string; view: RoomView; onJoin: (name: string) => void }) {
  const [name, setName] = useState(() => loadState<string>("nickname", ""));
  const submit = () => {
    const n = name.trim();
    if (!n) return;
    saveState("nickname", n); // stays on this phone; never sent to analytics
    onJoin(n);
    track("room_joined", { game: "movie_guess" });
  };
  return (
    <div className="setup stack">
      <div className="screen-head">
        <span className="label">Room {code}</span>
        <h2>
          <Words text="Join the game" />
        </h2>
        <p className="muted">
          {view.players.length > 0 ? `${view.players.length} playing: ${view.players.map((p) => p.name).join(", ")}` : "You're the first one here."}
        </p>
      </div>
      <form
        className="panel stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className="field">
          <span className="label">Your name</span>
          <input className="input" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} placeholder="Nickname" autoFocus />
        </label>
        <button className="btn block xl" type="submit" disabled={name.trim().length < 2}>
          Join room
        </button>
      </form>
    </div>
  );
}

function Invite({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = roomLink(code);
  const text = `Join my Timepass movie game! Room ${code}: ${link}`;
  return (
    <div className="panel stack invite">
      <span className="label">Room code</span>
      <div className="room-code" aria-label={`Room code ${code.split("").join(" ")}`}>
        {code}
      </div>
      <div className="row">
        <a className="btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          Invite on WhatsApp
        </a>
        <button
          className="btn ghost"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "Link copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

function Lobby({ view, send }: { view: RoomView; send: Send }) {
  const me = view.me!;
  const filled = view.teams.filter((t) => t.size > 0).length;
  const counts = (pool: Pool) => (pool === "both" ? LANGS.reduce((n, l) => n + (COUNTS[l.code]?.puzzles ?? 0), 0) : (COUNTS[pool]?.puzzles ?? 0));
  return (
    <div className="setup stack">
      <div className="screen-head">
        <h2>
          <Words text="Pick your team" />
        </h2>
        <p className="muted">{me.isHost ? "You're the host. Start when everyone's in." : "Waiting for the host to start."}</p>
      </div>
      <Invite code={view.code} />
      <div className="teams">
        {view.teams.map((t, i) => (
          <div key={i} className={`panel stack team${me.team === i ? " mine" : ""}`}>
            <div className="row">
              <span className="label">
                {t.name} · {t.size}
              </span>
              {me.team !== i && (
                <button className="chipbtn" onClick={() => send({ type: "setTeam", team: i })}>
                  Join
                </button>
              )}
            </div>
            <ul className="players">
              {view.players
                .filter((p) => p.team === i)
                .map((p) => (
                  <li key={p.id} className={p.connected ? undefined : "muted"}>
                    {p.name}
                    {p.isHost ? " · host" : ""}
                    {p.id === me.id ? " · you" : ""}
                    {!p.connected ? " · away" : ""}
                    {me.isHost && p.id !== me.id && (
                      <button className="chipbtn danger" aria-label={`Remove ${p.name}`} onClick={() => send({ type: "kick", target: p.id })}>
                        Remove
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      {me.isHost && (
        <details className="settings">
          <summary>Change teams and settings</summary>
          <div className="stack" style={{ gap: 20, paddingTop: 16 }}>
            <div className="stack">
              <span className="label">Teams · tap a name to rename</span>
              <NameList names={view.teams.map((t) => t.name)} setNames={(teams) => send({ type: "configure", teams })} min={2} max={6} noun="a team" />
            </div>
            <div className="stack">
              <span className="label">Films from</span>
              <Seg<Pool>
                label="Movie pool"
                value={view.pool}
                onChange={(pool) => send({ type: "configure", pool })}
                options={[
                  ...LANGS.map((l) => ({ value: l.code as Pool, label: `${l.name} · ${counts(l.code as Pool)}` })),
                  { value: "both" as Pool, label: `Both · ${counts("both")}` },
                ]}
              />
            </div>
            <div className="stack">
              <span className="label">Rounds</span>
              <Seg<number>
                label="Rounds"
                value={view.rounds}
                onChange={(rounds) => send({ type: "configure", rounds })}
                options={[5, 10, 15].map((n) => ({ value: n, label: String(n), disabled: n > counts(view.pool) }))}
              />
            </div>
          </div>
        </details>
      )}
      <HowToPlay
        id="movie-guess-online"
        title="How to play online"
        steps={[
          "Everyone sees the same clue: first the story, then the hero, heroine and director.",
          "Anyone can guess for their team. A wrong guess locks your team until the next clue.",
          "First right answer wins the round. Earlier clues score more: 4, 3, 2, 1.",
        ]}
      />
      {me.isHost && (
        <div className="panel stack">
          <button className="btn block xl" disabled={filled < 2} onClick={() => send({ type: "start" })}>
            Start game
          </button>
          {filled < 2 && <p className="muted small">Needs players in at least two teams.</p>}
        </div>
      )}
    </div>
  );
}

function Scores({ view }: { view: RoomView }) {
  return <Board rows={view.teams.filter((t) => t.size > 0 || t.score > 0).map((t) => ({ name: t.name, score: t.score }))} />;
}

function Round({ view, send, offset }: { view: RoomView; send: Send; offset: number }) {
  const me = view.me!;
  const left = useSecondsLeft(view.clueEndsAt, offset);
  const langs = view.pool === "both" ? ALL_LANGS : [view.pool];
  const search = useSearch(langs);
  const locked = view.locked.includes(me.team);
  const tried = view.guesses.filter((g) => !g.correct).map((g) => g.title);
  const team = view.teams[me.team]?.name;

  // A short buzz when a new clue opens, so heads look up from the call.
  useEffect(() => {
    buzz(40);
  }, [view.clue, view.round]);

  return (
    <div className="round">
      <div className="round-top">
        <span className="meta">
          Round {view.round + 1} of {view.totalRounds} · {team}
        </span>
        <span className="meta">Room {view.code}</span>
      </div>
      <div className="round-grid">
        <div className="round-main">
          <ol className="ladder">
            {CLUES.map((c, i) => (
              <li key={c.key} className={i === view.clue ? "on" : i > view.clue ? "locked" : undefined}>
                <span className="label">
                  {c.label} · {c.pts} {c.pts === 1 ? "pt" : "pts"}
                </span>
                <div className="clue">{view.clues[i]?.value ?? "Hidden"}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="round-side">
          <div className="timer-row">
            <Countdown left={left} total={CLUE_MS / 1000} />
            <p className="worth">Worth {CLUES[view.clue].pts}</p>
          </div>
          {locked ? (
            <p className="note" role="status">
              {team} has guessed on this clue. Wait for the next one.
            </p>
          ) : (
            <div className="stack">
              <span className="label">Guess for {team} · pick from the list</span>
              <TitleInput key={`${view.round}-${view.clue}`} index={search} exclude={tried} onPick={(title) => send({ type: "guess", title })} placeholder="Type the film's name" />
            </div>
          )}
          {view.guesses.length > 0 && (
            <ul className="guesses" aria-live="polite">
              {view.guesses.map((g, i) => (
                <li key={i}>
                  {view.teams[g.team]?.name}: {g.title} ✗ <span className="muted">({g.player})</span>
                </li>
              ))}
            </ul>
          )}
          <Scores view={view} />
          {me.isHost && (
            <div className="row">
              <button className="btn ghost" onClick={() => send({ type: view.clue < CLUES.length - 1 ? "nextClue" : "reveal" })}>
                {view.clue < CLUES.length - 1 ? "Next clue" : "Reveal"}
              </button>
              <button className="btn ghost" onClick={() => send({ type: "end" })}>
                End game
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Reveal({ view, send }: { view: RoomView; send: Send }) {
  const last = view.last;
  const isLast = view.round + 1 >= view.totalRounds;
  const winner = last && last.team !== null ? view.teams[last.team]?.name : null;
  return (
    <div className="setup stack">
      <span className="label">
        Round {view.round + 1} of {view.totalRounds} · {winner ? `${winner} got it · +${last!.points}${last!.by ? ` (${last!.by})` : ""}` : "Nobody got it"}
      </span>
      <h2 className="reveal-title">
        {view.answer?.title} <span className="muted">({view.answer?.year})</span>
      </h2>
      <Scores view={view} />
      {view.me?.isHost ? (
        <button className="btn block xl" onClick={() => send({ type: "nextRound" })}>
          {isLast ? "See final scores" : "Next round"}
        </button>
      ) : (
        <p className="muted">Waiting for the host to start the next round.</p>
      )}
    </div>
  );
}

function Over({ view, send }: { view: RoomView; send: Send }) {
  const ranked = [...view.teams].filter((t) => t.size > 0 || t.score > 0).sort((a, b) => b.score - a.score);
  const tie = ranked.length > 1 && ranked[0].score === ranked[1].score;
  return (
    <div className="setup stack">
      <span className="label">Game over</span>
      <h2>{ranked[0] && ranked[0].score > 0 ? (tie ? "It's a tie!" : `${ranked[0].name} wins!`) : "Good game!"}</h2>
      <Board rows={ranked.map((t) => ({ name: t.name, score: t.score }))} big />
      {view.history.length > 0 && (
        <ol className="history">
          {view.history.map((h, i) => (
            <li key={i}>
              {h.title} · {h.team !== null ? `${view.teams[h.team]?.name} +${h.points}` : "nobody"}
            </li>
          ))}
        </ol>
      )}
      {view.me?.isHost ? (
        <button className="btn block xl" onClick={() => send({ type: "playAgain" })}>
          Play again with this group
        </button>
      ) : (
        <p className="muted">The host can start another game with everyone here.</p>
      )}
    </div>
  );
}
