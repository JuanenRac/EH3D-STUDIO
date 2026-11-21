/* The settings of the server drawn from its contract: the copy kept in Studio is a contract Studio understands (and, next to the repository of the server, is its file), every key of it
 * has a control and a text in the eight languages, a key nobody described gets the generic control, and the rules of reading, grouping, checking and writing a setting. The page that draws
 * them is tested in services/settingspanel.test.tsx. GPL-3.0-or-later. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { CORE_LANGS, LANGS, text } from "./i18n";
import type { Lang } from "./i18n";
import { ServiceHttp } from "./services/http";
import {
  CONTRACT_LANGS,
  CONTRACT_SCHEMA,
  COPY_HASH,
  LIGHT_MAX_BYTES,
  LIGHT_MAX_ITEMS,
  LIGHT_MAX_KEYS,
  LIGHT_MAX_TEXT,
  LIGHT_SCHEMA,
  LightCache,
  canWrite,
  compareHash,
  contractText,
  controlKind,
  genericSetting,
  groupSettings,
  isContract,
  isHighRisk,
  isSha256,
  loadContract,
  loadSettings,
  loadedFromLight,
  parseLight,
  parseTyped,
  readContract,
  readLight,
  sameValue,
  shownValue,
  unlistedSettings,
  valueOf,
  writePath,
  writeSetting,
} from "./services/settingscontract";
import type { LightReply, Setting, SettingsContract } from "./services/settingscontract";
import { EMBEDDED_CONTRACT } from "./services/embeddedcontract";
import { SIM_PASSWORD, SimRng, SimServer } from "./simserver";
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
    expect(ids).toHaveLength(16);
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
    expect(KEYS.length).toBe(22);
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

  it("is English for a language the contract does not have", () => {
    expect(contractText(map, "ja")).toBe("Network");
    expect(contractText(map, "de")).toBe("Network");
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

// ---- the light view of the values in force --------------------------------------------------------------------------------------------------

/** The light answer of the server for the examples of its documentation, with the hash of the copy unless another is given. */
function lightAnswer(over: Record<string, unknown> = {}, settings?: Record<string, unknown>): Record<string, unknown> {
  const s = settings ?? {
    session_hours: { v: 12, origin: "file", editable: false },
    slice_enabled: { v: true, origin: "override", editable: true },
    data_dir: { hidden: true, origin: "file", editable: false },
    listen: { v: "127.0.0.1:18200", origin: "file", editable: false },
    allowed_hosts: { v: ["a.example", "b.example"], origin: "file", editable: false, truncated: true },
    future_secret: { v: "***", secret: true, editable: false },
  };
  return { schema: LIGHT_SCHEMA, server_version: "0.2.0", contract_hash: COPY_HASH, count: Object.keys(s).length, settings: s, ...over };
}

describe("the hash of the copy of the contract", () => {
  it("is the SHA-256 of the file with LF line ends, the way the server hashes its document", () => {
    const file = new URL("./data/settings-contract.json", import.meta.url);
    const digest = createHash("sha256").update(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).digest("hex");
    expect(COPY_HASH).toBe(digest);
    expect(isSha256(COPY_HASH)).toBe(true);
  });

  it("is compared with the hash the server gives: same, another one, or nothing it can judge", () => {
    expect(compareHash(COPY_HASH)).toBe("same");
    expect(compareHash("0".repeat(64))).toBe("differs");
    for (const bad of [undefined, null, 5, "", "xyz", "A".repeat(64), "g".repeat(64), COPY_HASH.slice(1), `${COPY_HASH}0`, { x: 1 }]) expect(compareHash(bad), String(bad)).toBe("unknown");
  });

  it("is the one the server has when its repository is next to this one", () => {
    const file = new URL("../../EH3D-SERVER/docs/settings-contract.json", import.meta.url);
    if (!existsSync(file)) return;
    expect(createHash("sha256").update(readFileSync(file, "utf8").replace(/\r\n/g, "\n")).digest("hex")).toBe(COPY_HASH);
  });
});

