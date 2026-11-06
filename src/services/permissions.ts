/*
 * What each role may do in the common services, as the pages decide to show or enable it. The SERVER decides in the end (every route checks the role and the scopes of the
 * token); this table only keeps the page from offering what would be refused. A token of a program may carry scopes that narrow its role and never widen it.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import { atLeast } from "../model";
import type { Role } from "../types";

export type Action =
  | "projects.read"
  | "projects.write"
  | "projects.hide"
  | "projects.purge"
  | "projects.lock"
  | "projects.force_unlock"
  | "machines.view"
  | "machines.manage"
  | "jobs.prepare"
  | "jobs.start"
  | "jobs.cancel"
  | "catalog.read"
  | "catalog.write"
  | "sessions.own"
  | "sessions.all"
  | "policy.read"
  | "users.manage";

/** The lowest role of each action and the scope a token needs for it (null: no scope narrows it). */
export const RULES: Record<Action, { role: Role; scope: string | null }> = {
  "projects.read": { role: "viewer", scope: "projects:read" },
  "projects.write": { role: "operator", scope: "projects:write" },
  "projects.hide": { role: "operator", scope: "projects:write" },
  "projects.purge": { role: "admin", scope: "projects:write" },
  "projects.lock": { role: "operator", scope: "projects:write" },
  "projects.force_unlock": { role: "admin", scope: "projects:write" },
  "machines.view": { role: "viewer", scope: "machines:view" },
  "machines.manage": { role: "admin", scope: "machines:manage" },
  "jobs.prepare": { role: "operator", scope: "jobs:prepare" },
  "jobs.start": { role: "operator", scope: "jobs:start" },
  "jobs.cancel": { role: "operator", scope: "jobs:cancel" },
  "catalog.read": { role: "viewer", scope: "catalog:read" },
  "catalog.write": { role: "admin", scope: "catalog:write" },
  "sessions.own": { role: "viewer", scope: null },
  "sessions.all": { role: "admin", scope: null },
  "policy.read": { role: "admin", scope: null },
  "users.manage": { role: "admin", scope: null },
};

export const ACTIONS = Object.keys(RULES) as Action[];

/** Who the permissions are worked out for: the role and, for a token of a program, its scopes (null or absent: no scope narrows it). */
export interface Who {
  role: Role;
  scopes?: readonly string[] | null;
}

/** Whether the role (and the scopes of a token) allow the action. A scope narrows a role and never widens it. */
export function can(who: Who | null | undefined, action: Action): boolean {
  if (!who) return false;
  const rule = RULES[action];
  if (!atLeast(who.role, rule.role)) return false;
  if (rule.scope !== null && who.scopes != null && !who.scopes.includes(rule.scope)) return false;
  return true;
}

/** Hiding a project is for the operator who owns it and for any administrator. */
export function canHide(who: Who | null | undefined, name: string, owner: string): boolean {
  if (!can(who, "projects.hide")) return false;
  return who!.role === "admin" || owner === name;
}

/** Whoever holds the lock may keep working; an administrator may take it away. */
export function canUnlock(who: Who | null | undefined, name: string, holder: string): boolean {
  if (!can(who, "projects.lock")) return false;
  return holder === name || can(who, "projects.force_unlock");
}

/** The actions of each role, for the table of the page of the security. */
export function allowedActions(role: Role): Action[] {
  return ACTIONS.filter((a) => can({ role }, a));
}
