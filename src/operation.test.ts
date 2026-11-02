/* What the server's operation tools bring to the pages: the catalog of its error codes against the texts, the tokens that expire, the settings that are shown, the event that
 * tells the page it missed some. GPL-3.0-or-later. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { LANGS, errorText, text } from "./i18n";
import { STALE_TOKEN_DAYS, tokenDays, tokenState } from "./model";
import { ROWS } from "./texts";
import { SERVER_SETTINGS, SWITCHES_SHOWN } from "./pages/Configure";
import { describeEvent } from "./pages/Monitor";

/** The codes of the server that the Studio shows with the text given by the server (the detail it sends says what is wrong with the work or the file). Every other code of
 * the catalog has a row `err_<code>` in the eight languages. */
const GENERIC_ACCEPTED = [
  "bad_board",
  "bad_dcf",
  "bad_hole",
  "bad_ncd",
  "bad_path",
  "bad_picture",
  "bad_profile",
  "bad_samples",
  "bad_sorting",
  "bad_tool",
  "both_sources",
  "no_hole",
  "store",
  "too_many_holes",
  "unknown_tool",
];

type Entry = { code: string; status: number; description: string };
const catalog = JSON.parse(readFileSync(new URL("./examples/error_codes.json", import.meta.url), "utf8")) as Entry[];

describe("the catalog of the error codes of the server", () => {
  it("is a list of codes with their status and a description", () => {
    expect(catalog.length).toBeGreaterThan(50);
    for (const e of catalog) {
      expect(e.code).toMatch(/^[a-z_]+$/);
      expect(e.status).toBeGreaterThanOrEqual(400);
      expect(e.description.length).toBeGreaterThan(5);
    }
    expect(new Set(catalog.map((e) => e.code)).size).toBe(catalog.length);
  });

  it("has a sentence in the eight languages for every code, but the ones that are accepted as the server's own words", () => {
    const missing = catalog.filter((e) => !(`err_${e.code}` in ROWS) && !GENERIC_ACCEPTED.includes(e.code)).map((e) => e.code);
    expect(missing, "a code of the server without a text in Studio: add its row err_<code> or list it as accepted").toEqual([]);
    for (const e of catalog) {
      const key = `err_${e.code}`;
      if (key in ROWS) {
        const row = (ROWS as Record<string, readonly string[]>)[key];
        expect(row, key).toHaveLength(LANGS.length);
        for (const s of row) expect(s.trim().length, key).toBeGreaterThan(2);
      }
    }
  });

  it("has no accepted code that the server no longer has, nor one that Studio has a row for anyway", () => {
    const known = new Set(catalog.map((e) => e.code));
    for (const code of GENERIC_ACCEPTED) {
      expect(known.has(code), `${code} is not a code of the server`).toBe(true);
      expect(`err_${code}` in ROWS, `${code} has a row: take it off the accepted list`).toBe(false);
    }
  });

  it("shows a code that has no row with what the server said", () => {
    expect(errorText("es", new ApiError(422, "bad_hole", "a hole has a coordinate that is not a number"))).toBe("bad_hole: a hole has a coordinate that is not a number");
    expect(errorText("de", new ApiError(409, "not_running", ""))).toBe(text("de", "err_not_running"));
  });
});

describe("the tokens of the programs", () => {
  const DAY = 86400;
  it("are marked expired, stale or unused from their dates", () => {
    const now = 1_000 * DAY;
    expect(tokenState({ created: now - 5 * DAY, last_used: now - DAY, expires: null }, now)).toBe("ok");
    expect(tokenState({ created: now - 5 * DAY, last_used: null, expires: null }, now)).toBe("unused");
    expect(tokenState({ created: now - 200 * DAY, last_used: null, expires: null }, now)).toBe("stale");
    expect(tokenState({ created: now - 200 * DAY, last_used: now - (STALE_TOKEN_DAYS + 1) * DAY }, now)).toBe("stale");
    expect(tokenState({ created: now - 200 * DAY, last_used: now - STALE_TOKEN_DAYS * DAY }, now)).toBe("ok");
    expect(tokenState({ created: now - 5 * DAY, last_used: now - DAY, expires: now }, now)).toBe("expired");
    expect(tokenState({ created: now - 5 * DAY, last_used: now - DAY, expires: now + 1 }, now)).toBe("ok");
    // a server of an older version sends neither member
    expect(tokenState({ created: now - DAY }, now)).toBe("unused");
  });

  it("take the days of the form: empty leaves it to the server, else a whole number from 1 to 3650", () => {
    expect(tokenDays("")).toBeUndefined();
    expect(tokenDays("  ")).toBeUndefined();
    expect(tokenDays("30")).toBe(30);
    expect(tokenDays("3650")).toBe(3650);
    for (const bad of ["0", "3651", "-1", "1.5", "ten", "1e2"]) expect(tokenDays(bad), bad).toBeNull();
  });

  it("send the days only when they are given", async () => {
    const calls: string[] = [];
    const api = new Api("t", async (_url, init) => {
      calls.push(String(init?.body));
      return new Response(JSON.stringify({ id: "a", token: "eh3d_x" }), { status: 200 });
    });
    await api.addToken("laptop", "operator");
    await api.addToken("laptop", "operator", 30);
    expect(JSON.parse(calls[0])).toEqual({ name: "laptop", role: "operator" });
    expect(JSON.parse(calls[1])).toEqual({ name: "laptop", role: "operator", days: 30 });
  });
});

describe("the settings of the server that are shown", () => {
  it("include the switches of the panic, the proxy header, the logins, the tokens, the events and the logs, each with a text in eight languages", () => {
    const keys = SERVER_SETTINGS.map((s) => s.key);
    for (const k of ["exit_on_panic", "trust_forwarded_for", "persist_sessions", "token_default_days", "events_ping_s", "events_idle_s", "audit_file", "job_log", "log_max_kb"]) {
      expect(keys, k).toContain(k);
    }
    for (const s of SERVER_SETTINGS) expect((ROWS as Record<string, readonly string[]>)[s.text], s.key).toHaveLength(LANGS.length);
  });

  it("start with the conservative defaults", () => {
    const value = (k: string) => SERVER_SETTINGS.find((s) => s.key === k)?.value;
    expect(value("trust_forwarded_for")).toBe("false");
    expect(value("exit_on_panic")).toBe("true");
    expect(SWITCHES_SHOWN[0]).toBe("trust_forwarded_for");
  });
});

describe("the events of the websocket", () => {
  it("say it when the page missed some", () => {
    expect(describeEvent(JSON.stringify({ type: "resync", missed: 42 }))).toBe("resync · 42 missed");
    expect(describeEvent(JSON.stringify({ type: "resync" }))).toBe("resync · ? missed");
  });
});
