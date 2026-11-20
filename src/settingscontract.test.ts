/* The settings of the server drawn from its contract: the copy kept in Studio is a contract Studio understands (and, next to the repository of the server, is its file), every key of it
 * has a control and a text in the eight languages, a key nobody described gets the generic control, and the rules of reading, grouping, checking and writing a setting. The page that draws
 * them is tested in services/settingspanel.test.tsx. GPL-3.0-or-later. */
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { CORE_LANGS, LANGS, text } from "./i18n";
import type { Lang } from "./i18n";
import { ServiceHttp } from "./services/http";
import {
  CONTRACT_LANGS,
  CONTRACT_SCHEMA,
  canWrite,
  contractText,
  controlKind,
  genericSetting,
  groupSettings,
  isContract,
  isHighRisk,
  loadContract,
  parseTyped,
  sameValue,
  shownValue,
  unlistedSettings,
  valueOf,
  writePath,
  writeSetting,
} from "./services/settingscontract";
import type { Setting, SettingsContract } from "./services/settingscontract";
import { EMBEDDED_CONTRACT } from "./services/embeddedcontract";
import { SIM_PASSWORD, SimServer } from "./simserver";
import { ROWS } from "./texts";

const COPY = EMBEDDED_CONTRACT;

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
    confirm_when_looser: true,
    secret: false,
    risk: "none",
    label: { en: over.key },
    help: { en: "" },
    warning: { en: "" },
    ...over,
  };
}

function contractOf(settings: Setting[]): SettingsContract {
  return { schema: CONTRACT_SCHEMA, languages: [...CONTRACT_LANGS], groups: [{ id: "network", label: { en: "Network" } }], settings };
}

describe("the copy of the contract kept in Studio", () => {
  it("is a contract Studio understands, with the eight languages of the contract", () => {
    expect(isContract(COPY)).toBe(true);
    expect(COPY.schema).toBe(CONTRACT_SCHEMA);
    expect(COPY.languages).toEqual([...CONTRACT_LANGS]);
    expect(COPY.settings.length).toBeGreaterThanOrEqual(89);
    expect(new Set(COPY.settings.map((s) => s.key)).size).toBe(COPY.settings.length);
  });

  it("names the same eight languages as the rows of the texts of Studio", () => {
    expect([...CORE_LANGS].sort()).toEqual([...CONTRACT_LANGS].sort());
  });

  it("is the file of the server when its repository is next to this one", () => {
    const file = new URL("../../EH3D-SERVER/docs/settings-contract.json", import.meta.url);
    if (!existsSync(file)) return; // a checkout of this repository alone has no sibling: tools/sync_settings_contract.py --check judges the schema
    const norm = (url: URL) => readFileSync(url, "utf8").replace(/\r\n/g, "\n");
    expect(norm(new URL("./data/settings-contract.json", import.meta.url))).toBe(norm(file));
  });

  it("gives every key a control Studio can draw, and a label, a help and a warning in each of the eight languages", () => {
    const kinds = new Set<string>();
    for (const s of COPY.settings) {
      const kind = controlKind(s);
      kinds.add(kind);
      expect(kind, `${s.key}: the control`).not.toBe("generic");
      for (const lang of CONTRACT_LANGS) {
        for (const field of ["label", "help", "warning"] as const) {
          expect((s[field][lang] ?? "").trim().length, `${s.key}.${field}.${lang}`).toBeGreaterThan(0);
        }
      }
      // a number has its range, a key written by the policy has its route, a key of the file says which file
      if (kind === "number") expect(typeof s.min === "number" && typeof s.max === "number", s.key).toBe(true);
      if (s.write.via === "policy") expect(writePath(s), s.key).toBe("/auth/policy");
      else expect(s.write.file, s.key).toBe("server.cfg");
    }
    expect([...kinds].sort()).toEqual(expect.arrayContaining(["list", "number", "switch", "text"]));
  });

  it("puts every group in the 8 languages and every setting in a group of the contract", () => {
    const ids = COPY.groups.map((g) => g.id);
    expect(ids).toHaveLength(15);
    for (const g of COPY.groups) for (const lang of CONTRACT_LANGS) expect((g.label[lang] ?? "").length, `${g.id}.${lang}`).toBeGreaterThan(0);
    for (const s of COPY.settings) expect(ids, s.key).toContain(s.group);
  });

  it("marks 19 keys as written by the policy and the rest as set in server.cfg", () => {
    const policy = COPY.settings.filter((s) => s.write.via === "policy");
    expect(policy.length).toBe(19);
    expect(COPY.settings.filter((s) => s.write.via === "file").length).toBe(COPY.settings.length - 19);
    // none of the keys written through the API is a secret
    for (const s of policy) expect(s.secret, s.key).toBe(false);
  });
});

