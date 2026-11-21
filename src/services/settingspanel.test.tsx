// @vitest-environment jsdom
/* The screen of the settings of the server drawn in a small DOM against a server that answers from a table of routes: the groups, the control of each type, the text in the language of the
 * person, the value in force and the default, the restart, the role that may change a setting, the checks before sending, the refusals of the server with the text of their code, the
 * confirmations, the secret that is never shown, the copy of the contract used when the live one cannot be read, and a key that nobody described. The logic under it is tested in
 * ../settingscontract.test.ts. GPL-3.0-or-later. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ServerSettings } from "../components/ServerSettings";
import { SecurityPage } from "../pages/SecurityPage";
import { makeErr, makeText } from "../context";
import type { Lang } from "../i18n";
import type { Role } from "../types";
import { EMBEDDED_CONTRACT } from "./embeddedcontract";
import { CONTRACT_SCHEMA, COPY_HASH } from "./settingscontract";
import type { Setting, SettingsContract } from "./settingscontract";
import { Providers, fakeServer, json, makeApp, makeServices, refusal } from "./testkit";
import type { Call, Handler } from "./testkit";
import type { AuthClaims } from "./types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let box: HTMLElement | null = null;

beforeEach(() => {
  box = document.createElement("div");
  document.body.appendChild(box);
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  box?.remove();
  box = null;
});

async function settle(times = 6) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** The values the server holds for every key that is not a secret: the defaults. */
function defaults(contract: SettingsContract = EMBEDDED_CONTRACT): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const s of contract.settings) if (!s.secret) values[s.key] = s.default;
  return values;
}

/** The answer of `GET /settings/values`: the default of every key, a path of the computer kept back, a secret as the mark. */
function lightFor(over: Record<string, unknown> = {}, extra: Record<string, unknown> = {}, hash: string = COPY_HASH) {
  const settings: Record<string, unknown> = {};
  for (const s of EMBEDDED_CONTRACT.settings) {
    if (s.secret) settings[s.key] = { v: "***", secret: true, editable: false };
    else if (s.format === "path") settings[s.key] = { hidden: true, origin: "file", editable: false };
    else settings[s.key] = { v: s.key in over ? over[s.key] : s.default, origin: s.key in over ? "override" : "file", editable: s.write.via === "policy" };
  }
  Object.assign(settings, extra);
  return { schema: "eh3d.settings.values/1", server_version: "1.2.3", contract_hash: hash, count: Object.keys(settings).length, settings };
}

/** The answer of `GET /settings/contract`. */
function liveAnswer(over: Record<string, unknown> = {}, contract: SettingsContract = EMBEDDED_CONTRACT) {
  return { ...contract, values: { ...defaults(contract), ...over }, server_version: "1.2.3" };
}

async function show(routes: Record<string, Handler>, role: Role = "admin", opts: { lang?: Lang; claims?: AuthClaims | null; embedded?: SettingsContract } = {}) {
  const server = fakeServer(routes);
  const lang = opts.lang ?? "en";
  const app = { ...makeApp(role), lang, t: makeText(lang), err: makeErr(lang) };
  const services = makeServices(server.fetcher, role, opts.claims ?? null);
  root = createRoot(box!);
  await act(async () => root!.render(<Providers app={app} services={services}><ServerSettings embedded={opts.embedded} /></Providers>));
  await settle();
  const $ = (s: string) => box!.querySelector(s);
  const $$ = (s: string) => [...box!.querySelectorAll(s)];
  return { server, text: () => box!.textContent ?? "", $, $$, row: (key: string) => $(`tr[data-setting="${key}"]`) as HTMLElement | null };
}

