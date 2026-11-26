// @vitest-environment jsdom
/* The page of the users and the tokens drawn in a small DOM against a double of the client: the scopes that a token asks for and what a refusal for the scopes says. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { AppContext } from "./context";
import { AccessPage } from "./pages/Configure";
import { SCOPES, provisioningScopes, roleScopes, scopesForRole } from "./services/scopes";
import { makeApp } from "./services/testkit";

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

async function show(over: Partial<Record<keyof Api, unknown>>) {
  const said: string[] = [];
  const api = { users: async () => [], tokens: async () => [], ...over } as unknown as Api;
  const app = { ...makeApp("admin"), api, say: (m: string) => void said.push(m) };
  root = createRoot(box!);
  await act(async () => root!.render(<AppContext.Provider value={app}><AccessPage /></AppContext.Provider>));
  await settle();
  return said;
}

const text = () => box!.textContent ?? "";
const button = (name: string) => [...box!.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement;

async function click(el: Element) {
  await act(async () => (el as HTMLElement).click());
  await settle();
}

async function type(el: Element, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const programName = () => [...box!.querySelectorAll("input:not([type=password]):not([type=checkbox]):not([inputmode])")].pop()!;
const lastCreate = () => [...box!.querySelectorAll("button")].filter((b) => b.textContent?.trim() === "Create").pop()!;

describe("the scopes of a token", () => {
  it("mirror what each role can use and what a program that creates users needs", () => {
    expect(SCOPES).toHaveLength(19);
    expect(roleScopes("viewer")).toHaveLength(5);
    expect(roleScopes("operator")).toHaveLength(13);
    expect(roleScopes("admin")).toEqual([...SCOPES]);
    expect(provisioningScopes("viewer")).toEqual(["admin:users", ...roleScopes("viewer")]);
    expect(provisioningScopes("operator")).toEqual(["admin:users", ...roleScopes("operator")]);
    expect(scopesForRole(["admin:users", "projects:read", "unknown"], "viewer")).toEqual(["projects:read"]);
    expect(scopesForRole(["admin:users", "projects:read"], "admin")).toEqual(["projects:read", "admin:users"]);
  });

  it("are sent only when the token is limited, with the preset of a program that creates operators", async () => {
    const calls: unknown[][] = [];
    await show({ addToken: async (...a: unknown[]) => (calls.push(a), { id: "t1", token: "shown-once" }) });
    await type(programName(), "provisioner");
    await click(lastCreate());
    expect(calls[0]).toEqual(["provisioner", "operator", undefined, undefined]);
    await type(programName(), "provisioner");
    await click(button("For a program that creates operators and viewers"));
    await click(lastCreate());
    expect(calls[1]).toEqual(["provisioner", "admin", undefined, scopesForRole(provisioningScopes("operator"), "admin")]);
  });

  it("cannot be an empty list", async () => {
    await show({});
    await type(programName(), "nothing");
    await click(box!.querySelector("input[type=checkbox]")!);
    expect(text()).toContain("Choose at least one scope.");
    expect((lastCreate() as HTMLButtonElement).disabled).toBe(true);
  });

  it("are shown in the list of the tokens", async () => {
    await show({
      tokens: async () => [
        { id: "a", name: "wide", role: "admin", created: 1700000000, scopes: null },
        { id: "b", name: "narrow", role: "admin", created: 1700000000, scopes: ["admin:users", "projects:read"], template: "custom" },
      ],
    });
    expect(text()).toContain("All of its role");
    expect(text()).toContain("admin:users, projects:read");
  });

  it("say what a limited session needs when the server refuses a user or a token", async () => {
    const refuse = async () => {
      throw new ApiError(403, "forbidden_scope", "beyond the token");
    };
    const said = await show({ addUser: refuse, addToken: refuse });
    const fields = box!.querySelectorAll("input");
    await type(fields[0], "marta");
    await type(box!.querySelector("input[type=password]")!, "una-clave-larga-1");
    await click(button("Create"));
    expect(said[0]).toContain("admin:users and every scope the role of the user can use");
    expect(said[0]).toContain("(beyond the token)");
    await type(programName(), "other");
    await click(lastCreate());
    expect(said[1]).toContain("It needs admin:tokens");
  });
});

describe("a new secret for a token", () => {
  const kept = { id: "tok 1", name: "drillpro", role: "operator", created: 1700000000, scopes: null };
  const answer = ["new", "secret", "once"].join("-");
  const withToken = (over: Partial<Record<keyof Api, unknown>> = {}) => show({ tokens: async () => [kept], ...over });

  it("is asked for only after the confirmation, and shown once", async () => {
    const calls: string[] = [];
    await withToken({ rotateToken: async (id: string) => (calls.push(id), { id, token: answer }) });
    await click(button("New secret"));
    expect(text()).toContain("Give the token of drillpro a new secret?");
    expect(calls).toEqual([]);
    await click(button("Cancel"));
    expect(text()).not.toContain("Give the token of drillpro a new secret?");
    expect(calls).toEqual([]);
    await click(button("New secret"));
    await click(button("Confirm"));
    expect(calls).toEqual(["tok 1"]);
    expect(text()).toContain("Token of drillpro: it is shown only now.");
    expect(box!.querySelector(".secret code")!.textContent).toBe(answer);
    // a second one cannot replace the secret that has not been put away
    expect(button("New secret").disabled).toBe(true);
    await click(button("Close"));
    expect(text()).not.toContain(answer);
    expect(button("New secret").disabled).toBe(false);
  });

  it("is not offered for a token that has expired", async () => {
    await show({ tokens: async () => [{ ...kept, expires: 1700000001 }] });
    expect(button("New secret").disabled).toBe(true);
  });

  it("says what a limited session needs when the server refuses it", async () => {
    const said = await withToken({
      rotateToken: async () => {
        throw new ApiError(403, "forbidden_scope", "beyond the token");
      },
    });
    await click(button("New secret"));
    await click(button("Confirm"));
    expect(said).toHaveLength(1);
    expect(said[0]).toContain("The server refused the new secret");
    expect(said[0]).toContain("(beyond the token)");
    expect(box!.querySelector(".secret")).toBeNull();
  });

  it("warns that the secret may have changed when no answer comes back", async () => {
    const said = await withToken({
      rotateToken: async () => {
        throw new ApiError(0, "timeout", "15000 ms");
      },
    });
    await click(button("New secret"));
    await click(button("Confirm"));
    expect(said[0]).toContain("the token may already have a new secret that nobody saw");
    expect(said).toHaveLength(2);
    expect(button("New secret").disabled).toBe(false);
  });

  it("is a POST to the route of the token, with its identifier escaped", async () => {
    const seen: [string, string | undefined][] = [];
    const client = new Api("t", async (input, init) => {
      seen.push([input, init?.method]);
      return new Response(JSON.stringify({ id: "a/b", token: answer }), { status: 200, headers: { "content-type": "application/json" } });
    });
    expect((await client.rotateToken("a/b")).token).toBe(answer);
    expect(seen).toEqual([["/api/v1/tokens/a%2Fb/rotate", "POST"]]);
  });
});

describe("a token that expires opens no account", () => {
  const warning = "A token that expires creates no user, sets no password, enables nobody and raises no role: the server refuses it.";

  it("is said while an administrator token that may create users is given days", async () => {
    await show({});
    await type(box!.querySelector("input[inputmode]")!, "30");
    expect(text()).not.toContain(warning);
    await click(button("For a program that creates operators and viewers"));
    expect(text()).toContain(warning);
    await type(box!.querySelector("input[inputmode]")!, "");
    expect(text()).not.toContain(warning);
  });
});
