import { describe, expect, it } from "vitest";
import { ACTIONS, RULES, allowedActions, can, canHide, canUnlock } from "./permissions";
import { AuthClient, auditDetail, closesCurrent, editableKind, filterAudit, orderSessions, policyRows, policyScore, secondsLeft, spanText, switchValue, wholeNumber } from "./authsvc";
import { ServiceHttp } from "./http";
import { fakeServer } from "./testkit";
import type { AuthPolicy, AuthSession } from "./types";

describe("what each role may do", () => {
  it("gives the viewer only what reads, the operator what prepares and writes, the administrator what manages", () => {
    const viewer = allowedActions("viewer");
    expect(viewer).toEqual(expect.arrayContaining(["projects.read", "machines.view", "catalog.read", "sessions.own"]));
    for (const a of ["projects.write", "jobs.start", "jobs.cancel", "machines.manage", "policy.read", "sessions.all"] as const) expect(viewer).not.toContain(a);
    const operator = allowedActions("operator");
    expect(operator).toEqual(expect.arrayContaining(["projects.write", "projects.lock", "jobs.prepare", "jobs.start", "jobs.cancel"]));
    for (const a of ["projects.purge", "projects.force_unlock", "machines.manage", "catalog.write", "policy.read", "users.manage"] as const) expect(operator).not.toContain(a);
    expect(allowedActions("admin")).toHaveLength(ACTIONS.length);
  });

  it("allows nothing to a person who is not known", () => {
    for (const a of ACTIONS) expect(can(null, a)).toBe(false);
    expect(can(undefined, "projects.read")).toBe(false);
  });

  it("lets a scope narrow the role of a token and never widen it", () => {
    expect(can({ role: "admin", scopes: ["projects:read"] }, "projects.read")).toBe(true);
    expect(can({ role: "admin", scopes: ["projects:read"] }, "projects.write")).toBe(false);
    expect(can({ role: "admin", scopes: ["projects:read"] }, "machines.manage")).toBe(false);
    expect(can({ role: "viewer", scopes: ["projects:write"] }, "projects.write")).toBe(false);
    expect(can({ role: "operator", scopes: [] }, "jobs.start")).toBe(false);
    // no scopes at all: the role alone decides
    expect(can({ role: "operator", scopes: null }, "jobs.start")).toBe(true);
    // the actions that no scope narrows
    expect(can({ role: "admin", scopes: [] }, "policy.read")).toBe(true);
  });

  it("names a scope for every action that has one, in the form the server uses", () => {
    for (const a of ACTIONS) {
      const scope = RULES[a].scope;
      if (scope !== null) expect(scope, a).toMatch(/^(projects|catalog|machines|jobs):(read|write|view|manage|prepare|start|cancel)$/);
    }
  });

  it("lets an operator hide only their own project and an administrator any, and the holder of a lock keep it", () => {
    const op = { role: "operator" } as const;
    const ad = { role: "admin" } as const;
    expect(canHide(op, "ana", "ana")).toBe(true);
    expect(canHide(op, "ana", "bob")).toBe(false);
    expect(canHide(ad, "ana", "bob")).toBe(true);
    expect(canHide({ role: "viewer" }, "ana", "ana")).toBe(false);
    expect(canUnlock(op, "ana", "ana")).toBe(true);
    expect(canUnlock(op, "ana", "bob")).toBe(false);
    expect(canUnlock(ad, "ana", "bob")).toBe(true);
    expect(canUnlock({ role: "viewer" }, "ana", "ana")).toBe(false);
  });
});

describe("the client of the single login", () => {
  it("reads the claims, lists the sessions (all of them on request), closes one and renews", async () => {
    const s = fakeServer({
      "GET /auth/session": () => ({ name: "ana", role: "operator", is_token: false, app: "studio", scopes: null }),
      "GET /auth/sessions": () => ({ sessions: [] }),
      "DELETE /auth/sessions/s%2F1": () => ({ ok: true }),
      "POST /auth/refresh": () => ({ expires_s: 3600 }),
      "POST /auth/logout-all": () => ({ closed: 3 }),
      "GET /auth/policy": () => ({ switches: [], attention: [], extra_apps: [] }),
      "GET /auth/apps": () => ({ apps: ["studio"], known_only: true }),
    });
    const a = new AuthClient(new ServiceHttp(() => "t", s.fetcher));
    expect((await a.claims()).app).toBe("studio");
    await a.sessions();
    await a.sessions(true);
    await a.closeSession("s/1");
    expect((await a.refresh()).expires_s).toBe(3600);
    expect((await a.logoutAll()).closed).toBe(3);
    await a.policy();
    expect((await a.apps()).apps).toEqual(["studio"]);
    expect(s.calls[1].query.get("all")).toBeNull();
    expect(s.calls[2].query.get("all")).toBe("true");
  });
});

