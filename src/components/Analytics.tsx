"use client";

import Script from "next/script";
import { useEffect } from "react";
import { CLARITY_ID, initAnalytics } from "@/lib/analytics";

// Loads PostHog (events, retention) and Microsoft Clarity (session
// recordings + heatmaps). Each only turns on when its env var is set, so
// local development stays clean.
export default function Analytics() {
  useEffect(() => {
    initAnalytics();
  }, []);

  if (!CLARITY_ID) return null;
  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY_ID}");`}
    </Script>
  );
}
