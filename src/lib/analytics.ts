// One place for product analytics (tracking plan v1, project doc
// "timepass-analytics-posthog-tracking-plan"). Components call track() with a
// name from EventName; nothing else talks to PostHog directly.
//
// Privacy (DPDP Act 2023): no names, nicknames, typed movie titles, phone
// numbers or emails are ever sent. Inputs are masked in session replays,
// Do Not Track is respected, and there is no autocapture.
import posthog from "posthog-js";

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
// EU region by default (tracking plan §1: stricter data-protection posture).
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "dev";

/** Event dictionary. Never rename a live event: add a new one and log it in the plan's changelog. */
export type EventName =
  // Tracking plan v1, §3
  | "landing_viewed"
  | "game_selected"
  | "room_created"
  | "room_joined" // online mode (not built yet)
  | "game_started"
  | "round_completed"
  | "game_ended"
  | "share_clicked"
  | "share_link_opened"
  | "feedback_given"
  // Kept from PRD §11 / v0.4 handoff for per-clue and per-answer detail
  | "clue_played"
  | "answer_submitted"
  | "vote_cast"
  | "play_again";

export type Props = Record<string, string | number | boolean | null | undefined>;

let started = false;

// Test hook: an automated test can define window.__tpEvents = [] before the
// page loads to see exactly what would be sent. Real visitors never have it.
type TestSink = { __tpEvents?: { event: string; props: Props }[] };
function testSink(event: string, props: Props) {
  if (typeof window === "undefined") return;
  const sink = (window as unknown as TestSink).__tpEvents;
  if (Array.isArray(sink)) sink.push({ event, props });
}
const TEAM_KEY = "timepass:team";

function teamMember(): boolean {
  try {
    const q = new URLSearchParams(window.location.search).get("team");
    if (q === "1") localStorage.setItem(TEAM_KEY, "1");
    if (q === "0") localStorage.removeItem(TEAM_KEY);
    return localStorage.getItem(TEAM_KEY) === "1";
  } catch {
    return false;
  }
}

/** Safe to call many times; does nothing without a key (local dev, PR builds). */
export function initAnalytics() {
  if (started || typeof window === "undefined") return;
  started = true;
  const team = teamMember(); // read even without a key so ?team=1 sticks
  if (!POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: "identified_only", // login-free: anonymous users stay cheap
    capture_pageview: false, // hash routes: we send $pageview ourselves (pageview())
    capture_pageleave: true,
    autocapture: false, // named events only
    respect_dnt: true,
    session_recording: { maskAllInputs: true, maskTextSelector: "[data-private]" },
  });
  // Common properties on every event (plan §3).
  const common = { app_version: APP_VERSION, ui_language: "en", team_member: team };
  posthog.register(common);
  testSink("$register", common);
}

export const isAnalyticsOn = () => started && !!POSTHOG_KEY;

export function track(event: EventName, props: Props = {}) {
  initAnalytics();
  if (process.env.NODE_ENV === "development") console.info("[track]", event, props);
  testSink(event, props);
  if (POSTHOG_KEY) posthog.capture(event, props);
}

/** Hash-route page view, e.g. "home", "movie-guess". */
export function pageview(route: string) {
  initAnalytics();
  testSink("$pageview", { route });
  if (POSTHOG_KEY) posthog.capture("$pageview", { route, $current_url: window.location.href });
}

/** ?ref=<room_id> and utm_source from the landing URL, read once per page load. */
export function landingParams(): { ref: string | null; utm_source: string | null } {
  try {
    const q = new URLSearchParams(window.location.search);
    return { ref: q.get("ref"), utm_source: q.get("utm_source") };
  } catch {
    return { ref: null, utm_source: null };
  }
}

/** Short random id for a room (one hosting session). Not linked to any person. */
export function newRoomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "").slice(0, 10);
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

/** Wall-clock helpers kept here so components stay pure for the React linter. */
export const nowMs = () => Date.now();
export const secondsSince = (ms: number | undefined) => (ms ? Math.round((Date.now() - ms) / 1000) : null);

/** Link to share: the site's home with ?ref=<room_id> so share_link_opened can credit the room. */
export function shareUrl(roomId: string | undefined): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return roomId ? `${base}?ref=${encodeURIComponent(roomId)}&utm_source=share` : base;
}
