#!/usr/bin/env node
/**
 * EH3D-STUDIO - tools/demo_seed.mjs
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 *
 *   node tools/demo_seed.mjs http://127.0.0.1:18299 SETUP_CODE
 *
 * Fills a NEW, EMPTY EH3D server with a few simulated machines in three stations, two people, a token and a few jobs (one of them started), so that the
 * pages of Studio have something to show for the pictures of the README. It refuses to touch a server that already has a user. It prints the login token
 * of the administrator it made.
 */
const [base, code] = process.argv.slice(2);
if (!base || !code) {
  console.error("usage: node tools/demo_seed.mjs SERVER_URL SETUP_CODE");
  process.exit(2);
}

async function call(method, path, body, token) {
  const r = await fetch(base + "/api/v1" + path, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${text}`);
  return data;
}

const status = await call("GET", "/setup");
if (!status.needed) {
  console.error("this server already has a user: nothing was changed");
  process.exit(1);
}
await call("POST", "/setup", { code, name: "admin", password: "demo-password-1" });
const { token } = await call("POST", "/login", { name: "admin", password: "demo-password-1" });

const machines = [
  ["bench-1", "Bungard CCD 1", "ccd-mtc", "bench"],
  ["bench-2", "Bungard CCD 2", "ccd-mtc", "bench"],
  ["bench-3", "Bungard CCD 3", "ccd-atc", "bench"],
  ["room-1", "Router 1", "ccd-atc", "room"],
  ["room-2", "Router 2", "ccd-mtc", "room"],
  ["spare", "Spare machine", "ccd-mtc", ""],
];
for (const [id, name, model, station] of machines) {
  await call("POST", "/machines", { id, name, model, station, connection: { kind: "demo" }, dcf: "", rcf: "", cfg: "" }, token);
}
await call("POST", "/users", { name: "ana", role: "operator", password: "demo-password-2" }, token);
await call("POST", "/users", { name: "luis", role: "viewer", password: "demo-password-3" }, token);
await call("POST", "/tokens", { name: "drillpro-bench", role: "operator" }, token);

// a board with three tools: rows of small pads, a connector with bigger holes and four mounting holes at the corners
const board = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ tool: 1, x_mm: 8 + (i % 20) * 3.5, y_mm: 8 + Math.floor(i / 20) * 5 });
  for (let i = 0; i < 12; i++) out.push({ tool: 2, x_mm: 10 + i * 5.08, y_mm: 4 });
  for (const [x, y] of [[3, 3], [3, 47], [80, 3], [80, 47]]) out.push({ tool: 3, x_mm: x, y_mm: y });
  return out;
};
const job = (name, n) => ({
  kind: "drill",
  name,
  board_mm: 1.6,
  tools: [
    { number: 1, extra_stroke_mm: 0, feed_mm_min: 1000, spindle_rpm: 24000 },
    { number: 2, extra_stroke_mm: 0, feed_mm_min: 900, spindle_rpm: 24000 },
    { number: 3, extra_stroke_mm: 0, feed_mm_min: 700, spindle_rpm: 20000 },
  ],
  holes: board(n),
});
const made = [];
for (const [machine, name, n] of [["bench-1", "power-board", 400], ["bench-2", "sensor", 120], ["room-1", "frame", 60], ["bench-3", "led-strip", 80]]) {
  made.push(await call("POST", `/machines/${machine}/jobs`, job(name, n), token));
}
// the first one is started, so that the fleet and the list have a job in progress
await call("POST", `/jobs/${made[0].id}/start`, {}, token);
console.log(token);
