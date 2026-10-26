"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Language } from "@/content/languages";
import {
  CLUE_ORDER,
  MAX_GUESSES,
  type CinemaPack,
  type CinemaPuzzle,
  type ClueKey,
} from "@/content/cinema/types";
import {
  istDateString,
  isCorrectGuess,
  normalizeTitle,
  puzzleIndexFor,
  puzzleNumberFor,
} from "@/lib/daily";
import {
  loadDayState,
  loadStats,
  recordResult,
  saveDayState,
  type DayState,
  type Stats,
} from "@/lib/storage";
import { track } from "@/lib/analytics";

const CLUE_LABEL: Record<ClueKey, string> = {
  emoji: "Emoji story",
  plot: "The story, simply",
  yearGenre: "Year & genre",
  hero: "Hero",
  heroine: "Heroine",
  director: "Director",
};

function clueText(p: CinemaPuzzle, key: ClueKey): string {
  if (key === "yearGenre") return `${p.year} · ${p.clues.genre}`;
  return p.clues[key];
}

// Today's IST date is only known in the browser, so the server renders a
// placeholder and the game mounts after hydration.
const noopSubscribe = () => () => {};

type Props = { pack: CinemaPack; language: Language };

export default function CinemaGame({ pack, language }: Props) {
  const today = useSyncExternalStore(noopSubscribe, istDateString, () => null);
  if (!today) {
    return <div className="mt-6 h-64 animate-pulse rounded-2xl bg-card" />;
  }
  return <Round key={today} pack={pack} language={language} today={today} />;
}

