#!/usr/bin/env node
/**
 * EH3D-STUDIO - tools/shots.mjs
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 *
 *   node tools/shots.mjs --url http://127.0.0.1:18299 --token TOKEN --out images/screenshots [--edge PATH] [--lang en] [--theme forge]
 *
 * Takes the pictures of the README: it opens Microsoft Edge without a window, signs in with the token, opens each page and saves a PNG. It needs a server that
 * serves Studio (the setting studio_dir) and has something to show (tools/demo_seed.mjs). It uses its own temporary profile and closes only the Edge it started.
 */
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const url = args.url;
const token = args.token;
const out = args.out ?? "images/screenshots";
const lang = args.lang ?? "en";
const theme = args.theme ?? "forge";
const edge =
  args.edge ??
  ["C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"].find((p) => existsSync(p));
if (!url || !token || !edge) {
  console.error("usage: node tools/shots.mjs --url URL --token TOKEN [--out DIR] [--edge PATH]");
  process.exit(2);
}
const PAGES = ["overview", "fleet", "jobs", "machines", "access", "server", "updates", "preferences"];
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(path.join(tmpdir(), "eh3d-studio-shots-"));
mkdirSync(out, { recursive: true });
const browser = spawn(edge, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--headless=new", "--hide-scrollbars", "--window-size=1400,860", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function targets() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = list.find((t) => t.type === "page");
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* the browser is still starting */
    }
    await sleep(250);
  }
  throw new Error("the browser did not start");
}

try {
  const ws = new WebSocket(await targets());
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) waiting.get(d.id)(d);
  };
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const n = ++id;
      waiting.set(n, resolve);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${url}/` });
  await sleep(800);
  // sign in as the person of the token: the application keeps its token and its choices in the storage of the page
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem("eh3d-studio.token", ${JSON.stringify(token)}); localStorage.setItem("eh3d-studio.lang", ${JSON.stringify(lang)}); localStorage.setItem("eh3d-studio.theme", ${JSON.stringify(theme)}); localStorage.setItem("eh3d-studio.refresh", "2");`,
  });
  for (const p of PAGES) {
    await send("Page.navigate", { url: `${url}/#/${p}` });
    await send("Page.reload");
    await sleep(p === "overview" || p === "fleet" ? 3500 : 1800);
    const shot = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(path.join(out, `${p}.png`), Buffer.from(shot.result.data, "base64"));
    console.log("saved", p);
  }
  ws.close();
} finally {
  browser.kill();
  await sleep(500);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch {
    /* Edge still holds a file for a moment; the temporary profile is cleaned with the temporary folder */
  }
}
