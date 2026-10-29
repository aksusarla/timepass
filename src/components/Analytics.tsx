"use client";

import { useEffect } from "react";
import { initAnalytics, landingParams, track } from "@/lib/analytics";

// Starts PostHog once per page load (only when NEXT_PUBLIC_POSTHOG_KEY is set)
// and credits visits that arrive from a shared result link (?ref=<room_id>).
export default function Analytics() {
  useEffect(() => {
    initAnalytics();
    const { ref, utm_source } = landingParams();
    if (ref) track("share_link_opened", { ref_room_id: ref, utm_source });
  }, []);
  return null;
}