const button = (name: string, within: ParentNode = box!) => [...within.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;

async function click(el: Element | undefined | null) {
  expect(el, "the element to click").toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await settle();
}

async function typeInto(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function pick(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await settle();
}

/** A setting for the tests that is none of the real ones. */
function make(over: Partial<Setting> & { key: string }): Setting {
  return {
    group: "network",
    type: "boolean",
    default: false,
    apply: "now",
    write: { via: "policy", method: "PUT", path: "/api/v1/auth/policy" },
    role: "admin",
    scope: "admin:policy",
    confirm_when_looser: false,
    secret: false,
    risk: "none",
    label: { en: over.key, es: `${over.key} (es)` },
    help: { en: `help of ${over.key}` },
    warning: { en: `warning of ${over.key}` },
    ...over,
  };
}

function contractOf(settings: Setting[]): SettingsContract {
  return { schema: CONTRACT_SCHEMA, languages: ["en", "es", "de", "fr", "it", "ja", "zh", "pt"], groups: [{ id: "network", label: { en: "Network" } }], settings };
}

const putAnswer = (key: string, from: unknown, to: unknown, restart = false) => ({ changed: { key, from, to, apply: restart ? "restart" : "now", restart_required: restart } });

describe("the settings of the server, drawn from the live contract", () => {
  it("shows the 15 groups in the order of the contract and a row for every one of the 89 keys", async () => {
    const p = await show({ "GET /settings/contract": () => liveAnswer() });
    expect(p.text()).toContain("Contract read from the server 1.2.3.");
    expect(p.$$("section[data-group]").map((s) => s.getAttribute("data-group"))).toEqual(EMBEDDED_CONTRACT.groups.map((g) => g.id));
    expect(p.$$("h4")[0].textContent).toBe("Network");
    const rows = p.$$("tr[data-setting]");
    expect(rows).toHaveLength(EMBEDDED_CONTRACT.settings.length);
    for (const s of EMBEDDED_CONTRACT.settings) {
      const row = p.row(s.key);
      expect(row, s.key).toBeTruthy();
      expect(row!.querySelector("strong")!.textContent!.trim().length, `${s.key}: the label`).toBeGreaterThan(0);
      // every key has the control of its type, or says where it is set
      const hasControl = row!.querySelector("input, select") !== null;
      const fileText = row!.textContent!.includes("Set in server.cfg and read when the server starts.");
      expect(hasControl || fileText || s.secret, s.key).toBe(true);
    }
  });

  it("writes the label, the help and the warning in the language of the person, and English for a language the contract lacks", async () => {
    const live = { "GET /settings/contract": () => liveAnswer() };
    const es = await show(live, "admin", { lang: "es" });
    expect(es.$$("h4")[0].textContent).toBe("Red");
    expect(es.row("listen")!.textContent).toContain("Dirección de escucha");
    expect(es.text()).toContain("Contrato leído del servidor 1.2.3.");
    await act(async () => root!.unmount());
    root = null;
    const bg = await show(live, "admin", { lang: "bg" });
    expect(bg.$$("h4")[0].textContent).toBe("Network");
    expect(bg.row("listen")!.textContent).toContain("Listen address");
    expect(bg.text()).toContain("Договорът е прочетен от сървъра 1.2.3.");
    await act(async () => root!.unmount());
    root = null;
    const ptBr = await show(live, "admin", { lang: "pt-br" });
    expect(ptBr.row("listen")!.textContent).toContain("Endereço de escuta");
  });

  it("shows the value in force, the default and when a change applies", async () => {
    const p = await show({ "GET /settings/contract": () => liveAnswer({ login_ip_limit: 77, network_open: true }) });
    const limit = p.row("login_ip_limit")!;
    expect((limit.querySelector("input[aria-label=login_ip_limit]") as HTMLInputElement).value).toBe("77");
    expect(limit.textContent).toContain("Default:");
    expect(limit.textContent).toContain("Applies at once");
    expect(p.row("network_open")!.textContent).toContain("Needs a restart");
    expect(p.row("network_open")!.textContent).toContain("▲ Risky: read the warning.");
    // a key of server.cfg shows its value and says where it is set, with no control
    const listen = p.row("listen")!;
    expect(listen.textContent).toContain("127.0.0.1:18200");
    expect(listen.textContent).toContain("Set in server.cfg and read when the server starts.");
    expect(listen.querySelector("input, select, button")).toBeNull();
  });

  it("explains the switch that keeps the logins with the note of the table of security, and does not repeat it elsewhere", async () => {
    const p = await show({ "GET /settings/contract": () => liveAnswer() });
    expect(p.row("persist_sessions")!.textContent).toContain("Keep the sessions when the server restarts.");
    expect(p.$$("tr[data-setting=persist_sessions]")).toHaveLength(1);
  });

  it("draws a control for each type: a switch, a number with its unit and range, a text, a list and a choice", async () => {
    const contract = contractOf([
      make({ key: "flag" }),
      make({ key: "count", type: "integer", min: 2, max: 9, unit: "s", default: 5 }),
      make({ key: "name", type: "string", default: "a" }),
      make({ key: "tags", type: "list", default: [] }),
      make({ key: "mode", type: "enum", values: ["fast", "slow"], default: "fast" }),
    ]);
    const p = await show({ "GET /settings/contract": () => liveAnswer({}, contract) }, "admin", { embedded: contract });
    expect(p.row("flag")!.querySelector("input[type=checkbox][role=switch]")).toBeTruthy();
    const count = p.row("count")!;
    expect(count.querySelector("input[aria-label=count]")).toBeTruthy();
    expect(count.textContent).toContain("2–9 s");
    expect(p.row("name")!.querySelector("input[aria-label=name]")).toBeTruthy();
    expect(p.row("tags")!.querySelector("input[aria-label=tags]")).toBeTruthy();
    expect(p.row("tags")!.textContent).toContain("Separate the items with commas.");
    const mode = p.row("mode")!.querySelector("select") as HTMLSelectElement;
    expect([...mode.options].map((o) => o.value)).toEqual(["fast", "slow"]);
  });
});

describe("changing a setting", () => {
  it("asks first for a risky one, shows its warning, and sends nothing until it is confirmed", async () => {
    const puts: Call[] = [];
    const p = await show({
      "GET /settings/contract": () => liveAnswer(),
      "PUT /auth/policy": (c) => {
        puts.push(c);
        return putAnswer("mdns_announce", false, true);
      },
    });
    await click(p.row("mdns_announce")!.querySelector("input[role=switch]"));
    expect(puts).toHaveLength(0);
    const alert = p.$("[role=alert]")!;
    expect(alert.textContent).toContain("Changing mdns_announce is risky.");
    expect(alert.textContent).toContain("mdns_announce = true");
    await click(button("Cancel"));
    expect(puts).toHaveLength(0);
    expect(p.$("[role=alert]")).toBeNull();
    await click(p.row("mdns_announce")!.querySelector("input[role=switch]"));
    await click(button("Confirm"));
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ key: "mdns_announce", value: true, confirm_weak: true });
    expect(p.row("mdns_announce")!.textContent).toContain("Saved.");
    // the contract is read again to show the value in force
    expect(p.server.calls.filter((c) => c.path === "/settings/contract").length).toBeGreaterThanOrEqual(2);
  });

  it("sends a harmless change at once, and says when it takes effect only after a restart", async () => {
    const contract = contractOf([make({ key: "quiet" }), make({ key: "slow", type: "integer", min: 1, max: 9, default: 3, apply: "restart" })]);
    const puts: Call[] = [];
    const p = await show(
      {
        "GET /settings/contract": () => liveAnswer({}, contract),
        "PUT /auth/policy": (c) => {
          puts.push(c);
          const key = (c.body as { key: string }).key;
          return putAnswer(key, 3, 4, key === "slow");
        },
      },
      "admin",
      { embedded: contract },
    );
    await click(p.row("quiet")!.querySelector("input[role=switch]"));
    expect(puts[0].body).toEqual({ key: "quiet", value: true });
    expect(p.row("quiet")!.textContent).toContain("Saved.");
    expect(p.row("quiet")!.textContent).not.toContain("restarts");
    await typeInto(p.row("slow")!.querySelector("input")!, "4");
    await click(button("Save", p.row("slow")!));
    expect(puts[1].body).toEqual({ key: "slow", value: 4 });
    expect(p.row("slow")!.textContent).toContain("Saved. It takes effect when the server restarts.");
  });

  it("asks again when the server says the value is looser than recommended", async () => {
    const contract = contractOf([make({ key: "quiet" })]);
    const puts: Call[] = [];
    const p = await show(
      {
        "GET /settings/contract": () => liveAnswer({}, contract),
        "PUT /auth/policy": (c) => {
          puts.push(c);
          return (c.body as { confirm_weak?: boolean }).confirm_weak ? putAnswer("quiet", false, true) : refusal(409, "weak_confirm_required", "quiet");
        },
      },
      "admin",
      { embedded: contract },
    );
    await click(p.row("quiet")!.querySelector("input[role=switch]"));
    expect(puts).toHaveLength(1);
    expect(p.$("[role=alert]")!.textContent).toContain("less strict than recommended");
    await click(button("Confirm"));
    expect(puts[1].body).toEqual({ key: "quiet", value: true, confirm_weak: true });
    expect(p.$("[role=alert]")).toBeNull();
  });

  it("checks a number against its range before it is sent, and does not send a wrong one", async () => {
    const puts: Call[] = [];
    const p = await show({ "GET /settings/contract": () => liveAnswer(), "PUT /auth/policy": (c) => (puts.push(c), putAnswer("login_ip_limit", 0, 5)) });
    const row = () => p.row("login_ip_limit")!;
    const input = () => row().querySelector("input") as HTMLInputElement;
    for (const bad of ["abc", "5000", "-1", "2.5", ""]) {
      await typeInto(input(), bad);
      expect(row().textContent, bad).toContain("Enter a whole number from 0 to 1000.");
      expect(button("Save", row())!.disabled, bad).toBe(true);
    }
    expect(puts).toHaveLength(0);
    await typeInto(input(), "25");
    expect(row().textContent).not.toContain("Enter a whole number");
    expect(button("Save", row())!.disabled).toBe(false);
    await click(button("Save", row()));
    await click(button("Confirm"));
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ key: "login_ip_limit", value: 25, confirm_weak: true });
  });

  it("checks the length of a text and sends a list as items", async () => {
    const contract = contractOf([make({ key: "name", type: "string", max_length: 4, default: "ab" }), make({ key: "tags", type: "list", default: [] })]);
    const puts: Call[] = [];
    const p = await show({ "GET /settings/contract": () => liveAnswer({}, contract), "PUT /auth/policy": (c) => (puts.push(c), putAnswer("tags", [], ["x", "y"])) }, "admin", { embedded: contract });
    await typeInto(p.row("name")!.querySelector("input")!, "abcde");
    expect(p.row("name")!.textContent).toContain("The text is longer than 4 characters.");
    expect(button("Save", p.row("name")!)!.disabled).toBe(true);
    await typeInto(p.row("tags")!.querySelector("input")!, " x, y ,");
    await click(button("Save", p.row("tags")!));
    expect(puts[0].body).toEqual({ key: "tags", value: ["x", "y"] });
  });

  it("sends the choice of a list of choices", async () => {
    const contract = contractOf([make({ key: "mode", type: "enum", values: ["fast", "slow"], default: "fast" })]);
    const puts: Call[] = [];
    const p = await show({ "GET /settings/contract": () => liveAnswer({}, contract), "PUT /auth/policy": (c) => (puts.push(c), putAnswer("mode", "fast", "slow")) }, "admin", { embedded: contract });
    expect(button("Save", p.row("mode")!)!.disabled).toBe(true);
    await pick(p.row("mode")!.querySelector("select") as HTMLSelectElement, "slow");
    await click(button("Save", p.row("mode")!));
    expect(puts[0].body).toEqual({ key: "mode", value: "slow" });
  });

  it("restores the default with one button, which is there only when the value is not the default", async () => {
    const puts: Call[] = [];
    const p = await show({ "GET /settings/contract": () => liveAnswer({ login_ip_limit: 77 }), "PUT /auth/policy": (c) => (puts.push(c), putAnswer("login_ip_limit", 77, 0)) });
    expect(button("Restore the default", p.row("auth_max_failures")!)).toBeUndefined();
    const row = p.row("login_ip_limit")!;
    const def = EMBEDDED_CONTRACT.settings.find((s) => s.key === "login_ip_limit")!.default;
    await click(button("Restore the default", row));
    await click(button("Confirm"));
    expect(puts[0].body).toEqual({ key: "login_ip_limit", value: def, confirm_weak: true });
  });

  it("says the refusal of the server with the text of its code and keeps the screen as it was", async () => {
    const p = await show({
      "GET /settings/contract": () => liveAnswer(),
      "PUT /auth/policy": () => refusal(422, "bad_policy", "login_ip_limit is out of range; set it in server.cfg"),
    });
    await typeInto(p.row("login_ip_limit")!.querySelector("input")!, "20");
    await click(button("Save", p.row("login_ip_limit")!));
    await click(button("Confirm"));
    const text = p.row("login_ip_limit")!.textContent!;
    expect(text).toContain("That switch cannot be changed while the server runs, or the value is not valid.");
    expect(text).toContain("server.cfg");
    expect(p.$("[role=alert]")!.textContent).toContain("That switch cannot be changed");
    await act(async () => root!.unmount());
    root = null;
    const forbidden = await show({ "GET /settings/contract": () => liveAnswer(), "PUT /auth/policy": () => refusal(403, "forbidden") });
    await click(forbidden.row("compat_api")!.querySelector("input[role=switch]"));
    await click(button("Confirm"));
    expect(forbidden.row("compat_api")!.textContent).toContain("Your role does not allow this.");
  });
});

