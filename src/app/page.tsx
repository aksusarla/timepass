import Link from "next/link";
import { LANGUAGES } from "@/content/languages";

const COMING_SOON = [
  { name: "Desi Dumb Charades", emoji: "🎭" },
  { name: "Who's Most Likely To", emoji: "👉" },
  { name: "Bluff the Group", emoji: "🤥" },
];

export default function Home() {
  return (
    <div className="space-y-8 pt-4">
      <section>
        <h1 className="text-3xl font-extrabold leading-tight">
          Bored? Get-together going quiet?
        </h1>
        <p className="mt-2 text-muted">
          Quick desi games for everyone, from kids to grandparents. No app, no
          login. Just play.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            🎬
          </span>
          <div>
            <h2 className="text-lg font-bold">Daily Cinema</h2>
            <p className="text-sm text-muted">
              Guess today&apos;s movie in 6 clues. New film every midnight.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {LANGUAGES.map((l) =>
            l.live ? (
              <Link
                key={l.code}
                href={`/cinema/${l.code}`}
                className="rounded-xl bg-marigold-soft px-3 py-3 text-center font-semibold transition active:scale-95"
              >
                <span className="block text-lg">{l.native}</span>
                <span className="block text-xs text-muted">{l.name}</span>
              </Link>
            ) : (
              <div
                key={l.code}
                className="rounded-xl border border-dashed border-line px-3 py-3 text-center opacity-60"
              >
                <span className="block text-lg">{l.native}</span>
                <span className="block text-xs text-muted">Coming soon</span>
              </div>
            ),
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Coming next
        </h2>
        <ul className="space-y-2">
          {COMING_SOON.map((g) => (
            <li
              key={g.name}
              className="flex items-center gap-3 rounded-xl border border-line px-4 py-3 text-muted"
            >
              <span aria-hidden>{g.emoji}</span>
              {g.name}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
