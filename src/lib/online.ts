"use client";

// Talks to the room server (rooms/worker.ts). The site works without it: when
// NEXT_PUBLIC_ROOMS_URL is not set at build time, online mode stays hidden.
import { useCallback, useEffect, useRef, useState } from "react";
import type { Action, RoomView } from "@/lib/rooms";
import { loadState, saveState } from "@/lib/store";

export const ROOMS_URL = (process.env.NEXT_PUBLIC_ROOMS_URL ?? "").replace(/\/$/, "");
export const onlineEnabled = ROOMS_URL !== "";
export const CODE_RE = /^[A-HJ-NP-Z]{4}$/;

/** Anonymous id for this browser, so a refresh returns you to your seat (PRD 6.2). */
export function deviceId(): string {
  let id = loadState<string>("device", "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 20);
    saveState("device", id);
  }
  return id;
}

export async function createRoom(): Promise<string> {
  const res = await fetch(`${ROOMS_URL}/rooms`, { method: "POST" });
  const body = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
  if (!res.ok || !body.code) throw new Error(body.error ?? "Could not create a room. Check your connection and try again.");
  return body.code;
}

export const roomHash = (code: string) => `#room=${code}`;
export function roomLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}${roomHash(code)}`;
}
export function codeFromHash(): string | null {
  const m = window.location.hash.match(/room=([A-Za-z]{4})/);
  return m ? m[1].toUpperCase() : null;
}

export type Status = "connecting" | "open" | "reconnecting" | "gone" | "kicked";

/** Live connection to one room, reconnecting after drops (PRD R-6). */
export function useRoom(code: string) {
  const [view, setView] = useState<RoomView | null>(null);
  const [status, setStatus] = useState<Status>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0); // server clock minus this phone's clock
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let timer: number | undefined;
    const connect = () => {
      const ws = new WebSocket(`${ROOMS_URL.replace(/^http/, "ws")}/rooms/${code}/ws?d=${deviceId()}`);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
      };
      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data as string);
        if (msg.type === "view") {
          setView(msg.view as RoomView);
          setOffset(msg.view.serverNow - Date.now());
        } else if (msg.type === "error") setError(msg.message);
        else if (msg.type === "gone") setStatus("gone");
        else if (msg.type === "kicked") setStatus("kicked");
      };
      ws.onclose = (e) => {
        if (stopped) return;
        if (e.code === 4404 || e.code === 4410) return setStatus("gone");
        if (e.code === 4403) return setStatus("kicked");
        setStatus("reconnecting");
        timer = window.setTimeout(connect, Math.min(8000, 1000 * 2 ** retry++));
      };
    };
    connect();
    // Phones drop sockets when locked; reconnect as soon as the page is back.
    const onVisible = () => {
      if (document.visibilityState === "visible" && wsRef.current?.readyState === WebSocket.CLOSED) {
        window.clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close();
    };
  }, [code]);

  // Errors are shown briefly, then cleared.
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  const send = useCallback((action: Action) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "action", action }));
    else setError("Reconnecting… try again in a moment.");
  }, []);

  return { view, status, error, send, offset };
}

/** Seconds left until a server timestamp, ticking every quarter second. */
export function useSecondsLeft(endsAt: number | null, offset: number): number {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (endsAt === null) return;
    const update = () => setLeft(Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000)));
    update();
    const t = window.setInterval(update, 250);
    return () => window.clearInterval(t);
  }, [endsAt, offset]);
  return endsAt === null ? 0 : left;
}
