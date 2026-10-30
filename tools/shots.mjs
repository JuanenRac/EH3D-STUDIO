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
const PAGES = ["overview", "fleet", "jobs", "job", "machine", "prepare", "machines", "access", "server", "updates", "preferences"];
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
  // the job page needs the id of a job: the first one that runs, else the first one
  const list = await (await fetch(`${url}/api/v1/jobs`, { headers: { authorization: `Bearer ${token}` } })).json();
  const shown = list.find((j) => j.state === "running" || j.state === "waiting_operator") ?? list[0];
  for (const p of PAGES) {
    if ((p === "job" || p === "machine") && !shown) continue;
    const route = p === "job" ? `job/${shown.id}` : p === "machine" ? `machine/${encodeURIComponent(shown.machine)}` : p;
    await send("Page.navigate", { url: `${url}/#/${route}` });
    await send("Page.reload");
    await sleep(p === "overview" || p === "fleet" ? 3500 : 1800);
    if (p === "prepare") {
      await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 1280, deviceScaleFactor: 1, mobile: false });
      // choose "holes typed here", type a few holes and look at the plan, as a person would
      const typed = await send("Runtime.evaluate", {
        expression: `(async () => {
          const set = (el, value) => { const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? "change" : "input", { bubbles: true })); };
          const selects = document.querySelectorAll("select");
          set(selects[1], "typed");
          await new Promise((r) => setTimeout(r, 300));
          const rows = [];
          for (let i = 0; i < 16; i++) rows.push("1 " + (10 + i * 4) + " 10", "1 " + (10 + i * 4) + " 18");
          for (let i = 0; i < 6; i++) rows.push("2 " + (14 + i * 7.62) + " 30");
          rows.push("3 4 4", "3 76 4", "3 4 36", "3 76 36");
          const text = rows.join(String.fromCharCode(10));
          set(document.querySelector("textarea"), text);
          await new Promise((r) => setTimeout(r, 300));
          [...document.querySelectorAll("button")].find((b) => !b.classList.contains("primary") && b.closest(".form-actions"))?.click();
        })()`,
        awaitPromise: true,
      });
      if (typed.result?.exceptionDetails) console.error("the typed holes failed:", JSON.stringify(typed.result.exceptionDetails.exception?.description ?? typed.result.exceptionDetails.text));
      await sleep(1500);
    }
    const shot = await send("Page.captureScreenshot", { format: "png" });
    if (p === "prepare") await send("Emulation.setDeviceMetricsOverride", { width: 1400, height: 860, deviceScaleFactor: 1, mobile: false });
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