describe("who may change the settings", () => {
  it("shows an operator every value in force with no control, read from the light view", async () => {
    const p = await show({ "GET /settings/values": () => json(lightFor({ login_ip_limit: 5 }), 200, { etag: '"a"' }) }, "operator");
    expect(p.text()).toContain("(light view)");
    expect(p.$$("input, select")).toHaveLength(0);
    expect(p.row("login_ip_limit")!.textContent).toContain("5");
    expect(button("Save")).toBeUndefined();
  });

  it("is read-only for a token of an administrator that lacks the scope of the setting", async () => {
    const claims: AuthClaims = { name: "ci", role: "admin", is_token: true, scopes: ["projects:read"] } as AuthClaims;
    const p = await show({ "GET /settings/contract": () => liveAnswer() }, "admin", { claims });
    expect(p.$$("input[role=switch]")).toHaveLength(0);
  });

  it("never shows or writes a secret", async () => {
    const contract = contractOf([make({ key: "tok_sample", secret: true, type: "string", default: "" }), make({ key: "plain" })]);
    const p = await show({ "GET /settings/contract": () => liveAnswer({ tok_sample: "REDACTION_SAMPLE_VALUE" }, contract) }, "admin", { embedded: contract });
    expect(p.text()).not.toContain("REDACTION_SAMPLE_VALUE");
    const row = p.row("tok_sample")!;
    expect(row.textContent).toContain("Secret: its value is never shown or written here.");
    expect(row.querySelector("input, select, button")).toBeNull();
    expect(p.row("plain")!.querySelector("input")).toBeTruthy();
  });
});

