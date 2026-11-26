/*
 * The scopes that can limit the token of a program (docs/API.md of EH3D-SERVER). A token limited to scopes never gives more than it has: it makes a user (or sets a password,
 * enables one or raises a role) only when it carries `admin:users` and every scope that the role of the user can use, and it never makes, changes or deletes an administrator.
 * The SERVER decides; this table only helps the person who makes the token to ask for what the program needs. GPL-3.0-or-later.
 */
import type { Role } from "../types";

/** Every scope the server knows. */
export const SCOPES = [
  "projects:read",
  "projects:write",
  "catalog:read",
  "catalog:write",
  "artifacts:read",
  "artifacts:write",
  "tasks:read",
  "tasks:run",
  "machines:view",
  "jobs:prepare",
  "jobs:authorize",
  "jobs:start",
  "jobs:confirm",
  "jobs:cancel",
  "machines:manage",
  "admin:users",
  "admin:tokens",
  "admin:policy",
  "admin:updates",
] as const;

const VIEWER = ["projects:read", "catalog:read", "artifacts:read", "tasks:read", "machines:view"];
const OPERATOR = [...VIEWER, "projects:write", "artifacts:write", "tasks:run", "jobs:prepare", "jobs:authorize", "jobs:start", "jobs:confirm", "jobs:cancel"];

/** The scopes a login of each role can use (an administrator: all of them). */
export function roleScopes(role: Role): string[] {
  if (role === "viewer") return [...VIEWER];
  if (role === "operator") return [...OPERATOR];
  return [...SCOPES];
}

/** What a token must carry to make users of `role` (viewer or operator; an administrator is never made by a limited token). The token itself needs the role administrator. */
export function provisioningScopes(role: "viewer" | "operator"): string[] {
  return ["admin:users", ...roleScopes(role)];
}

/** The chosen scopes that the role of the token can use, in the order of the server: a scope the role cannot use adds nothing. */
export function scopesForRole(chosen: readonly string[], role: Role): string[] {
  const usable = roleScopes(role);
  return SCOPES.filter((s) => chosen.includes(s) && usable.includes(s));
}