describe("reading the light answer", () => {
  it("keeps the value in force, where it comes from and whether the security page changes it", () => {
    const got = parseLight(lightAnswer());
    expect(typeof got).toBe("object");
    const light = got as Exclude<typeof got, string>;
    expect(light.serverVersion).toBe("0.2.0");
    expect(light.contractHash).toBe(COPY_HASH);
    expect(Object.keys(light.entries)).toHaveLength(6);
    expect(light.entries.session_hours).toMatchObject({ value: 12, overridden: false, editable: false, secret: false, hidden: false });
    expect(light.entries.slice_enabled).toMatchObject({ value: true, overridden: true, editable: true });
    expect(light.entries.data_dir).toMatchObject({ hidden: true });
    expect(light.entries.data_dir.value).toBeUndefined();
    expect(light.entries.future_secret).toMatchObject({ secret: true });
    expect(light.entries.future_secret.value).toBeUndefined();
    expect(light.entries.allowed_hosts).toMatchObject({ value: ["a.example", "b.example"], truncated: true });
  });

  it("turns into the page's data: the copy for the texts, the values of the answer, and the keys it keeps back", () => {
    const light = parseLight(lightAnswer()) as Exclude<ReturnType<typeof parseLight>, string>;
    const got = loadedFromLight(light, COPY);
    expect(got.source).toBe("light");
    expect(got.contract).toBe(COPY);
    expect(got.hash).toBe("same");
    expect(got.values).toEqual({ allowed_hosts: ["a.example", "b.example"], listen: "127.0.0.1:18200", session_hours: 12, slice_enabled: true });
    expect(got.secretKeys).toEqual(["future_secret"]);
    expect(got.hidden).toEqual(["data_dir"]);
    expect(got.truncated).toEqual(["allowed_hosts"]);
    expect(got.overridden).toEqual(["slice_enabled"]);
    expect(loadedFromLight(parseLight(lightAnswer({ contract_hash: "0".repeat(64) })) as Exclude<ReturnType<typeof parseLight>, string>, COPY).hash).toBe("differs");
    expect(loadedFromLight(parseLight(lightAnswer({ contract_hash: undefined })) as Exclude<ReturnType<typeof parseLight>, string>, COPY).hash).toBe("unknown");
  });

  it("never keeps a secret: whatever the server sent in its place, and the mark with no flag", () => {
    const light = parseLight(lightAnswer({}, { pw: { v: "hunter2", secret: true }, tok: { v: "***" }, path: { v: "/home/me", hidden: true } })) as Exclude<ReturnType<typeof parseLight>, string>;
    expect(light.entries.pw).toMatchObject({ secret: true });
    expect(light.entries.tok).toMatchObject({ secret: true });
    expect(light.entries.path).toMatchObject({ hidden: true });
    for (const e of Object.values(light.entries)) expect(e.value).toBeUndefined();
    const loaded = loadedFromLight(light, COPY);
    expect(loaded.values).toEqual({});
    expect(JSON.stringify(loaded.values)).not.toContain("hunter2");
    expect(JSON.stringify(loaded.values)).not.toContain("/home/me");
  });

  it("refuses whole an answer it cannot trust: nothing half-understood is kept", () => {
    const bad: [string, unknown][] = [
      ["not an object", [1, 2]],
      ["a string", "<html>"],
      ["null", null],
      ["no settings", lightAnswer({ settings: undefined })],
      ["settings is a list", lightAnswer({ settings: [] })],
      ["a count that is not the number of keys", lightAnswer({ count: 99 })],
      ["a count that is a text", lightAnswer({ count: "6" })],
      ["a key that is not a name", lightAnswer({}, { "A b": { v: 1 } })],
      ["a key that is empty", lightAnswer({}, { "": { v: 1 } })],
      ["a key that is too long", lightAnswer({}, { [`k${"a".repeat(48)}`]: { v: 1 } })],
      ["an entry that is a number", lightAnswer({}, { a: 5 })],
      ["a value that is an object", lightAnswer({}, { a: { v: { x: 1 } } })],
      ["a list with an object", lightAnswer({}, { a: { v: [{ x: 1 }] } })],
      ["a list in a list", lightAnswer({}, { a: { v: [["x"]] } })],
      ["a text that is too long", lightAnswer({}, { a: { v: "x".repeat(LIGHT_MAX_TEXT + 1) } })],
      ["a list that is too long", lightAnswer({}, { a: { v: Array.from({ length: LIGHT_MAX_ITEMS + 1 }, () => "x") } })],
      ["an item that is too long", lightAnswer({}, { a: { v: ["x".repeat(LIGHT_MAX_TEXT + 1)] } })],
      ["a value that is not a JSON number", lightAnswer({}, { a: { v: Number.NaN } })],
    ];
    for (const [name, doc] of bad) expect(parseLight(doc), name).toBe("shape");
    const many: Record<string, unknown> = {};
    for (let i = 0; i <= LIGHT_MAX_KEYS; i++) many[`k${i}`] = { v: i };
    expect(parseLight(lightAnswer({}, many))).toBe("shape");
    // a newer or another schema
    expect(parseLight(lightAnswer({ schema: "eh3d.settings.values/2" }))).toBe("newer");
    expect(parseLight(lightAnswer({ schema: "eh3d.settings.contract/1" }))).toBe("shape");
    expect(parseLight(lightAnswer({ schema: 7 }))).toBe("shape");
  });

  it("does not let a key touch the prototype", () => {
    const hostile = JSON.parse(`{"schema":"${LIGHT_SCHEMA}","settings":{"__proto__":{"v":1},"a":{"v":2}}}`) as unknown;
    expect(parseLight(hostile)).toBe("shape");
    expect(parseLight(JSON.parse(`{"schema":"${LIGHT_SCHEMA}","settings":{"constructor":{"v":1}}}`))).toBe("shape");
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("accepts what is odd but harmless: no value, a null, a fraction, a hash that is not one, a long version", () => {
    const light = parseLight(lightAnswer({ contract_hash: "nope", server_version: "9".repeat(40) }, { a: { origin: "file" }, b: { v: null }, c: { v: 1.5 } })) as Exclude<ReturnType<typeof parseLight>, string>;
    expect(light.contractHash).toBeNull();
    expect(light.serverVersion).toBeNull();
    expect(light.entries.a.value).toBeUndefined();
    expect(light.entries.b.value).toBeUndefined();
    expect(light.entries.c.value).toBe(1.5);
  });
});

describe("who reads what", () => {
  const embedded = COPY;
  const full = () => Promise.resolve({ ...COPY, values: { max_body_mb: 8 }, server_version: "0.2.0", contract_hash: COPY_HASH });
  const light = (etag: string | null): Promise<LightReply> => Promise.resolve(etag === '"t1"' ? { status: 304 } : { status: 200, body: lightAnswer(), etag: '"t1"' });

  it("sends an administrator to the full contract and never asks for the light view", async () => {
    const calls: string[] = [];
    const cache = new LightCache();
    const read = await loadSettings("admin", { full: () => (calls.push("full"), full()), light: (e) => (calls.push("light"), light(e)) }, embedded, cache);
    expect(read.loaded).toMatchObject({ source: "live", hash: "same" });
    expect(read.changed).toBe(true);
    expect(calls).toEqual(["full"]);
  });

  it("sends an operator, a viewer and a login of unknown role to the light view only", async () => {
    for (const role of ["operator", "viewer", null, undefined, ""]) {
      const calls: string[] = [];
      const read = await loadSettings(role, { full: () => (calls.push("full"), full()), light: (e) => (calls.push("light"), light(e)) }, embedded, new LightCache());
      expect(read.loaded.source, String(role)).toBe("light");
      expect(calls, String(role)).toEqual(["light"]);
      expect(read.loaded.why).toBeNull();
    }
  });

  it("falls back to the light view, with no complaint, for an administrator whose full contract is refused", async () => {
    const calls: string[] = [];
    const read = await loadSettings(
      "admin",
      { full: () => (calls.push("full"), Promise.reject(new ApiError(403, "forbidden_scope", ""))), light: (e) => (calls.push("light"), light(e)) },
      embedded,
      new LightCache(),
    );
    expect(read.loaded).toMatchObject({ source: "light", why: null });
    expect(calls).toEqual(["full", "light"]);
  });

  it("sends the tag back and keeps the page when the server says 304", async () => {
    const cache = new LightCache();
    const readers = { full, light };
    const first = await loadSettings("operator", readers, embedded, cache);
    expect(first.changed).toBe(true);
    expect(cache.etag).toBe('"t1"');
    const second = await loadSettings("operator", readers, embedded, cache);
    expect(second.changed).toBe(false);
    expect(second.loaded).toBe(first.loaded);
    // an answer with no valid tag cannot be asked for again by tag
    const plain = new LightCache();
    await loadSettings("viewer", { full, light: () => Promise.resolve({ status: 200, body: lightAnswer(), etag: null }) }, embedded, plain);
    expect(plain.etag).toBeNull();
    expect(plain.last).toBeNull();
  });

  it("ends as the copy, with the reason, when the light view fails, and forgets the answer it held", async () => {
    const cache = new LightCache();
    await loadSettings("operator", { full, light }, embedded, cache);
    expect(cache.last).not.toBeNull();
    const refused = await loadSettings("operator", { full, light: () => Promise.reject(new ApiError(401, "unauthorized", "")) }, embedded, cache);
    expect(refused.loaded).toMatchObject({ source: "embedded", why: "unauthorized", values: {} });
    expect(refused.loaded.contract).toBe(COPY);
    expect(cache.etag).toBeNull();
    expect(cache.last).toBeNull();
    expect((await loadSettings("operator", { full, light: () => Promise.reject(new Error("offline")) }, embedded, cache)).loaded.why).toBe("unreachable");
    expect((await loadSettings("operator", { full, light: () => Promise.reject(new ApiError(0, "download_too_big", "16384")) }, embedded, cache)).loaded.why).toBe("download_too_big");
    expect((await loadSettings("operator", { full, light: () => Promise.resolve({ status: 200, body: "<html>", etag: null }) }, embedded, cache)).loaded.why).toBe("shape");
    expect((await loadSettings("operator", { full, light: () => Promise.resolve({ status: 200, body: lightAnswer({ schema: "eh3d.settings.values/2" }), etag: '"x"' }) }, embedded, cache)).loaded.why).toBe("newer");
    // a 304 for a tag nobody sent
    expect((await loadSettings("operator", { full, light: () => Promise.resolve({ status: 304 }) }, embedded, new LightCache())).loaded.why).toBe("shape");
  });
});

describe("the light view against the simulated server", () => {
  async function connect(role: "admin" | "operator" | "viewer" = "operator", over: Partial<SimServer> = {}) {
    const server = Object.assign(new SimServer(5), over);
    server.role = role;
    const api = new Api(null, server.fetcher);
    await api.login("ana", SIM_PASSWORD);
    const http = new ServiceHttp(() => api.token, server.fetcher, { retries: 0 }, async () => undefined);
    const readers = { full: () => readContract(http), light: (etag: string | null) => readLight(http, etag) };
    return { server, http, readers };
  }

  it("gives an operator the values in force, with the ETag and no read of the full contract", async () => {
    const { server, readers } = await connect("operator");
    const cache = new LightCache();
    const read = await loadSettings("operator", readers, COPY, cache);
    expect(read.loaded.source).toBe("light");
    expect(read.loaded.serverVersion).toBe("0.0.0-sim");
    expect(read.loaded.hash).toBe("same");
    expect(read.loaded.values.session_hours).toBe(12);
    expect(read.loaded.values.slice_enabled).toBe(false);
    expect(read.loaded.hidden).toEqual(expect.arrayContaining(["data_dir", "studio_dir"]));
    expect(read.loaded.hidden?.every((k) => !(k in read.loaded.values))).toBe(true);
    expect(cache.etag).toMatch(/^"[0-9a-f]+"$/);
    expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual(["POST /auth/login", "GET /settings/values"]);
    expect(server.conditional).toEqual([null]);
  });

  it("asks again with the tag and gets a 304 while nothing changes, and a new answer when a switch changes", async () => {
    const { server, readers } = await connect("viewer");
    const cache = new LightCache();
    const first = await loadSettings("viewer", readers, COPY, cache);
    const again = await loadSettings("viewer", readers, COPY, cache);
    const third = await loadSettings("viewer", readers, COPY, cache);
    expect([first.changed, again.changed, third.changed]).toEqual([true, false, false]);
    expect(server.lightRequests).toBe(3);
    expect(server.notModified).toBe(2);
    expect(server.conditional[1]).toBe(cache.etag);
    server.policy.slice_enabled = true;
    const changed = await loadSettings("viewer", readers, COPY, cache);
    expect(changed.changed).toBe(true);
    expect(changed.loaded.values.slice_enabled).toBe(true);
    expect(changed.loaded.overridden).toEqual(["slice_enabled"]);
    expect(server.notModified).toBe(2);
  });

  it("tells when the contract of the server is not the copy", async () => {
    const { readers } = await connect("operator", { contractHash: "1".repeat(64) });
    const read = await loadSettings("operator", readers, COPY, new LightCache());
    expect(read.loaded).toMatchObject({ source: "light", hash: "differs" });
  });

  it("keeps the full contract for an administrator and refuses it to anyone else", async () => {
    const admin = await connect("admin");
    const a = await loadSettings("admin", admin.readers, COPY, new LightCache());
    expect(a.loaded).toMatchObject({ source: "live", hash: "same" });
    expect(admin.server.lightRequests).toBe(0);
    const operator = await connect("operator");
    expect(await operator.http.json("GET", "/settings/values")).toBeTypeOf("object");
    const refused = await operator.http.json("GET", "/settings/contract").then(
      () => null,
      (e: unknown) => e,
    );
    expect(refused).toMatchObject({ status: 403, code: "forbidden" });
    const scoped = await connect("admin", { noPolicyScope: true });
    const s = await loadSettings("admin", scoped.readers, COPY, new LightCache());
    expect(s.loaded.source).toBe("light");
    expect(scoped.server.lightRequests).toBe(1);
  });

  it("refuses an answer bigger than the 16 KiB the server promises, and a server that is down, with the copy and the reason", async () => {
    const { server, http } = await connect("operator");
    const big = async (): Promise<Response> => new Response(JSON.stringify(lightAnswer({ pad: "x".repeat(LIGHT_MAX_BYTES) })), { status: 200, headers: { "content-type": "application/json" } });
    const bigHttp = new ServiceHttp(() => "t", big, { retries: 0 }, async () => undefined);
    const readers = { full: () => readContract(bigHttp), light: (etag: string | null) => readLight(bigHttp, etag) };
    expect((await loadSettings("operator", readers, COPY, new LightCache())).loaded).toMatchObject({ source: "embedded", why: "download_too_big" });
    server.mode = "down";
    const down = await loadSettings("operator", { full: () => readContract(http), light: (e) => readLight(http, e) }, COPY, new LightCache());
    expect(down.loaded).toMatchObject({ source: "embedded", why: "unreachable" });
    server.mode = "html";
    const html = await loadSettings("operator", { full: () => readContract(http), light: (e) => readLight(http, e) }, COPY, new LightCache());
    expect(html.loaded.source).toBe("embedded");
    expect(html.loaded.why).toBe("http_500");
  });

  it("reads an ETag only when it is a tag", async () => {
    const answers: Response[] = [
      new Response(JSON.stringify(lightAnswer()), { status: 200, headers: { etag: '"abc"' } }),
      new Response(JSON.stringify(lightAnswer()), { status: 200, headers: { etag: 'W/"weak"' } }),
      new Response(JSON.stringify(lightAnswer()), { status: 200, headers: { etag: "bare" } }),
      new Response(JSON.stringify(lightAnswer()), { status: 200, headers: { etag: `"${"a".repeat(200)}"` } }),
      new Response(JSON.stringify(lightAnswer()), { status: 200 }),
    ];
    const http = new ServiceHttp(() => "t", async () => answers.shift() as Response, { retries: 0 }, async () => undefined);
    const tags: (string | null)[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await readLight(http, null);
      tags.push(r.status === 200 ? r.etag : "304");
    }
    expect(tags).toEqual(['"abc"', 'W/"weak"', null, null, null]);
  });

  it("survives a seeded storm of roles, failures and changes: always something to show, never a secret, the same run for the same seed", async () => {
    const run = async (seed: number) => {
      const { server, readers } = await connect("operator");
      const rng = new SimRng(seed);
      const cache = new LightCache();
      const roles = ["admin", "operator", "viewer", null] as const;
      const trace: string[] = [];
      for (let i = 0; i < 120; i++) {
        const what = rng.below(8);
        if (what === 0) server.mode = server.mode === "up" ? "unavailable" : "up";
        else if (what === 1) server.policy.slice_enabled = !server.policy.slice_enabled;
        else if (what === 2) cache.clear();
        else if (what === 3) server.noPolicyScope = !server.noPolicyScope;
        else if (what === 4) server.role = rng.below(2) === 0 ? "admin" : "operator";
        const role = roles[rng.below(4)];
        const read = await loadSettings(role, readers, COPY, cache);
        expect(read.loaded.contract.settings.length).toBeGreaterThan(0);
        expect(read.loaded.source === "embedded" ? read.loaded.why !== null : true).toBe(true);
        expect(JSON.stringify(read.loaded.values)).not.toContain("hunter2");
        trace.push(`${read.loaded.source}:${read.changed ? 1 : 0}:${read.loaded.why ?? ""}:${String(read.loaded.values.slice_enabled)}`);
      }
      return trace.join("|");
    };
    const a = await run(20261121);
    expect(await run(20261121)).toBe(a);
    expect(await run(7)).not.toBe(a);
    expect(a).toContain("light:0");
  });
});