describe("the copy of the contract kept in Studio", () => {
  it("is shown read-only, with the reason and no values, when the server gives neither its contract nor the light view", async () => {
    const p = await show({ "GET /settings/contract": () => refusal(403, "forbidden"), "GET /settings/values": () => refusal(403, "forbidden") });
    expect(p.text()).toContain("The server did not give its contract (forbidden)");
    expect(p.text()).not.toContain("Contract read from the server");
    expect(p.$$("tr[data-setting]")).toHaveLength(EMBEDDED_CONTRACT.settings.length);
    expect(p.$$("input, select")).toHaveLength(0);
    expect(p.row("login_ip_limit")!.textContent).toContain("Default:");
    expect(button("Save")).toBeUndefined();
  });

  it("is shown when the route is not there, and when its answer is not a contract Studio understands", async () => {
    const down = await show({});
    expect(down.text()).toContain("The server did not give its contract (unknown_route)");
    await act(async () => root!.unmount());
    root = null;
    const other = await show({ "GET /settings/contract": () => ({ ...liveAnswer(), schema: "eh3d.settings.contract/2" }), "GET /settings/values": () => new Response("x", { status: 200 }) });
    expect(other.text()).toContain("(shape)");
    expect(other.$$("input, select")).toHaveLength(0);
  });

  it("is replaced by the live contract, which may describe more keys than the copy", async () => {
    const extra = make({ key: "brand_new", group: "network", risk: "capacity", type: "integer", min: 1, max: 3, default: 2 });
    const live = { ...EMBEDDED_CONTRACT, settings: [...EMBEDDED_CONTRACT.settings, extra] };
    const p = await show({ "GET /settings/contract": () => liveAnswer({}, live) });
    const row = p.row("brand_new")!;
    expect(row).toBeTruthy();
    expect(row.textContent).toContain("Not in the copy kept in Studio.");
    expect(row.querySelector("input")).toBeTruthy();
    expect(p.row("listen")!.textContent).not.toContain("Not in the copy kept in Studio.");
  });
});

