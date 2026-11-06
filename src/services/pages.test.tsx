// @vitest-environment jsdom
/* The pages of the common services drawn in a small DOM against a server that answers from a table of routes: what each role sees, the states of loading, empty and error, the
 * conflict of a write, and the buttons that are off. The logic under them is tested in the other files of this folder. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FactoryPage } from "../pages/FactoryPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SecurityPage } from "../pages/SecurityPage";
import { WorkPage } from "../pages/WorkPage";
import type { Role } from "../types";
import { Providers, fakeServer, makeApp, makeServices, refusal } from "./testkit";
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

async function show(ui: React.ReactNode, role: Role, routes: Record<string, Handler>, claims: AuthClaims | null = null) {
  const server = fakeServer(routes);
  const app = makeApp(role);
  const services = makeServices(server.fetcher, role, claims);
  root = createRoot(box!);
  await act(async () => root!.render(<Providers app={app} services={services}>{ui}</Providers>));
  await settle();
  return { server, text: () => box!.textContent ?? "", $: (s: string) => box!.querySelector(s), $$: (s: string) => [...box!.querySelectorAll(s)] };
}

const row = (text: string) => [...box!.querySelectorAll(".prow")].find((r) => r.textContent?.includes(text));

const button = (name: string) => [...box!.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;

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

const PROJECTS: Record<string, Handler> = {
  "GET /auth/apps": () => ({ apps: ["studio", "pcb"], known_only: true }),
  "GET /apps/studio/projects": () => ({
    total: 2,
    offset: 0,
    limit: 200,
    items: [
      { id: "p-1", app: "studio", name: "Board A #prototype", owner: "ana", etag: "e1", files: 2, updated: 1700000000 },
      { id: "p-2", app: "studio", name: "Laser jig", owner: "bob", etag: "e2", files: 1, updated: 1700000100, locked: true },
    ],
  }),
  "GET /apps/studio/projects/p-1": () => ({
    id: "p-1",
    app: "studio",
    name: "Board A #prototype",
    owner: "ana",
    etag: "e1",
    bytes: 120,
    lock: null,
    files: [
      { name: "project.json", version: 1, sha256: "a".repeat(64), size: 20 },
      { name: "layers/top.gbr", version: 3, sha256: "b".repeat(64), size: 100, by: "ana" },
    ],
  }),
  "GET /apps/studio/projects/p-1/files/versions": () => ({ name: "project.json", versions: [{ version: 1, sha256: "a".repeat(64), size: 20 }] }),
};

describe("the explorer of the projects", () => {
  it("shows a viewer the projects, the tags and the files, and none of the buttons that write", async () => {
    const p = await show(<ProjectsPage route="" />, "viewer", PROJECTS);
    expect(p.text()).toContain("Board A");
    expect(p.text()).toContain("Laser jig");
    expect(p.text()).toContain("#prototype");
    expect(p.text()).toContain("You can look and download; an operator writes.");
    expect(button("Create")).toBeUndefined();
    await click(row("Board A"));
    expect(p.text()).toContain("project.json");
    expect(p.text()).toContain("top.gbr");
    expect(p.text()).toContain("layers/");
    expect(button("Download")).toBeTruthy();
    expect(button("Delete")).toBeUndefined();
    expect(button("Upload")).toBeUndefined();
    expect(p.text()).not.toContain("Upload a file");
    expect(p.text()).not.toContain("Take the lock");
    expect(p.server.calls.some((c) => c.method !== "GET")).toBe(false);
  });

  it("narrows the list by tag", async () => {
    const p = await show(<ProjectsPage route="" />, "viewer", PROJECTS);
    await click(button("#prototype · 1"));
    expect(p.text()).toContain("Board A");
    expect(p.text()).not.toContain("Laser jig");
    await click(button("#prototype · 1"));
    expect(p.text()).toContain("Laser jig");
  });

  it("gives an operator the forms and the lock, and warns about a conflict when the project changed under them", async () => {
    const p = await show(<ProjectsPage route="" />, "operator", {
      ...PROJECTS,
      "PUT /apps/studio/projects/p-1": () => refusal(412, "precondition_failed"),
    });
    expect(button("Create")).toBeTruthy();
    await click(row("Board A"));
    expect(p.text()).toContain("Upload a file");
    expect(p.text()).toContain("Take the lock");
    expect(button("Delete")).toBeTruthy();
    const name = p.$$("input").find((i) => (i as HTMLInputElement).value === "Board A #prototype") as HTMLInputElement;
    await typeInto(name, "Board A2 #prototype");
    await click(button("Save"));
    const alert = p.$("[role=alert]");
    expect(alert?.textContent).toContain("Somebody changed this file after you opened the project");
    expect(button("Reload")).toBeTruthy();
  });

  it("shows the error of the server when the list cannot be had, and the empty list", async () => {
    const down = await show(<ProjectsPage route="" />, "viewer", { "GET /apps/studio/projects": () => refusal(500, "internal") });
    expect(down.text()).toContain("The server failed on this request");
    await act(async () => root!.unmount());
    root = null;
    const none = await show(<ProjectsPage route="" />, "viewer", { "GET /apps/studio/projects": () => ({ total: 0, offset: 0, limit: 200, items: [] }) });
    expect(none.text()).toContain("No projects.");
  });

  it("does not ask for anything when the token cannot read projects", async () => {
    const claims: AuthClaims = { name: "prog", role: "viewer", is_token: true, scopes: ["machines:view"] };
    const p = await show(<ProjectsPage route="" />, "viewer", PROJECTS, claims);
    expect(p.text()).toContain("Your role does not allow this page.");
    expect(p.server.calls.some((c) => c.path.includes("/projects"))).toBe(false);
  });
});

describe("the machines and the jobs", () => {
  const WORK: Record<string, Handler> = {
    "GET /work/machines": () => ({ machines: [{ id: "demo-1", name: "Demo", plugin: "demo", state: "idle", capabilities: { requests: ["demo"], pause: "all" } }] }),
    "GET /plugins": () => ({ plugins: [{ kind: "demo", title: "Demonstration", capabilities: { requests: ["demo"] }, manages_machines: true }] }),
    "GET /work/jobs": () => ({
      total: 1,
      offset: 0,
      limit: 100,
      items: [{ id: "w-1", machine: "demo-1", plugin: "demo", name: "First", state: "queued", position: 1, owner: "ana", created: 1700000000 }],
    }),
    "GET /notifications": () => ({ notifications: [] }),
    "POST /work/jobs/w-1/start": () => ({ id: "w-1", machine: "demo-1", plugin: "demo", state: "running" }),
  };

  it("gives a viewer the queue and none of the buttons", async () => {
    const p = await show(<WorkPage route="" />, "viewer", WORK);
    expect(p.text()).toContain("First");
    expect(p.text()).toContain("Queued");
    expect(button("Start")).toBeUndefined();
    expect(button("Stop")).toBeUndefined();
    expect(p.text()).not.toContain("Prepare a job");
  });

  it("gives an operator the form and asks twice before it starts a job", async () => {
    const p = await show(<WorkPage route="" />, "operator", WORK);
    expect(p.text()).toContain("Prepare a job");
    await click(button("Start"));
    expect(p.server.calls.some((c) => c.path.endsWith("/start"))).toBe(false);
    expect(button("Sure?")).toBeTruthy();
    await click(button("Sure?"));
    expect(p.server.calls.some((c) => c.method === "POST" && c.path === "/work/jobs/w-1/start")).toBe(true);
  });

  it("shows an operator the machines and the plugins, but not the forms of the administrator", async () => {
    const p = await show(<WorkPage route="" />, "operator", WORK);
    await click(p.$$("[role=tab]").find((t) => t.textContent === "Machines"));
    expect(p.text()).toContain("Demo");
    expect(p.text()).not.toContain("Add a machine");
    expect(button("Delete")).toBeUndefined();
  });

  it("gives an administrator the form to add a machine of a plugin that keeps its own", async () => {
    const p = await show(<WorkPage route="" />, "admin", WORK);
    await click(p.$$("[role=tab]").find((t) => t.textContent === "Machines"));
    expect(p.text()).toContain("Add a machine");
    expect(button("Delete")).toBeTruthy();
  });

  it("shows the table of the tool places, warns about a place that two tools share and builds nothing until it is right", async () => {
    const p = await show(<WorkPage route="" />, "operator", WORK);
    await click(p.$$("[role=tab]").find((t) => t.textContent === "Tool places in the changer"));
    const selects = p.$$("select[aria-label^='Place']") as HTMLSelectElement[];
    expect(selects).toHaveLength(3);
    expect(button("Use in the request")?.disabled).toBe(true);
    await pick(selects[0], "4");
    await pick(selects[1], "4");
    expect(p.$("[role=alert]")?.textContent).toContain("Place 4 is given to two tools: 1, 2.");
    expect(button("Use in the request")?.disabled).toBe(true);
    await click(button("Clear"));
    expect(p.$("[role=alert]")?.textContent).toContain("Tool 1 has no place.");
    await click(button("Fill in order"));
    expect(p.$("[role=alert]")).toBeNull();
    expect(button("Use in the request")?.disabled).toBe(false);
  });
});

describe("the security", () => {
  const SESSIONS: Record<string, Handler> = {
    "GET /auth/sessions": () => ({
      sessions: [
        { id: "s-old", name: "ana", role: "admin", app: "android", created: 1700000000, expires: 1900000000, ip: "10.0.0.5", current: false },
        { id: "s-now", name: "ana", role: "admin", app: "studio", created: 1700000100, expires: 1900000000, ip: "10.0.0.2", current: true },
      ],
    }),
    "GET /auth/policy": () => ({
      switches: [
        { key: "password_min_len", value: 8, safe: true },
        { key: "token_default_days", value: 0, safe: false },
      ],
      attention: ["token_default_days"],
      extra_apps: [],
      editable: ["password_min_len"],
    }),
    "GET /audit": () => ({ enabled: true, lines: [{ at: 1700000200, event: "policy_change", who: "ana", key: "url_token" }] }),
    "GET /auth/keys": () => ({
      tokens: [{ id: "tk-1", name: "drillpro-bench", role: "operator", created: 1700000000, age_s: 100, last_used: null, expires: null }],
      tls: { configured: true, sha256: "ab".repeat(32) },
    }),
  };

  it("shows an administrator the sessions, the policy with what deserves a look, the audit and the keys", async () => {
    const p = await show(<SecurityPage />, "admin", SESSIONS);
    expect(p.text()).toContain("android");
    expect(p.text()).toContain("this one");
    expect(p.text()).toContain("Policy of the server");
    expect(p.text()).toContain("token_default_days");
    expect(p.text()).toContain("1 switches to look at");
    expect(p.text()).toContain("server.cfg");
    expect(p.text()).toContain("Audit log");
    expect(p.text()).toContain("policy_change");
    expect(p.text()).toContain("key=url_token");
    expect(p.text()).toContain("Keys and TLS fingerprint");
    expect(p.text()).toContain("drillpro-bench");
    expect(p.text()).toContain("ab".repeat(32));
    expect(p.text()).not.toContain("Not available on this server");
    expect(button("Sign out everywhere")).toBeTruthy();
    // no secret anywhere: the policy has none
    expect(p.text()).not.toMatch(/token_hash|private_key/);
  });

  it("changes a switch the server lets change, and asks again when the server says the value is looser than recommended", async () => {
    const puts: Call[] = [];
    const POLICY = { switches: [{ key: "password_min_len", value: 8, safe: true }], attention: [], extra_apps: [], editable: ["password_min_len"] };
    const p = await show(<SecurityPage />, "admin", {
      ...SESSIONS,
      "GET /auth/policy": () => POLICY,
      "PUT /auth/policy": (c) => {
        puts.push(c);
        return (c.body as { confirm_weak?: boolean }).confirm_weak ? POLICY : refusal(409, "weak_confirm_required");
      },
    });
    const input = p.$("input[aria-label=password_min_len]") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(button("Save")?.disabled).toBe(true);
    await typeInto(input, "6");
    await click(button("Save"));
    expect(puts).toHaveLength(1);
    expect(puts[0].body).toEqual({ key: "password_min_len", value: 6 });
    expect(p.text()).toContain("This makes the server less strict than recommended. Apply it anyway?");
    await click(button("Confirm"));
    expect(puts).toHaveLength(2);
    expect(puts[1].body).toEqual({ key: "password_min_len", value: 6, confirm_weak: true });
    expect(p.text()).not.toContain("Apply it anyway?");
  });

  it("does not ask for the policy, the audit, the keys or the sessions of everybody for a viewer, and shows the table of the roles", async () => {
    const p = await show(<SecurityPage />, "viewer", SESSIONS);
    for (const path of ["/auth/policy", "/audit", "/auth/keys"]) expect(p.server.calls.some((c) => c.path === path)).toBe(false);
    expect(p.text()).not.toContain("Policy of the server");
    expect(p.text()).not.toContain("All users");
    expect(p.text()).toContain("What each role may do");
    expect(p.server.calls.find((c) => c.path === "/auth/sessions")?.query.get("all")).toBeNull();
  });

  it("asks twice before it closes a session", async () => {
    const p = await show(<SecurityPage />, "operator", { ...SESSIONS, "DELETE /auth/sessions/s-old": () => ({ ok: true }) });
    const close = p.$$("button").filter((b) => b.textContent === "Close");
    expect(close).toHaveLength(1);
    await click(close[0]);
    expect(p.server.calls.some((c) => c.method === "DELETE")).toBe(false);
    await click(button("Sure?"));
    expect(p.server.calls.some((c) => c.method === "DELETE" && c.path === "/auth/sessions/s-old")).toBe(true);
  });
});

describe("design and factory", () => {
  const CHECK = {
    schema: "phoenix-check/1",
    passes: false,
    confirmed: [{ rank: 5, rule: "copper_clearance", code: "PHOENIX-DRC-001", severity: "error", location: "track x", at_nm: [1500000, 2500000], measured_nm: 100000, limit_nm: 200000, detail: "" }],
    inconclusive: [],
  };
  const FACTORY: Record<string, Handler> = {
    "GET /apps/pcb/projects": () => ({ total: 1, offset: 0, limit: 200, items: [{ id: "p-9", app: "pcb", name: "Demo board", owner: "ana", etag: "e" }] }),
    "GET /apps/pcb/projects/p-9/files": () => ({
      files: [
        { name: "reports/check.json", version: 1, sha256: "c".repeat(64), size: 400 },
        { name: "board.brd", version: 1, sha256: "d".repeat(64), size: 9000 },
        { name: "settings.json", version: 1, sha256: "e".repeat(64), size: 20 },
      ],
    }),
    "GET /apps/pcb/projects/p-9/files/content": (c) =>
      c.query.get("name") === "reports/check.json" ? new Response(JSON.stringify(CHECK)) : new Response(JSON.stringify({ not: "a report" })),
  };

  it("keeps the buttons that run the checks off for a viewer and says so, and shows the report left in a project as a table", async () => {
    const p = await show(<FactoryPage />, "viewer", FACTORY);
    expect(p.text()).toContain("Your role does not allow this.");
    const run = p.$$("button").filter((b) => ["Design rule check", "Bill of materials", "Fabrication package", "Panel"].includes(b.textContent ?? ""));
    expect(run).toHaveLength(4);
    for (const b of run) expect((b as HTMLButtonElement).disabled).toBe(true);
    const select = p.$$("select").find((s) => [...(s as HTMLSelectElement).options].some((o) => o.textContent === "Demo board")) as HTMLSelectElement;
    await pick(select, "p-9");
    expect(p.text()).toContain("reports/check.json");
    expect(p.text()).toContain("PHOENIX-DRC-001");
    expect(p.text()).toContain("track x");
    expect(p.text()).toContain("1.5, 2.5 mm");
    // the severity is said in words and in a mark, not by the colour alone
    expect(p.text()).toContain("✖ Error");
    expect(p.text()).toContain("Fails");
    expect(p.$$("button").some((b) => b.textContent === "Design rule check" && !(b as HTMLButtonElement).disabled)).toBe(false);
  });

  it("asks the server to run a check on the board of the project, and reads the project again when the job is done", async () => {
    const posts: Call[] = [];
    const p = await show(<FactoryPage />, "operator", {
      ...FACTORY,
      "POST /apps/pcb/jobs": (c) => {
        posts.push(c);
        return { id: "w-1", machine: "", plugin: "phoenix", app: "pcb", state: "done", message: "reports/check.json written" };
      },
    });
    const select = p.$$("select").find((s) => [...(s as HTMLSelectElement).options].some((o) => o.textContent === "Demo board")) as HTMLSelectElement;
    expect(button("Design rule check")?.disabled).toBe(true);
    await pick(select, "p-9");
    expect(button("Design rule check")?.disabled).toBe(false);
    const filesBefore = p.server.calls.filter((c) => c.path === "/apps/pcb/projects/p-9/files").length;
    await click(button("Design rule check"));
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toEqual({ kind: "check", project: "p-9", file: "board.brd", options: {} });
    expect(p.server.calls.filter((c) => c.path === "/apps/pcb/projects/p-9/files").length).toBe(filesBefore + 1);
  });

  it("says when a project has no report", async () => {
    const p = await show(<FactoryPage />, "viewer", { ...FACTORY, "GET /apps/pcb/projects/p-9/files/content": () => new Response("{}") });
    const select = p.$$("select").find((s) => [...(s as HTMLSelectElement).options].some((o) => o.textContent === "Demo board")) as HTMLSelectElement;
    await pick(select, "p-9");
    expect(p.text()).toContain("No report found in this project.");
  });
});

describe("the fields of the pages", () => {
  /** The fields that have no label around them and no name of their own: a person with a screen reader would not know what they are. */
  const nameless = () =>
    [...box!.querySelectorAll("input, select, textarea")].filter((el) => !el.closest("label") && !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby")).map((el) => el.outerHTML);

  it("have a name in the explorer of the projects, with the forms of an operator open", async () => {
    const p = await show(<ProjectsPage route="" />, "operator", PROJECTS);
    await click(row("Board A"));
    expect(p.$$("input").length).toBeGreaterThan(4);
    expect(nameless()).toEqual([]);
  });

  it("have a name in the queue, the new job, the machines of an administrator and the table of the tool places", async () => {
    const work: Record<string, Handler> = {
      "GET /work/machines": () => ({ machines: [{ id: "demo-1", name: "Demo", plugin: "demo", state: "idle", capabilities: { requests: ["demo"] } }] }),
      "GET /plugins": () => ({ plugins: [{ kind: "demo", title: "Demonstration", capabilities: { requests: ["demo"] }, manages_machines: true }] }),
      "GET /work/jobs": () => ({ total: 0, offset: 0, limit: 100, items: [] }),
      "GET /notifications": () => ({ notifications: [] }),
    };
    const p = await show(<WorkPage route="" />, "admin", work);
    expect(nameless()).toEqual([]);
    for (const tab of ["Machines", "Tool places in the changer", "Notifications"]) {
      await click(p.$$("[role=tab]").find((t) => t.textContent?.startsWith(tab)));
      expect(nameless(), tab).toEqual([]);
    }
  });

  it("have a name in the security and the factory pages", async () => {
    const s = await show(<SecurityPage />, "admin", { "GET /auth/sessions": () => ({ sessions: [] }), "GET /auth/policy": () => ({ switches: [], attention: [], extra_apps: [] }) });
    expect(s.text()).toContain("No open sessions.");
    expect(nameless()).toEqual([]);
    await act(async () => root!.unmount());
    root = null;
    await show(<FactoryPage />, "viewer", { "GET /apps/pcb/projects": () => ({ total: 0, offset: 0, limit: 200, items: [] }) });
    expect(nameless()).toEqual([]);
  });

  it("mark the tabs and the panel they open for a screen reader", async () => {
    const p = await show(<WorkPage route="" />, "viewer", { "GET /work/machines": () => ({ machines: [] }), "GET /plugins": () => ({ plugins: [] }), "GET /work/jobs": () => ({ total: 0, offset: 0, limit: 100, items: [] }), "GET /notifications": () => ({ notifications: [] }) });
    const tabs = p.$$("[role=tab]");
    expect(tabs).toHaveLength(5);
    expect(tabs.filter((t) => t.getAttribute("aria-selected") === "true")).toHaveLength(1);
    const panel = p.$("[role=tabpanel]");
    expect(panel?.getAttribute("aria-labelledby")).toBe(tabs.find((t) => t.getAttribute("aria-selected") === "true")?.id);
  });
});
