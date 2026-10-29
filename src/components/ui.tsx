"use client";

import { Fragment, useMemo, useState, useSyncExternalStore } from "react";
import { normalizeTitle, suggest } from "@/lib/game";
import { loadState, saveState } from "@/lib/store";
import { canFullscreen, toggleFullscreen } from "@/lib/device";

/* ---------- Hash routing: works on GitHub Pages and any static host ---------- */

export type Route = "home" | "movie-guess" | "imposter";

function readRoute(): Route {
  const h = typeof window === "undefined" ? "" : window.location.hash.replace(/^#\/?/, "");
  return h === "movie-guess" || h === "imposter" ? h : "home";
}
function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
export function useRoute(): Route | null {
  return useSyncExternalStore(subscribeHash, readRoute, () => null);
}
// Plain #name hashes (no #/path) so links survive every static host.
export const href = (r: Route) => (r === "home" ? "#" : `#${r}`);

/* ---------- Top bar + theme switch (mirrors the portfolio) ---------- */

export function Bar({ route }: { route: Route | null }) {
  // "Movie " hides on small phones so the menu fits beside the Beta tag.
  const links: [Route, string, string][] = [
    ["movie-guess", "Movie ", "Guess"],
    ["imposter", "", "Imposter"],
  ];
  return (
    <header className="bar">
      <div className="in">
        <a className="wordmark" href={href("home")}>
          timepass<span>.</span>
        </a>
        <span className="beta" title="Beta: still being tested. Expect changes.">Beta</span>
        <nav aria-label="Games">
          {links.map(([r, pre, label]) => (
            <a key={r} href={href(r)} className={route === r ? "on" : undefined}>
              {pre && <span className="full">{pre}</span>}
              {label}
            </a>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}

function currentTheme(): "light" | "dark" {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
function subscribeTheme(cb: () => void) {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  window.addEventListener("timepass-theme", cb);
  return () => {
    mq.removeEventListener("change", cb);
    window.removeEventListener("timepass-theme", cb);
  };
}

function ThemeToggle() {
  const mode = useSyncExternalStore(subscribeTheme, currentTheme, () => null);
  function flip() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("timepass:theme", next);
    } catch {}
    window.dispatchEvent(new Event("timepass-theme"));
  }
  return (
    <button type="button" className="theme" onClick={flip} aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}>
      {mode === "light" ? (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------- Segmented control ---------- */

export function Seg<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string; disabled?: boolean }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} disabled={o.disabled} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Title input with autocomplete (PRD MG-3) ---------- */

export function TitleInput({
  titles,
  onPick,
  placeholder = "Type a movie name",
  allowFreeText = false,
  autoFocus = false,
  aliases,
}: {
  titles: string[];
  onPick: (title: string) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  autoFocus?: boolean;
  /** title -> accepted alternative spellings, matched in suggestions */
  aliases?: Record<string, string[]>;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => suggest(q, titles, 5, aliases), [q, titles, aliases]);
  function pick(t: string) {
    setQ("");
    onPick(t);
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (allowFreeText) {
          if (list[0]) pick(list[0]);
          else if (q.trim().length >= 2) pick(q.trim());
          return;
        }
        // Pick-from-list only: Enter submits just when the choice is certain,
        // so a half-typed word never sends the wrong film.
        const exact = list.find((t) => normalizeTitle(t) === normalizeTitle(q));
        if (exact) pick(exact);
        else if (list.length === 1) pick(list[0]);
      }}
    >
      <input
        className="input"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        autoFocus={autoFocus}
        aria-label={placeholder}
      />
      {list.length > 0 && (
        <ul className="sugg">
          {list.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => pick(t)}>
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
      {allowFreeText && q.trim().length >= 2 && !list.some((t) => t.toLowerCase() === q.trim().toLowerCase()) && (
        <button type="submit" className="btn ghost">
          Use “{q.trim()}”
        </button>
      )}
    </form>
  );
}

/* ---------- Read-aloud placeholder until narrated audio exists ---------- */

export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return false;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voice = synth.getVoices().find((v) => v.lang === "en-IN");
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-IN";
    u.rate = 0.95;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {}
}

/* ---------- Scoreboard ---------- */

export function Board({ rows, big = false }: { rows: { name: string; score: number }[]; big?: boolean }) {
  const top = Math.max(...rows.map((r) => r.score));
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return (
    <div className={`board${big ? " big" : ""}`}>
      {sorted.map((r, i) => (
        <div key={r.name} className={`r${r.score === top && top > 0 ? " lead" : ""}`}>
          <span className="n">{i + 1}</span>
          <span className="who">{r.name}</span>
          <span className="s">{r.score}</span>
        </div>
      ))}
    </div>
  );
}

/** Editable list of names: teams in Movie Guess, players in Imposter. Tap a name to rename it. */
export function NameList({
  names,
  setNames,
  min,
  max,
  noun,
}: {
  names: string[];
  setNames: (n: string[]) => void;
  min: number;
  max: number;
  noun: string;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const clean = draft.trim().slice(0, 16);
  const taken = (s: string, except = -1) => names.some((n, i) => i !== except && n.toLowerCase() === s.toLowerCase());

  function saveEdit(i: number) {
    const v = editText.trim().slice(0, 16);
    if (v.length >= 2 && !taken(v, i)) setNames(names.map((n, j) => (j === i ? v : n)));
    setEditing(null);
  }

  return (
    <div className="stack">
      {names.length > 0 && (
        <ul className="players">
          {names.map((n, i) => (
            <li key={n}>
              {editing === i ? (
                <form
                  className="rename"
                  onSubmit={(e) => {
                    e.preventDefault();
                    saveEdit(i);
                  }}
                >
                  <input
                    className="input"
                    value={editText}
                    maxLength={16}
                    autoFocus
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(i)}
                    aria-label={`Rename ${n}`}
                  />
                </form>
              ) : (
                <button
                  type="button"
                  className="name"
                  onClick={() => {
                    setEditing(i);
                    setEditText(n);
                  }}
                  aria-label={`Rename ${n}`}
                >
                  {n}
                  <span className="edit" aria-hidden>
                    Edit
                  </span>
                </button>
              )}
              {names.length > min && editing !== i && (
                <button type="button" className="x" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {names.length < max && (
        <form
          className="row add"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean.length >= 2 && !taken(clean)) {
              setNames([...names, clean]);
              setDraft("");
            }
          }}
        >
          <input
            className="input"
            value={draft}
            maxLength={16}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add ${noun}`}
            aria-label={`Add ${noun}`}
            enterKeyHint="enter"
          />
          <button className="btn ghost" type="submit" disabled={clean.length < 2 || taken(clean)}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}

/* ---------- How to play: shown the first time, reopenable ---------- */

export function HowToPlay({ id, title, steps }: { id: string; title: string; steps: string[] }) {
  const key = `seen-rules:${id}`;
  const [open, setOpen] = useState(() => !loadState<boolean>(key, false));
  function close() {
    saveState(key, true);
    setOpen(false);
  }
  if (!open) {
    return (
      <button type="button" className="link" onClick={() => setOpen(true)}>
        How to play
      </button>
    );
  }
  return (
    <div className="rules rise" role="note">
      <span className="label">{title}</span>
      <ol>
        {steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <button type="button" className="btn ghost" onClick={close}>
        Got it
      </button>
    </div>
  );
}

/* ---------- Countdown ring ---------- */

export function Countdown({ left, total }: { left: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const low = left <= 5;
  return (
    <div className={`count${low ? " low" : ""}${left === 0 ? " done" : ""}`} role="timer" aria-label={`${left} seconds left`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="track" />
        <circle cx="32" cy="32" r={r} className="arc" strokeDasharray={c} strokeDashoffset={c * (1 - left / total)} />
      </svg>
      <span>{left > 0 ? left : "0"}</span>
    </div>
  );
}

/* ---------- Press and hold to reveal (pass-and-play secrets) ---------- */

export function HoldReveal({ label, secret, onSeen }: { label: string; secret: string; onSeen: () => void }) {
  const [shown, setShown] = useState(false);
  const show = () => {
    setShown(true);
    onSeen();
  };
  const hide = () => setShown(false);
  return (
    <button
      type="button"
      className={`hold${shown ? " on" : ""}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        show();
      }}
      onPointerUp={hide}
      onPointerCancel={hide}
      onLostPointerCapture={hide}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          show();
        }
      }}
      onKeyUp={hide}
      onBlur={hide}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={shown ? secret : `${label}: press and hold to see`}
    >
      <span className="label">{label}</span>
      <span className="big" aria-hidden={!shown}>
        {shown ? secret : "Press and hold"}
      </span>
      <span className="small muted">{shown ? "Let go to hide" : "Only you should see this"}</span>
    </button>
  );
}

/* ---------- In-game toolbar: sound, full screen, end game ---------- */

export function GameTools({
  sound,
  setSound,
  onEnd,
}: {
  sound?: boolean;
  setSound?: (v: boolean) => void;
  onEnd: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const fs = useSyncExternalStore(
    () => () => {},
    () => canFullscreen(),
    () => false,
  );
  if (confirm) {
    return (
      <div className="tools confirm" role="alertdialog" aria-label="End this game?">
        <span>End this game? Scores will be cleared.</span>
        <button type="button" className="chipbtn" onClick={() => setConfirm(false)}>
          Keep playing
        </button>
        <button type="button" className="chipbtn danger" onClick={onEnd}>
          End game
        </button>
      </div>
    );
  }
  return (
    <div className="tools">
      {setSound && (
        <button type="button" className="chipbtn" aria-pressed={sound} onClick={() => setSound(!sound)}>
          {sound ? "Sound on" : "Sound off"}
        </button>
      )}
      {fs && (
        <button type="button" className="chipbtn" onClick={toggleFullscreen}>
          Full screen
        </button>
      )}
      <button type="button" className="chipbtn" onClick={() => setConfirm(true)}>
        End game
      </button>
    </div>
  );
}

/** Used by Home to show "Resume" cards; reads storage after hydration only. */
export function useSavedGame(key: string): string | null {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return window.localStorage.getItem(`timepass:${key}`);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/* ---------- Word-by-word italic on hover (same effect as the portfolio) ---------- */

/** Splits text into words that each turn italic under the pointer. */
export function Words({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={i}>
          <span className="wi">{w}</span>
          {i < words.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
