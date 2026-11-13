import { describe, expect, it } from "vitest";
import { TOKEN_KEY, clearToken, isRemembered, readToken, saveToken } from "./tokenstore";
import type { TokenStore, TokenStores } from "./tokenstore";
import { LANGS, text } from "./i18n";
import { ROWS } from "./texts";
import { SERVER_SETTINGS } from "./pages/Configure";
import { editableKind } from "./services/authsvc";
import type { AuthPolicy } from "./services/types";

/** A store that keeps its values in a map, as sessionStorage and localStorage do. */
function memory(): TokenStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function stores(): { s: TokenStores; session: ReturnType<typeof memory>; local: ReturnType<typeof memory> } {
  const session = memory();
  const local = memory();
  return { s: { session, local }, session, local };
}

describe("the token of the login", () => {
  it("is kept by the tab only, in sessionStorage, unless the person asks to be remembered", () => {
    const { s, session, local } = stores();
    expect(readToken(s)).toBeNull();
    expect(saveToken(s, "tok-1", false)).toBe("session");
    expect(session.data.get(TOKEN_KEY)).toBe("tok-1");
    expect(local.data.size).toBe(0);
    expect(readToken(s)).toBe("tok-1");
    expect(isRemembered(s)).toBe(false);
    expect(TOKEN_KEY).toBe("eh3d-studio.token");
  });

  it("goes to localStorage only, and leaves sessionStorage, when the box 'remember me' is ticked", () => {
    const { s, session, local } = stores();
    session.data.set(TOKEN_KEY, "old");
    expect(saveToken(s, "tok-2", true)).toBe("local");
    expect(local.data.get(TOKEN_KEY)).toBe("tok-2");
    expect(session.data.size).toBe(0);
    expect(readToken(s)).toBe("tok-2");
    expect(isRemembered(s)).toBe(true);
  });

  it("moves from one store to the other, never lives in both, and the last choice wins", () => {
    const { s, session, local } = stores();
    saveToken(s, "a", true);
    saveToken(s, "b", false);
    expect([local.data.size, session.data.get(TOKEN_KEY)]).toEqual([0, "b"]);
    saveToken(s, "c", true);
    expect([session.data.size, local.data.get(TOKEN_KEY)]).toEqual([0, "c"]);
  });

  it("is removed from both stores by signing out", () => {
    const { s, session, local } = stores();
    session.data.set(TOKEN_KEY, "x");
    local.data.set(TOKEN_KEY, "y");
    clearToken(s);
    expect([session.data.size, local.data.size, readToken(s)]).toEqual([0, 0, null]);
    // clearing again is harmless
    clearToken(s);
  });

  it("is found in the tab first, then in the browser, and an empty value is no token", () => {
    const { s, session, local } = stores();
    local.data.set(TOKEN_KEY, "remembered");
    expect(readToken(s)).toBe("remembered");
    session.data.set(TOKEN_KEY, "this-tab");
    expect(readToken(s)).toBe("this-tab");
    session.data.set(TOKEN_KEY, "");
    local.data.set(TOKEN_KEY, "");
    expect(readToken(s)).toBeNull();
  });

  it("is not an error when the browser keeps nothing, or when a store refuses", () => {
    const none: TokenStores = { session: null, local: null };
    expect(saveToken(none, "t", true)).toBe("none");
    expect(saveToken(none, "t", false)).toBe("none");
    expect(readToken(none)).toBeNull();
    clearToken(none);
    // localStorage refuses to write: the token stays in the tab
    const session = memory();
    const refusing: TokenStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const mixed: TokenStores = { session, local: refusing };
    expect(saveToken(mixed, "t", true)).toBe("session");
    expect(readToken(mixed)).toBe("t");
    clearToken(mixed);
    expect(readToken(mixed)).toBeNull();
    // both refuse: nothing is kept and nothing throws
    const dead: TokenStores = { session: refusing, local: refusing };
    expect(saveToken(dead, "t", false)).toBe("none");
    expect(readToken(dead)).toBeNull();
  });
});

describe("the texts of the sign-in and of the new switches", () => {
  const KEYS = ["login_remember", "login_remember_hint", "srv_network_open", "srv_update_allow_unsigned", "srv_update_keep_logins", "sec_restart_needed"] as const;

  it("exist in the 37 languages and warn about a shared computer", () => {
    for (const k of KEYS) {
      expect(ROWS).toHaveProperty(k);
      for (const l of LANGS) expect(text(l, k).trim().length, `${k} in ${l}`).toBeGreaterThan(3);
    }
    expect(text("en", "login_remember_hint")).toContain("shared computer");
  });

  it("describe the settings of the server table, which lists the new defaults", () => {
    const by = Object.fromEntries(SERVER_SETTINGS.map((s) => [s.key, s]));
    expect(by.listen.value).toBe("127.0.0.1:18200");
    expect(by.network_open).toMatchObject({ value: "false", text: "srv_network_open" });
    expect(by.update_allow_unsigned).toMatchObject({ value: "false", text: "srv_update_allow_unsigned" });
    expect(by.update_keep_logins).toMatchObject({ value: "false", text: "srv_update_keep_logins" });
  });

  it("make the new flags editable from the security page only when the server says so", () => {
    const base: AuthPolicy = {
      switches: [
        { key: "network_open", value: false, safe: true },
        { key: "update_allow_unsigned", value: false, safe: true },
      ],
      attention: [],
      extra_apps: [],
    };
    expect(editableKind(base, base.switches[0])).toBeNull();
    const withEditable: AuthPolicy = { ...base, editable: ["network_open", "update_allow_unsigned"], restart_required: ["network_open"] };
    expect(editableKind(withEditable, withEditable.switches[0])).toBe("flag");
    expect(editableKind(withEditable, withEditable.switches[1])).toBe("flag");
    expect(withEditable.restart_required).toEqual(["network_open"]);
  });

  it("are in the Portuguese of Portugal: no row of the Portuguese column says 'você'", () => {
    const column = Object.entries(ROWS).map(([k, row]) => [k, (row as readonly string[])[5]] as const);
    expect(column.length).toBeGreaterThan(500);
    for (const [k, s] of column) expect(s, k).not.toMatch(/\bvoc[êe]s?\b/i);
    expect(text("pt", "acc_you")).toBe("tu");
  });
});