describe("the texts of the screen of the settings", () => {
  const KEYS = Object.keys(ROWS).filter((k) => k.startsWith("ssc_"));

  it("exist in every language of Studio, with the same markers as English", () => {
    expect(KEYS.length).toBe(19);
    const markers = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of KEYS) {
      const english = text("en", k as keyof typeof ROWS);
      for (const lang of LANGS) {
        const s = text(lang, k as keyof typeof ROWS);
        expect(s.trim().length, `${k} in ${lang}`).toBeGreaterThan(0);
        expect(markers(s), `${k} in ${lang}`).toEqual(markers(english));
      }
    }
  });
});

describe("the text of a field of the contract", () => {
  const map = { en: "Network", es: "Red", pt: "Rede", fr: "Réseau" };

  it("is the one of the language when the contract has it", () => {
    expect(contractText(map, "es")).toBe("Red");
    expect(contractText(map, "pt")).toBe("Rede");
  });

  it("is English for a language the contract does not have, and the main language for a variant", () => {
    expect(contractText(map, "bg")).toBe("Network");
    expect(contractText(map, "pt-br")).toBe("Rede");
    expect(contractText(map, "fr-ca")).toBe("Réseau");
    expect(contractText({ es: "Red" }, "de")).toBe("Red");
    expect(contractText(undefined, "en")).toBe("");
    expect(contractText({}, "en")).toBe("");
  });

  it("has a text for every language of Studio in the real contract", () => {
    const s = COPY.settings[0];
    for (const lang of LANGS as readonly Lang[]) expect(contractText(s.label, lang).length, lang).toBeGreaterThan(0);
  });
});

describe("the groups of the page", () => {
  it("follow the order of the contract and hold every setting", () => {
    const groups = groupSettings(COPY);
    expect(groups.map((g) => g.id)).toEqual(COPY.groups.map((g) => g.id));
    expect(groups.reduce((n, g) => n + g.settings.length, 0)).toBe(COPY.settings.length);
    for (const g of groups) for (const s of g.settings) expect(s.group).toBe(g.id);
  });

  it("add a group for a setting whose group the contract does not list, and leave out the empty ones", () => {
    const c = contractOf([make({ key: "a" }), make({ key: "b", group: "future" })]);
    c.groups.push({ id: "empty", label: { en: "Empty" } });
    const groups = groupSettings(c);
    expect(groups.map((g) => g.id)).toEqual(["network", "future"]);
    expect(groups[1].label.en).toBe("future");
  });
});

describe("the control of a setting", () => {
  it("is chosen by its type, and anything unknown is the generic one", () => {
    expect(controlKind(make({ key: "a", type: "boolean" }))).toBe("switch");
    expect(controlKind(make({ key: "a", type: "integer", min: 1, max: 5 }))).toBe("number");
    expect(controlKind(make({ key: "a", type: "integer" }))).toBe("text");
    expect(controlKind(make({ key: "a", type: "string" }))).toBe("text");
    expect(controlKind(make({ key: "a", type: "list" }))).toBe("list");
    expect(controlKind(make({ key: "a", type: "enum", values: ["x", "y"] }))).toBe("select");
    expect(controlKind(make({ key: "a", type: "enum" }))).toBe("text");
    expect(controlKind(make({ key: "a", type: "matrix" }))).toBe("generic");
  });

  it("is asked twice only for the risks that open the server, weaken the security or touch a machine or data", () => {
    for (const risk of ["security", "exposure", "machine", "data"]) expect(isHighRisk(make({ key: "a", risk })), risk).toBe(true);
    for (const risk of ["none", "capacity", "something-new"]) expect(isHighRisk(make({ key: "a", risk })), risk).toBe(false);
  });

  it("is a read-only line for a key nobody described", () => {
    const g = genericSetting("future_flag", true);
    expect(g.type).toBe("boolean");
    expect(canWrite({ role: "admin" }, g)).toBe(false);
    expect(genericSetting("odd", { a: 1 }).type).toBe("unknown");
    expect(genericSetting("n", 4).type).toBe("integer");
  });
});

