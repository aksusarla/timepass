// One place for product analytics. Components call track(); this decides
// where events go. Today: PostHog (if a key is set). Swap or add tools here
// without touching game code.
import posthog from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

let started = false;

export function initAnalytics() {
  if (started || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only", // anonymous by default, cheaper
    capture_pageview: true,
  });
  started = true;
}

// The events that matter for Stage 1-3: did they start, finish, share, and
// come back the next day (PostHog retention is built from game_started).
export type EventName =
  | "game_started"
  | "guess_made"
  | "clue_skipped"
  | "game_won"
  | "game_lost"
  | "result_shared";

export function track(event: EventName, props: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "development") {
    console.info("[track]", event, props);
  }
  if (started) posthog.capture(event, props);
}