describe("a key that nobody described", () => {
  it("is drawn with the generic control and breaks nothing: a value the contract does not list, and a type Studio does not know", async () => {
    const odd = make({ key: "matrix_setting", type: "matrix", default: null, write: { via: "file", file: "server.cfg" } });
    const live = { ...EMBEDDED_CONTRACT, settings: [...EMBEDDED_CONTRACT.settings, odd] };
    const p = await show({ "GET /settings/contract": () => liveAnswer({ future_flag: true, future_text: "abc", matrix_setting: { a: 1 } }, live) });
    const group = p.$("section[data-group=other]")!;
    expect(group.textContent).toContain("Other settings the server reports");
    expect(group.querySelector("tr[data-setting=future_flag]")).toBeTruthy();
    expect(group.querySelector("tr[data-setting=future_text]")!.textContent).toContain("abc");
    expect(group.querySelector("input, select, button")).toBeNull();
    const row = p.row("matrix_setting")!;
    expect(row.textContent).toContain('{"a":1}');
    expect(row.querySelector("input, select, button")).toBeNull();
    // the known keys are all still there
    expect(p.$$("tr[data-setting]").length).toBeGreaterThanOrEqual(EMBEDDED_CONTRACT.settings.length + 3);
  });

  it("falls back to its own name when the contract gives no label, and to English when a language is missing", async () => {
    const bare = make({ key: "nameless", label: {}, help: {}, warning: {} });
    const contract = contractOf([bare]);
    const p = await show({ "GET /settings/contract": () => liveAnswer({}, contract) }, "admin", { embedded: contract, lang: "de" });
    expect(p.row("nameless")!.querySelector("strong")!.textContent).toBe("nameless");
  });
});