describe("who may change a setting", () => {
  const policy = make({ key: "mdns_announce" });
  it("is the administrator, for a key the contract says the API writes", () => {
    expect(canWrite({ role: "admin" }, policy)).toBe(true);
    expect(canWrite({ role: "operator" }, policy)).toBe(false);
    expect(canWrite({ role: "viewer" }, policy)).toBe(false);
    expect(canWrite(null, policy)).toBe(false);
  });

  it("needs the scope of the setting when the token has scopes", () => {
    expect(canWrite({ role: "admin", scopes: ["projects:read"] }, policy)).toBe(false);
    expect(canWrite({ role: "admin", scopes: ["admin:policy"] }, policy)).toBe(true);
    expect(canWrite({ role: "admin", scopes: null }, policy)).toBe(true);
  });

  it("is nobody for a key set in server.cfg, for a secret, or for a type Studio cannot draw", () => {
    expect(canWrite({ role: "admin" }, make({ key: "a", write: { via: "file", file: "server.cfg" } }))).toBe(false);
    expect(canWrite({ role: "admin" }, make({ key: "a", secret: true }))).toBe(false);
    expect(canWrite({ role: "admin" }, make({ key: "a", type: "matrix" }))).toBe(false);
    expect(canWrite({ role: "admin" }, make({ key: "a", write: { via: "policy", method: null, path: null } }))).toBe(false);
  });

  it("is the administrator for the 19 keys of the policy of the real contract and nobody for the other keys", () => {
    const writable = COPY.settings.filter((s) => canWrite({ role: "admin" }, s));
    expect(writable.length).toBe(19);
    expect(COPY.settings.filter((s) => canWrite({ role: "operator" }, s))).toEqual([]);
  });
});

