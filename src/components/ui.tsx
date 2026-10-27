"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { suggest } from "@/lib/game";

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
  const links: [Route, string, string][] = [
    ["movie-guess", "01", "Movie Guess"],
    ["imposter", "02", "Imposter"],
  ];
  return (
    <header className="bar">
      <div className="in">
        <a className="wordmark" href={href("home")}>
          timepass<span>.</span>
        </a>
        <nav aria-label="Games">
          {links.map(([r, n, label]) => (
            <a key={r} href={href(r)} className={route === r ? "on" : undefined}>
              <span>{n}</span>
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

function ThemeToggle() {
  const [mode, setMode] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const paint = () => setMode(currentTheme());
    paint();
    mq.addEventListener("change", paint);
    return () => mq.removeEventListener("change", paint);
  }, []);
  function flip() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("timepass:theme", next);
    } catch {}
    setMode(next);
  }
  return (
    <button
      type="button"
      className="theme"
      onClick={flip}
      aria-label={`Switch to ${mode === "dark" ? "light" : "dark"} mode`}
    >
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
      <path d="M4 12 12 4M6 4h6v6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
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
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
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
}: {
  titles: string[];
  onPick: (title: string) => void;
  placeholder?: string;
  allowFreeText?: boolean;
  autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => suggest(q, titles), [q, titles]);
  function pick(t: string) {
    setQ("");
    onPick(t);
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        if (list[0]) pick(list[0]);
        else if (allowFreeText && q.trim().length >= 2) pick(q.trim());
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

export function Board({ rows }: { rows: { name: string; score: number }[] }) {
  const top = Math.max(...rows.map((r) => r.score));
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  return (
    <div className="board">
      {sorted.map((r, i) => (
        <div key={r.name} className={`r${r.score === top && top > 0 ? " lead" : ""}`}>
          <span className="n">{String(i + 1).padStart(2, "0")}</span>
          <span style={{ fontWeight: 700 }}>{r.name}</span>
          <span className="s">{r.score}</span>
        </div>
      ))}
    </div>
  );
}

/** Editable list of names: teams in Movie Guess, players in Imposter. */
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
  const clean = draft.trim().slice(0, 16);
  const dup = names.some((n) => n.toLowerCase() === clean.toLowerCase());
  return (
    <div className="stack">
      <ul className="players">
        {names.map((n, i) => (
          <li key={n}>
            <span className="n">{String(i + 1).padStart(2, "0")}</span>
            <span className="name">{n}</span>
            {names.length > min && (
              <button type="button" className="x" aria-label={`Remove ${n}`} onClick={() => setNames(names.filter((x) => x !== n))}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      {names.length < max && (
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            if (clean.length >= 2 && !dup) {
              setNames([...names, clean]);
              setDraft("");
            }
          }}
        >
          <input
            className="input"
            style={{ flex: "1 1 160px" }}
            value={draft}
            maxLength={16}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Add ${noun} (2–16 letters)`}
            aria-label={`Add ${noun}`}
          />
          <button className="btn ghost" type="submit" disabled={clean.length < 2 || dup}>
            Add
          </button>
        </form>
      )}
    </div>
  );
}