describe("the settings of the server for a login that is not an administrator", () => {
  const tagged = (body: unknown, tag = '"t1"') => json(body, 200, { etag: tag });
  const valuesCalls = (p: { server: { calls: Call[] } }) => p.server.calls.filter((c) => c.path === "/settings/values");

  it("shows the values in force from the light view, with the texts of the copy, and never asks for the full contract", async () => {
    for (const role of ["operator", "viewer"] as const) {
      const p = await show({ "GET /settings/values": () => tagged(lightFor({ login_ip_limit: 77 })) }, role);
      expect(p.text(), role).toContain("Values in force read from the server 1.2.3 (light view)");
      expect(p.text()).not.toContain("the copy kept in Studio, read-only: the values in force are not shown");
      expect(p.server.calls.some((c) => c.path === "/settings/contract"), role).toBe(false);
      expect(p.$$("tr[data-setting]")).toHaveLength(EMBEDDED_CONTRACT.settings.length);
      expect(p.row("login_ip_limit")!.textContent).toContain("77");
      expect(p.row("listen")!.textContent).toContain("127.0.0.1:18200");
      expect(p.row("listen")!.textContent).toContain("Listen address");
      // read only: no control in any row, for any key
      expect(p.$$("tr[data-setting] input, tr[data-setting] select, tr[data-setting] button")).toHaveLength(0);
      expect(p.text()).not.toContain("The contract of the server is not the copy kept in Studio");
      await act(async () => root!.unmount());
      root = null;
    }
  });

  it("says that a path of the computer is not shown, and keeps a secret hidden whatever the server sent in its place", async () => {
    const extra = { future_secret: { v: "hunter2-in-clear", secret: true, editable: false }, other_secret: { v: "***" }, future_path: { hidden: true, origin: "file", editable: false } };
    const p = await show({ "GET /settings/values": () => tagged(lightFor({}, extra)) }, "operator");
    expect(p.row("data_dir")!.textContent).toContain("Not shown by the server");
    expect(p.row("data_dir")!.textContent).not.toContain("/");
    // keys the copy does not know are drawn read-only, with no value
    for (const key of ["future_secret", "other_secret", "future_path"]) {
      const row = p.row(key);
      expect(row, key).toBeTruthy();
      expect(row!.querySelector("input, select, button")).toBeNull();
    }
    expect(p.row("future_secret")!.textContent).toContain("●●●");
    expect(p.row("other_secret")!.textContent).toContain("●●●");
    expect(p.row("future_path")!.textContent).toContain("Not shown by the server");
    expect(p.text()).not.toContain("hunter2-in-clear");
  });

  it("cuts nothing it was not told to cut and marks a value the server cut", async () => {
    const p = await show({ "GET /settings/values": () => tagged(lightFor({}, { zone_names: { v: ["a", "b"], truncated: true, origin: "file", editable: false } })) }, "viewer");
    expect(p.row("zone_names")!.textContent).toContain("a, b…");
  });

  it("warns when the contract of the server is not the copy kept in Studio", async () => {
    const p = await show({ "GET /settings/values": () => tagged(lightFor({}, {}, "0".repeat(64))) }, "operator");
    expect(p.text()).toContain("The contract of the server is not the copy kept in Studio: texts and keys may be out of date.");
    expect(p.$$('[role="alert"]').some((a) => a.textContent!.includes("may be out of date"))).toBe(true);
    await act(async () => root!.unmount());
    root = null;
    const es = await show({ "GET /settings/values": () => tagged(lightFor({}, {}, "0".repeat(64))) }, "operator", { lang: "es" });
    expect(es.text()).toContain("El contrato del servidor no es la copia guardada en Studio");
    expect(es.text()).toContain("Valores en vigor leídos del servidor 1.2.3 (vista ligera)");
    expect(es.row("data_dir")!.textContent).toContain("El servidor no lo muestra");
  });

  it("asks again with the ETag when refreshed and keeps the page when the server says 304", async () => {
    let tag = '"t1"';
    const p = await show(
      {
        "GET /settings/values": (call) => (call.headers["if-none-match"] === tag ? new Response(null, { status: 304, headers: { etag: tag } }) : tagged(lightFor({ login_ip_limit: 41 }), tag)),
      },
      "operator",
    );
    expect(valuesCalls(p)).toHaveLength(1);
    expect(valuesCalls(p)[0].headers["if-none-match"]).toBeUndefined();
    await click(button("Refresh"));
    expect(valuesCalls(p)).toHaveLength(2);
    expect(valuesCalls(p)[1].headers["if-none-match"]).toBe('"t1"');
    expect(p.row("login_ip_limit")!.textContent).toContain("41");
    expect(p.text()).toContain("(light view)");
    // a change on the server is a new tag and a new answer
    tag = '"t2"';
    await click(button("Refresh"));
    expect(valuesCalls(p)[2].headers["if-none-match"]).toBe('"t1"');
    expect(p.row("login_ip_limit")!.textContent).toContain("41");
    await click(button("Refresh"));
    expect(valuesCalls(p)[3].headers["if-none-match"]).toBe('"t2"');
  });

  it("uses the light view for an administrator whose token cannot read the full contract, and changes nothing from it", async () => {
    const p = await show({ "GET /settings/contract": () => refusal(403, "forbidden_scope", "needs admin:policy"), "GET /settings/values": () => tagged(lightFor()) }, "admin");
    expect(p.text()).toContain("(light view)");
    expect(p.text()).not.toContain("The server did not give its contract");
    expect(p.server.calls.map((c) => c.path).filter((x) => x.startsWith("/settings"))).toEqual(["/settings/contract", "/settings/values"]);
    expect(p.$$("tr[data-setting] input, tr[data-setting] select, tr[data-setting] button")).toHaveLength(0);
  });

  it("shows the copy, read-only and with the reason, when the light view cannot be read", async () => {
    const down = await show({ "GET /settings/values": () => refusal(404, "not_found", "no such route") }, "operator");
    expect(down.text()).toContain("The server did not give its contract (not_found)");
    expect(down.$$("tr[data-setting]")).toHaveLength(EMBEDDED_CONTRACT.settings.length);
    expect(down.row("listen")!.textContent).toContain("Listen address");
    await act(async () => root!.unmount());
    root = null;
    const junk = await show({ "GET /settings/values": () => new Response("<html>proxy</html>", { status: 200 }) }, "viewer");
    expect(junk.text()).toContain("The server did not give its contract (shape)");
    await act(async () => root!.unmount());
    root = null;
    const newer = await show({ "GET /settings/values": () => tagged({ ...lightFor(), schema: "eh3d.settings.values/2" }) }, "viewer");
    expect(newer.text()).toContain("The server did not give its contract (newer)");
  });
});

describe("the page of the security", () => {
  it("links to all the settings of the server, and the two tables do not repeat each other", async () => {
    const server = fakeServer({
      "GET /auth/sessions": () => ({ sessions: [] }),
      "GET /auth/policy": () => ({ switches: [{ key: "persist_sessions", value: false, safe: true }], attention: [], extra_apps: [], editable: ["persist_sessions"] }),
      "GET /audit": () => ({ enabled: true, lines: [] }),
      "GET /auth/keys": () => ({ tokens: [], tls: { configured: false } }),
    });
    root = createRoot(box!);
    await act(async () => root!.render(<Providers app={makeApp("admin")} services={makeServices(server.fetcher, "admin")}><SecurityPage /></Providers>));
    await settle();
    await click(button("All the settings of the server"));
    expect(window.location.hash).toBe("#/server");
    // the table of the security page does not ask for the contract: the full list is on the page of the server
    expect(server.calls.some((c) => c.path === "/settings/contract")).toBe(false);
  });
});