describe("the audit, the keys and the changes of the policy", () => {
  it("asks the audit with the filters, lists the keys, and sends a change with the confirmation only when it was given", async () => {
    const s = fakeServer({
      "GET /audit": () => ({ enabled: true, lines: [{ at: 5, event: "login", who: "ana", ip: "10.0.0.2" }] }),
      "GET /auth/keys": () => ({ tokens: [], tls: { configured: false, sha256: null } }),
      "PUT /auth/policy": () => ({ switches: [], attention: [], extra_apps: [], editable: [] }),
    });
    const a = new AuthClient(new ServiceHttp(() => "t", s.fetcher));
    const r = await a.audit({ who: " ana ", event: "login", from: 3, limit: 20 });
    expect(r.lines[0].event).toBe("login");
    expect(s.calls[0].query.get("who")).toBe("ana");
    expect(s.calls[0].query.get("event")).toBe("login");
    expect(s.calls[0].query.get("since")).toBe("3");
    expect(s.calls[0].query.get("until")).toBeNull();
    expect(s.calls[0].query.get("limit")).toBe("20");
    expect((await a.keys()).tls.configured).toBe(false);
    await a.changePolicy("password_min_len", 12);
    await a.changePolicy("url_token", true, true);
    expect(s.calls[2].body).toEqual({ key: "password_min_len", value: 12 });
    expect(s.calls[3].body).toEqual({ key: "url_token", value: true, confirm_weak: true });
  });

  it("writes the fields of a line besides the ones the table has a column for", () => {
    expect(auditDetail({ at: 1, event: "policy_change", who: "ana", role: "admin", key: "url_token", from: "false", to: "true" })).toBe("role=admin key=url_token from=false to=true");
    expect(auditDetail({ at: 1, event: "logout", who: "ana", ip: "" })).toBe("");
  });

  it("knows which switches have a button, and reads a whole number typed by hand", () => {
    const policy: AuthPolicy = { switches: [], attention: [], extra_apps: [], editable: ["url_token", "password_min_len", "design_run"] };
    expect(editableKind(policy, { key: "url_token", value: false, safe: true })).toBe("flag");
    expect(editableKind(policy, { key: "password_min_len", value: 8, safe: true })).toBe("number");
    expect(editableKind(policy, { key: "session_hours", value: 12, safe: true })).toBeNull();
    expect(editableKind(policy, { key: "design_run", value: "yes", safe: true })).toBeNull();
    expect(editableKind({ switches: [], attention: [], extra_apps: [] }, { key: "url_token", value: false, safe: true })).toBeNull();
    expect(wholeNumber("12")).toBe(12);
    expect(wholeNumber(" 7 ")).toBe(7);
    for (const bad of ["", "1.5", "abc", "-3", "1234567890"]) expect(wholeNumber(bad), bad).toBeNull();
  });
});

describe("the sessions", () => {
  const s = (id: string, created: number, current = false): AuthSession => ({ id, name: "ana", role: "operator", app: "studio", created, expires: created + 100, current });

  it("lists the current one first and then the newest", () => {
    expect(orderSessions([s("a", 1), s("b", 5), s("c", 3, true)]).map((x) => x.id)).toEqual(["c", "b", "a"]);
  });

  it("knows when closing a session is closing the one in use", () => {
    const list = [s("a", 1), s("c", 3, true)];
    expect(closesCurrent(list, "c")).toBe(true);
    expect(closesCurrent(list, "a")).toBe(false);
    expect(closesCurrent(list, "zzz")).toBe(false);
  });

  it("works out the time left and writes a span of time", () => {
    expect(secondsLeft(200, 150)).toBe(50);
    expect(secondsLeft(100, 150)).toBe(0);
    expect(secondsLeft(null, 150)).toBe(0);
    expect(spanText(20)).toBe("20 s");
    expect(spanText(125)).toBe("2 min");
    expect(spanText(3 * 3600 + 20 * 60)).toBe("3 h 20 min");
    expect(spanText(2 * 86400 + 5 * 3600)).toBe("2 d 5 h");
  });
});

describe("the policy of the server", () => {
  const policy: AuthPolicy = {
    switches: [
      { key: "password_min_len", value: 8, safe: true },
      { key: "url_token", value: false, safe: true },
      { key: "token_default_days", value: 0, safe: false },
      { key: "password_classes", value: 1, safe: false },
    ],
    attention: ["password_classes", "token_default_days"],
    extra_apps: [],
  };

  it("puts the switches that deserve a look first and keeps the order of the server in each part", () => {
    const rows = policyRows(policy);
    expect(rows.map((r) => r.sw.key)).toEqual(["token_default_days", "password_classes", "password_min_len", "url_token"]);
    expect(rows.map((r) => r.attention)).toEqual([true, true, false, false]);
  });

  it("marks a switch that is not safe even when the list of attention does not name it", () => {
    const odd: AuthPolicy = { switches: [{ key: "x", value: true, safe: false }], attention: [], extra_apps: [] };
    expect(policyRows(odd)[0].attention).toBe(true);
    expect(policyScore(odd)).toEqual({ safe: 0, total: 1, attention: 1 });
    expect(policyScore(policy)).toEqual({ safe: 2, total: 4, attention: 2 });
  });

  it("writes the values of the switches, and cuts a long one", () => {
    expect(switchValue(true)).toBe("on");
    expect(switchValue(false)).toBe("off");
    expect(switchValue(null)).toBe("-");
    expect(switchValue(12)).toBe("12");
    expect(switchValue(["a", "b"])).toBe('["a","b"]');
    expect(switchValue("x".repeat(200))).toHaveLength(80);
  });
});

describe("the audit that this server does not give yet", () => {
  const entries = [
    { at: 100, event: "login", who: "ana", app: "studio" },
    { at: 200, event: "login_failed", who: "bob" },
    { at: 300, event: "denied", who: "ana" },
  ];

  it("filters by person, by kind of event and by time, the filters the proposed route would take", () => {
    const f = { who: "", event: "", from: null, to: null };
    expect(filterAudit(entries, f)).toHaveLength(3);
    expect(filterAudit(entries, { ...f, who: " ANA " }).map((e) => e.at)).toEqual([100, 300]);
    expect(filterAudit(entries, { ...f, event: "login" }).map((e) => e.at)).toEqual([100, 200]);
    expect(filterAudit(entries, { ...f, from: 150, to: 250 }).map((e) => e.at)).toEqual([200]);
  });
});
