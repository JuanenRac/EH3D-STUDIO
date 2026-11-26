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
