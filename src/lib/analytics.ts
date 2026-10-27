// One place for product analytics. Components call track(); this decides
// where events go. Today: PostHog (if a key is set). Swap or add tools here
// without touching game code.
import posthog from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
export const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID ?? "";

let started = false;

export function initAnalytics() {
  if (started || !POSTHOG_KEY || typeof window === "undefined") return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only", // anonymous by default (PRD principle 7)
    capture_pageview: true,
  });
  started = true;
}

// Event names follow PRD section 11. Room/link events arrive with online mode.
export type EventName =
  | "room_created"
  | "link_opened"
  | "player_joined"
  | "game_started"
  | "clue_played"
  | "answer_submitted"
  | "vote_cast"
  | "chain_broken"
  | "round_completed"
  | "game_completed"
  | "play_again"
  | "share_clicked"
  | "mistake_reported"
  | "disconnect";

export function track(event: EventName, props: Record<string, unknown> = {}) {
  if (process.env.NODE_ENV === "development") console.info("[track]", event, props);
  if (started) posthog.capture(event, props);
}
