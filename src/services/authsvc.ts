/*
 * The single login of the server (`/api/v1/auth/...`, docs/AUTH.md of EH3D-SERVER): the client, and what the page of the security decides with — the claims of the
 * login, the open sessions, the switches of the policy with the ones that deserve a look, and the audit that this server does not give yet. Nothing here ever holds a secret:
 * the policy has no token, hash or key, and the id of a session is not the token. GPL-3.0-or-later.
 */
import type { ServiceHttp } from "./http";
import type { AuthApps, AuthClaims, AuthKeys, AuthPolicy, AuthPolicySwitch, AuthSession } from "./types";

export class AuthClient {
  constructor(private http: ServiceHttp) {}

  claims = () => this.http.json<AuthClaims>("GET", "/auth/session");
  sessions = async (all = false): Promise<AuthSession[]> => (await this.http.json<{ sessions: AuthSession[] }>("GET", "/auth/sessions", { query: { all: all ? "true" : undefined } })).sessions;
  closeSession = (id: string) => this.http.json<unknown>("DELETE", `/auth/sessions/${encodeURIComponent(id)}`);
  logoutAll = () => this.http.json<{ closed: number }>("POST", "/auth/logout-all", { json: {} });
  refresh = () => this.http.json<{ expires_s: number }>("POST", "/auth/refresh", { json: {} });
  policy = () => this.http.json<AuthPolicy>("GET", "/auth/policy");
  /** Changes one switch while the server runs; a looser value than recommended is applied only with `confirmWeak`. The answer is the new policy. */
  changePolicy = (key: string, value: boolean | number, confirmWeak = false) =>
    this.http.json<AuthPolicy>("PUT", "/auth/policy", { json: confirmWeak ? { key, value, confirm_weak: true } : { key, value } });
  keys = () => this.http.json<AuthKeys>("GET", "/auth/keys");
  /** The lines of the audit, the newest first (an administrator). */
  audit = async (f: Partial<AuditFilter> & { limit?: number } = {}): Promise<AuditResult> =>
    this.http.json<AuditResult>("GET", "/audit", { query: { who: f.who?.trim() || undefined, event: f.event?.trim() || undefined, since: f.from ?? undefined, until: f.to ?? undefined, limit: f.limit ?? 100 } });
  apps = () => this.http.json<AuthApps>("GET", "/auth/apps");
}

// ---- the sessions

/** The sessions as the list shows them: the current one first, then the newest. */
export function orderSessions(list: readonly AuthSession[]): AuthSession[] {
  return [...list].sort((a, b) => Number(b.current) - Number(a.current) || b.created - a.created);
}

/** Closing the session this browser uses ends the sign-in here: the page says so before it asks. */
export function closesCurrent(list: readonly AuthSession[], id: string): boolean {
  return list.some((s) => s.id === id && s.current);
}

/** How long a login has left, in seconds (0 when it has ended). */
export function secondsLeft(expires: number | null | undefined, nowS: number): number {
  return expires == null ? 0 : Math.max(0, Math.floor(expires - nowS));
}

/** The time as the lists show it: `3 h 20 min`, `45 min`, `20 s`. */
export function spanText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s >= 86400) return `${Math.floor(s / 86400)} d ${Math.floor((s % 86400) / 3600)} h`;
  if (s >= 3600) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  if (s >= 60) return `${Math.floor(s / 60)} min`;
  return `${s} s`;
}

// ---- the policy

/** The switches of the policy for the table: the ones that deserve a look first, then the rest in the order of the server. */
export function policyRows(p: AuthPolicy): { sw: AuthPolicySwitch; attention: boolean }[] {
  const flagged = new Set(p.attention);
  const rows = p.switches.map((sw) => ({ sw, attention: flagged.has(sw.key) || !sw.safe }));
  return [...rows.filter((r) => r.attention), ...rows.filter((r) => !r.attention)];
}

/** A value of a switch as the table writes it. Strings that look like secrets are never written whole: a value longer than 80 characters is cut. */
export function switchValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "on" : "off";
  if (v === null || v === undefined) return "-";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return s.length > 80 ? `${s.slice(0, 77)}...` : s;
}

/** How many switches are as strict as recommended and how many are not. */
export function policyScore(p: AuthPolicy): { safe: number; total: number; attention: number } {
  const attention = new Set([...p.attention, ...p.switches.filter((s) => !s.safe).map((s) => s.key)]).size;
  return { safe: p.switches.filter((s) => s.safe).length, total: p.switches.length, attention };
}

// ---- the audit (`GET /api/v1/audit`)

export interface AuditEntry {
  at: number;
  event: string;
  who?: string;
  app?: string;
  detail?: string;
  ip?: string;
  /** The other fields the event was written with (`role`, `key`, `project`...). */
  [field: string]: unknown;
}

export interface AuditResult {
  enabled: boolean;
  lines: AuditEntry[];
}

/** The fields of a line of the audit besides the ones the table has a column for, as `key=value` words (a value that is not text is written as JSON; none is cut here). */
export function auditDetail(e: AuditEntry): string {
  const own = new Set(["at", "event", "who"]);
  return Object.entries(e)
    .filter(([k, v]) => !own.has(k) && v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join(" ");
}

/** Whether a switch of the policy can be changed while the server runs, and the value a click on it would set (a flag is turned over; a number is typed). */
export function editableKind(p: AuthPolicy, sw: AuthPolicySwitch): "flag" | "number" | null {
  if (!(p.editable ?? []).includes(sw.key)) return null;
  if (typeof sw.value === "boolean") return "flag";
  return typeof sw.value === "number" ? "number" : null;
}

/** Whether the value a person typed for a number switch is a whole number (the server checks the range of each key). */
export function wholeNumber(text: string): number | null {
  return /^\d{1,9}$/.test(text.trim()) ? Number(text.trim()) : null;
}

export interface AuditFilter {
  who: string;
  event: string;
  from: number | null;
  to: number | null;
}

/** The entries that match the filters (the proposed `GET /api/v1/audit` would take the same ones): whoever, the kind of event, and the time. */
export function filterAudit(entries: readonly AuditEntry[], f: AuditFilter): AuditEntry[] {
  const who = f.who.trim().toLowerCase();
  const event = f.event.trim().toLowerCase();
  return entries.filter((e) => {
    if (who && !(e.who ?? "").toLowerCase().includes(who)) return false;
    if (event && !e.event.toLowerCase().includes(event)) return false;
    if (f.from !== null && e.at < f.from) return false;
    if (f.to !== null && e.at > f.to) return false;
    return true;
  });
}
