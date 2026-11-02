// Timepass room server: one Durable Object per room, holding the room's state
// and every phone's WebSocket. The game rules live in src/lib/rooms.ts.
//
//   POST /rooms                      create a room, returns { code }
//   GET  /rooms/<CODE>/ws?d=<device> WebSocket for one phone
//
// Phones send { type: "action", action } and receive { type: "view", view }
// (only what that phone may see) or { type: "error", message }.
import { DurableObject } from "cloudflare:workers";
import { apply, isExpired, newRoom, nextWake, randomCode, setConnected, tick, view, type Action, type Puzzle, type RoomState } from "../src/lib/rooms.ts";
import ALL_PUZZLES from "../src/content/generated/puzzles-all.json";

type Env = { ROOMS: DurableObjectNamespace<Room>; ALLOWED_ORIGINS: string };
const PUZZLES = ALL_PUZZLES as unknown as Puzzle[];
const CODE_RE = /^[A-HJ-NP-Z]{4}$/;
const DEVICE_RE = /^[A-Za-z0-9_-]{8,64}$/;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const ok = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).includes(origin);
  return ok ? { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, GET, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" } : {};
}
const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const headers = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/" || url.pathname === "/health") return json({ ok: true, puzzles: PUZZLES.length }, 200, headers);
    if (!headers["access-control-allow-origin"]) return json({ error: "Not allowed from this site" }, 403, {});

    if (req.method === "POST" && url.pathname === "/rooms") {
      for (let attempt = 0; attempt < 8; attempt++) {
        const code = randomCode();
        if (await env.ROOMS.get(env.ROOMS.idFromName(code)).init(code)) return json({ code }, 201, headers);
      }
      return json({ error: "Could not create a room. Try again." }, 503, headers);
    }
    const m = url.pathname.match(/^\/rooms\/([A-Z]+)\/ws$/);
    if (m && req.headers.get("upgrade") === "websocket") {
      if (!CODE_RE.test(m[1]) || !DEVICE_RE.test(url.searchParams.get("d") ?? "")) return json({ error: "Bad room code" }, 400, headers);
      return env.ROOMS.get(env.ROOMS.idFromName(m[1])).fetch(req);
    }
    return json({ error: "Not found" }, 404, headers);
  },
};

export class Room extends DurableObject<Env> {
  private state: RoomState | null | undefined;

  private async load(): Promise<RoomState | null> {
    if (this.state === undefined) this.state = (await this.ctx.storage.get<RoomState>("s")) ?? null;
    return this.state;
  }
  private async save(s: RoomState) {
    this.state = s;
    await this.ctx.storage.put("s", s);
    await this.ctx.storage.setAlarm(nextWake(s));
  }

  /** Creates the room if the code is free. */
  async init(code: string): Promise<boolean> {
    if (await this.load()) return false;
    await this.save(newRoom(code, Date.now()));
    return true;
  }

  async fetch(req: Request): Promise<Response> {
    const device = new URL(req.url).searchParams.get("d")!;
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, [device]);
    const s = await this.load();
    if (!s) {
      server.send(JSON.stringify({ type: "gone" }));
      server.close(4404, "No such room");
    } else {
      await this.save(setConnected(s, device, true, Date.now()));
      this.broadcast();
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const s = await this.load();
    if (!s || typeof raw !== "string" || raw.length > 2000) return;
    let msg: { type?: string; action?: Action };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (msg.type === "ping") return ws.send(JSON.stringify({ type: "pong", serverNow: Date.now() }));
    if (msg.type !== "action" || !msg.action) return;
    const [device] = this.ctx.getTags(ws);
    const out = apply(s, device, msg.action, Date.now(), PUZZLES);
    if (out.error) return ws.send(JSON.stringify({ type: "error", message: out.error }));
    await this.save(out.state);
    // A removed player's phone is told and disconnected.
    if (msg.action.type === "kick") {
      for (const w of this.ctx.getWebSockets(msg.action.target)) {
        w.send(JSON.stringify({ type: "kicked" }));
        w.close(4403, "Removed by host");
      }
    }
    this.broadcast();
  }

  async webSocketClose(ws: WebSocket) {
    const s = await this.load();
    const [device] = this.ctx.getTags(ws);
    if (!s || this.ctx.getWebSockets(device).some((w) => w !== ws && w.readyState === WebSocket.OPEN)) return;
    await this.save(setConnected(s, device, false, Date.now()));
    this.broadcast();
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    const s = await this.load();
    if (!s) return;
    const now = Date.now();
    if (isExpired(s, now)) {
      for (const w of this.ctx.getWebSockets()) w.close(4410, "Room expired");
      this.state = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    const next = tick(s, now);
    await this.save(next);
    if (next !== s) this.broadcast();
  }

  private broadcast() {
    const s = this.state;
    if (!s) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const [device] = this.ctx.getTags(ws);
      try {
        ws.send(JSON.stringify({ type: "view", view: view(s, device, now, PUZZLES) }));
      } catch {}
    }
  }
}