function Round({ pack, language, today }: Props & { today: string }) {
  const lang = language.code;
  const puzzle = pack.puzzles[puzzleIndexFor(today, pack.puzzles.length)];
  const number = puzzleNumberFor(today);

  const [state, setState] = useState<DayState>(() =>
    loadDayState(lang, today, puzzle.id),
  );
  const [stats, setStats] = useState<Stats>(() => loadStats(lang));
  const [input, setInput] = useState("");
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (state.guesses.length === 0 && state.status === "playing") {
      track("game_started", { game: "cinema", lang, puzzle: puzzle.id, number });
    }
    // Only on first mount for this day.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allTitles = useMemo(
    () =>
      Array.from(
        new Set([...pack.puzzles.map((p) => p.title), ...pack.extraTitles]),
      ).sort((a, b) => a.localeCompare(b)),
    [pack],
  );

  const suggestions = useMemo(() => {
    const q = normalizeTitle(input);
    if (q.length < 2) return [];
    return allTitles.filter((t) => normalizeTitle(t).includes(q)).slice(0, 5);
  }, [input, allTitles]);

  const done = state.status !== "playing";
  const cluesShown = done ? MAX_GUESSES : state.guesses.length + 1;

  function commit(guess: string) {
    const correct = guess !== "" && isCorrectGuess(guess, puzzle);
    const guesses = [...state.guesses, guess];
    const status = correct
      ? "won"
      : guesses.length >= MAX_GUESSES
        ? "lost"
        : "playing";
    const next: DayState = { ...state, guesses, status };
    setState(next);
    saveDayState(lang, next);
    setInput("");

    const props = { game: "cinema", lang, puzzle: puzzle.id, attempt: guesses.length };
    if (guess === "") track("clue_skipped", props);
    else track("guess_made", { ...props, correct });

    if (!correct && guess !== "") {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    if (status !== "playing") {
      setStats(recordResult(lang, today, status === "won", guesses.length));
      track(status === "won" ? "game_won" : "game_lost", props);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const guess = input.trim();
    if (!guess || done) return;
    const already = state.guesses.some(
      (g) => g && normalizeTitle(g) === normalizeTitle(guess),
    );
    if (already) return;
    commit(guess);
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-extrabold">
          {language.native} <span className="text-marigold">Cinema</span>
        </h1>
        <span className="text-sm text-muted">#{number}</span>
      </div>

      <ol className="space-y-2">
        {CLUE_ORDER.map((key, i) => {
          const shown = i < cluesShown;
          return (
            <li
              key={key}
              className={`rounded-xl border px-4 py-3 transition ${
                shown ? "border-line bg-card" : "border-dashed border-line opacity-50"
              }`}
            >
              <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                {i + 1}. {CLUE_LABEL[key]}
              </div>
              <div className={key === "emoji" ? "mt-1 text-2xl" : "mt-1"}>
                {shown ? clueText(puzzle, key) : "🔒"}
              </div>
            </li>
          );
        })}
      </ol>

      {state.guesses.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-sm">
          {state.guesses.map((g, i) => {
            const right = g !== "" && isCorrectGuess(g, puzzle);
            return (
              <li
                key={i}
                className={`rounded-full px-3 py-1 ${
                  right
                    ? "bg-leaf text-white"
                    : g === ""
                      ? "bg-line text-muted"
                      : "bg-kumkum/15 text-kumkum line-through"
                }`}
              >
                {g === "" ? "skipped" : g}
              </li>
            );
          })}
        </ul>
      )}

      {done ? (
        <Result
          puzzle={puzzle}
          state={state}
          stats={stats}
          language={language}
          number={number}
        />
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <div className={shake ? "animate-[shake_0.4s]" : ""}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type the movie name…"
              autoComplete="off"
              enterKeyHint="go"
              className="w-full rounded-xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-marigold"
            />
          </div>
          {suggestions.length > 0 && (
            <ul className="overflow-hidden rounded-xl border border-line bg-card">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => commit(s)}
                    className="block w-full px-4 py-2 text-left hover:bg-marigold-soft"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => commit("")}
              className="rounded-xl border border-line py-3 font-semibold text-muted active:scale-95"
            >
              Skip
            </button>
            <button
              type="submit"
              className="col-span-2 rounded-xl bg-marigold py-3 font-bold text-[#2a1a12] active:scale-95"
            >
              Guess ({MAX_GUESSES - state.guesses.length} left)
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Result({
  puzzle,
  state,
  stats,
  language,
  number,
}: {
  puzzle: CinemaPuzzle;
  state: DayState;
  stats: Stats;
  language: Language;
  number: number;
}) {
  const won = state.status === "won";
  const [copied, setCopied] = useState(false);

  const marks: string[] = state.guesses.map((g) =>
    g === "" ? "⬛" : isCorrectGuess(g, puzzle) ? "🟩" : "🟥",
  );
  while (marks.length < MAX_GUESSES) marks.push("⬜");
  const squares = marks.join("");
  const score = won ? `${state.guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/cinema/${language.code}`
      : "";
  const shareText = `Timepass 🎬 ${language.name} Cinema #${number} ${score}\n${squares}\n${url}`;

  async function share(channel: "native" | "whatsapp" | "copy") {
    track("result_shared", { game: "cinema", lang: language.code, channel, won });
    if (channel === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, "_blank");
      return;
    }
    if (channel === "native" && navigator.share) {
      try {
        await navigator.share({ text: shareText });
        return;
      } catch {
        // Cancelled: fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked; nothing else to do.
    }
  }

  const winPct = stats.played ? Math.round((stats.won / stats.played) * 100) : 0;

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-5">
      <div>
        <p className="text-sm text-muted">{won ? "Correct! 🎉" : "So close 😅 It was"}</p>
        <p className="text-2xl font-extrabold">
          {puzzle.title} <span className="text-base font-normal text-muted">({puzzle.year})</span>
        </p>
      </div>

      <div className="text-2xl tracking-widest">{squares}</div>

      <dl className="grid grid-cols-4 gap-2 text-center">
        {[
          ["Played", stats.played],
          ["Win %", winPct],
          ["Streak", stats.currentStreak],
          ["Best", stats.maxStreak],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => share("whatsapp")}
          className="rounded-xl bg-[#25d366] py-3 font-bold text-white active:scale-95"
        >
          WhatsApp
        </button>
        <button
          onClick={() => share("native")}
          className="rounded-xl bg-marigold py-3 font-bold text-[#2a1a12] active:scale-95"
        >
          {copied ? "Copied!" : "Share"}
        </button>
      </div>
      <p className="text-center text-sm text-muted">New movie at midnight. Come back tomorrow!</p>
    </div>
  );
}