describe("the value of a setting", () => {
  it("is the one in force, never the value of a secret, and nothing for a copy of the contract", () => {
    const secret = make({ key: "sec", secret: true });
    const plain = make({ key: "plain" });
    expect(valueOf(plain, { plain: 3 })).toBe(3);
    expect(valueOf(plain, {})).toBeUndefined();
    expect(valueOf(secret, { sec: "hidden-sample" })).toBeUndefined();
  });

  it("is compared and written the same way for a list, a flag and a number", () => {
    expect(sameValue([], [])).toBe(true);
    expect(sameValue(["a"], ["a", "b"])).toBe(false);
    expect(sameValue(null, undefined)).toBe(true);
    expect(sameValue(5, 5)).toBe(true);
    expect(shownValue(["a", "b"])).toBe("a, b");
    expect(shownValue(null)).toBe("");
    expect(shownValue(12)).toBe("12");
    expect(shownValue(false)).toBe("false");
    expect(shownValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("what a person types", () => {
  const num = make({ key: "n", type: "integer", min: 1, max: 100 });

  it("is checked against the range of a number before anything is sent", () => {
    expect(parseTyped(num, "50")).toEqual({ ok: true, value: 50 });
    expect(parseTyped(num, " 1 ")).toEqual({ ok: true, value: 1 });
    expect(parseTyped(num, "100")).toEqual({ ok: true, value: 100 });
    for (const bad of ["0", "101", "-3", "1.5", "abc", "", "1e3", "99999999999999999999"]) expect(parseTyped(num, bad), bad).toEqual({ ok: false, problem: "number" });
  });

  it("is checked against the length of a text, and an integer without a range is still whole", () => {
    const str = make({ key: "s", type: "string", max_length: 5 });
    expect(parseTyped(str, "abcde")).toEqual({ ok: true, value: "abcde" });
    expect(parseTyped(str, "abcdef")).toEqual({ ok: false, problem: "text" });
    const open = make({ key: "i", type: "integer" });
    expect(parseTyped(open, "7")).toEqual({ ok: true, value: 7 });
    expect(parseTyped(open, "x")).toEqual({ ok: false, problem: "number" });
  });

  it("is split into items for a list, and must be one of the choices for an enum", () => {
    expect(parseTyped(make({ key: "l", type: "list" }), " a, b ,,c ")).toEqual({ ok: true, value: ["a", "b", "c"] });
    expect(parseTyped(make({ key: "l", type: "list" }), "")).toEqual({ ok: true, value: [] });
    const e = make({ key: "e", type: "enum", values: ["x", "y"] });
    expect(parseTyped(e, "y")).toEqual({ ok: true, value: "y" });
    expect(parseTyped(e, "z")).toEqual({ ok: false, problem: "choice" });
    expect(parseTyped(make({ key: "g", type: "matrix" }), "1")).toEqual({ ok: false, problem: "text" });
  });
});

/** A transport that records what it was asked and answers from a function. */
function transport(answer: (method: string, path: string, body: unknown) => Response) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetcher = async (input: string, init?: RequestInit) => {
    const path = new URL(input, "http://server").pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    const body = typeof init?.body === "string" ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ method, path, body });
    return answer(method, path, body);
  };
  return { calls, http: new ServiceHttp(() => "tok", fetcher, { retries: 0 }, async () => undefined) };
}

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

describe("writing a setting", () => {
  it("goes by the method and the route of its entry in the contract", async () => {
    const t = transport(() => reply({ changed: { key: "mdns_announce", from: false, to: true, apply: "now", restart_required: false } }));
    const answer = await writeSetting(t.http, make({ key: "mdns_announce" }), true);
    expect(t.calls).toEqual([{ method: "PUT", path: "/api/v1/auth/policy", body: { key: "mdns_announce", value: true } }]);
    expect(answer.changed?.restart_required).toBe(false);
  });

  it("carries confirm_weak only when it was confirmed", async () => {
    const t = transport(() => reply({}));
    await writeSetting(t.http, make({ key: "a", type: "integer", min: 0, max: 9 }), 4, true);
    expect(t.calls[0].body).toEqual({ key: "a", value: 4, confirm_weak: true });
  });

  it("is refused here, before any request, for a key the API does not write", async () => {
    const t = transport(() => reply({}));
    await expect(writeSetting(t.http, make({ key: "listen", write: { via: "file", file: "server.cfg" } }), "x")).rejects.toThrow("listen");
    await expect(writeSetting(t.http, make({ key: "s", secret: true }), "x")).rejects.toThrow("s");
    expect(t.calls).toEqual([]);
  });

  it("says the refusal of the server with its code", async () => {
    const t = transport(() => reply({ error: "bad_policy", detail: "listen is set in server.cfg" }, 422));
    const e: unknown = await writeSetting(t.http, make({ key: "a" }), true).then(
      () => null,
      (x: unknown) => x,
    );
    expect(e).toBeInstanceOf(ApiError);
    expect((e as ApiError).code).toBe("bad_policy");
    expect((e as ApiError).detail).toContain("server.cfg");
  });
});

describe("the contract the page uses", () => {
  const live = { ...COPY, values: { mdns_announce: true, future_flag: 3 }, server_version: "9.9.9" };

  it("is the live one when the server gives it, with its values and its version", async () => {
    const got = await loadContract(async () => live, COPY);
    expect(got.source).toBe("live");
    expect(got.why).toBeNull();
    expect(got.serverVersion).toBe("9.9.9");
    expect(got.values.mdns_announce).toBe(true);
  });

  it("is the copy kept in Studio, without values, when the server refuses or cannot be reached, and says why", async () => {
    const refused = await loadContract(async () => Promise.reject(new ApiError(403, "forbidden", "")), COPY);
    expect(refused).toMatchObject({ source: "embedded", why: "forbidden", values: {}, serverVersion: null });
    expect(refused.contract).toBe(COPY);
    const down = await loadContract(async () => Promise.reject(new Error("offline")), COPY);
    expect(down).toMatchObject({ source: "embedded", why: "unreachable" });
  });

  it("is the copy too when the live document is not a contract Studio understands", async () => {
    const other = await loadContract(async () => ({ ...live, schema: "eh3d.settings.contract/2" }), COPY);
    expect(other).toMatchObject({ source: "embedded", why: "shape" });
    const junk = await loadContract(async () => "<html>", COPY);
    expect(junk).toMatchObject({ source: "embedded", why: "shape" });
    expect(isContract(null)).toBe(false);
    expect(isContract({ schema: CONTRACT_SCHEMA, groups: [], settings: [{ key: 1 }] })).toBe(false);
  });

  it("lists the values the contract does not describe, sorted, as settings of their own", async () => {
    const got = await loadContract(async () => ({ ...live, values: { zeta: 1, future_flag: true, listen: "x" } }), COPY);
    const extra = unlistedSettings(got.contract, got.values);
    expect(extra.map((s) => s.key)).toEqual(["future_flag", "zeta"]);
    expect(extra.every((s) => canWrite({ role: "admin" }, s))).toBe(false);
  });
});

describe("the simulated server", () => {
  it("answers the contract with the values in force and the version, and follows the switches it holds", async () => {
    const server = new SimServer(3);
    const api = new Api(null, server.fetcher);
    await api.login("ana", SIM_PASSWORD);
    const http = new ServiceHttp(() => api.token, server.fetcher, { retries: 0 }, async () => undefined);
    const got = await loadContract(() => http.json("GET", "/settings/contract"), COPY);
    expect(got.source).toBe("live");
    expect(got.serverVersion).toBe("0.0.0-sim");
    expect(got.values.compat_api).toBe(false);
    expect(got.values.listen).toBe("127.0.0.1:18200");
    for (const s of COPY.settings) if (s.secret) expect(s.key in got.values).toBe(false);
  });
});
