"use client";

import { useEffect } from "react";

/* Phone conveniences for a game in progress. Every one is optional: browsers
   that refuse (or don't support) them simply skip it. */

/** Keep the screen on while `active` (re-requested when the tab returns). */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let lock: { release: () => Promise<void> } | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await (navigator as Navigator & { wakeLock: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock.request("screen");
        if (cancelled) l.release().catch(() => {});
        else lock = l;
      } catch {}
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, [active]);
}

let audio: AudioContext | null = null;

/** Call from a tap (e.g. Start game) so later beeps are allowed to play. */
export function unlockAudio() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === "suspended") audio.resume().catch(() => {});
  } catch {}
}

/** A short tone. `kind` picks the pitch pattern. */
export function beep(kind: "tick" | "end" | "win" = "tick") {
  try {
    if (!audio) return;
    const notes = kind === "win" ? [660, 880] : kind === "end" ? [440, 330] : [880];
    notes.forEach((freq, i) => {
      const t = audio!.currentTime + i * 0.14;
      const osc = audio!.createOscillator();
      const gain = audio!.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      osc.connect(gain).connect(audio!.destination);
      osc.start(t);
      osc.stop(t + 0.15);
    });
  } catch {}
}

export function buzz(pattern: number | number[] = 60) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export function canFullscreen() {
  return typeof document !== "undefined" && !!document.documentElement.requestFullscreen;
}

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {}
}
