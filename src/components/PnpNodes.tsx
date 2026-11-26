/* The nodes of the pick-and-place machines: the list the server keeps (health, readiness, what the feeders and the head said last), the "ask now" of an operator and the
 * register, change and remove of an administrator, each asked twice. The token of a node is never shown (the server sends `********`). The list is asked for again when the
 * server says on its websocket that a node changed; the nodes themselves are only ever asked by the server. GPL-3.0-or-later. */
import { useEffect, useRef, useState } from "react";
import { useApp, usePolled } from "../context";
import { useServices } from "../services/context";
import { ApiError } from "../api";
import { Badge, Card, DangerButton, Empty, Field, StartButton } from "./ui";
import {
  EMPTY_NODE_FORM,
  NodeSocket,
  PNP_KINDS,
  PROBLEM_TEXT,
  applyNodeEvent,
  changeBody,
  countReady,
  formOf,
  formProblems,
  healthText,
  healthTone,
  newBody,
  nodeActions,
  nodeFacts,
  slowWarnings,
} from "../services/pnp";
import type { NodeForm, PnpNode, SocketLike } from "../services/pnp";
import type { TextKey } from "../i18n";

/** Follows the `pnp_node` events of the websocket while the card is shown; tells whether the connection is up. Without a way to open one (a test, an old browser) it does nothing. */
function useNodeEvents(onEvent: (e: { id: string; health: string; ready: boolean }) => void): boolean {
  const { api } = useApp();
  const latest = useRef(onEvent);
  latest.current = onEvent;
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (typeof api.ticket !== "function" || typeof WebSocket === "undefined") return;
    const socket = new NodeSocket(
      {
        ticket: async () => (await api.ticket()).ticket,
        open: (ticket) => new WebSocket(api.eventsUrl(window.location, ticket)) as unknown as SocketLike,
      },
      (e) => latest.current(e),
      setLive,
    );
    socket.start();
    return () => socket.stop();
  }, [api]);
  return live;
}

export function PnpNodesCard({ machines }: { machines: { id: string; name?: string }[] }) {
  const { t, err, say, refreshS } = useApp();
  const sv = useServices();
  const list = usePolled(() => sv.pnp.list(), refreshS);
  const [shown, setShown] = useState<PnpNode[] | null>(null);
  const [form, setForm] = useState<NodeForm | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadRef = useRef(list.reload);
  reloadRef.current = list.reload;

  // what the server listed is shown; an event changes the node it names at once and the list is asked for again a moment later
  useEffect(() => setShown(list.data?.nodes ?? null), [list.data]);
  const live = useNodeEvents((e) => {
    setShown((cur) => (cur ? applyNodeEvent(cur, e) : cur));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => reloadRef.current(), 300);
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const admin = sv.allowed("machines.manage");
  const nodes = shown ?? [];
  const counts = countReady(nodes);
  const slow = slowWarnings(list.data);
  const problems = form ? formProblems(form, editing) : [];

  const fail = (e: unknown) => {
    say(err(e), "error");
    list.reload();
  };
  const poll = async (n: PnpNode) => {
    setBusy(true);
    try {
      const node = await sv.pnp.poll(n.id);
      setShown((cur) => (cur ? cur.map((x) => (x.id === node.id ? node : x)) : cur));
      say(t("pnp_polled", { name: n.name }), "ok");
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const remove = async (n: PnpNode) => {
    try {
      await sv.pnp.remove(n.id);
      say(t("pnp_removed", { name: n.name }), "ok");
      list.reload();
    } catch (e) {
      fail(e);
    }
  };
  const save = async () => {
    if (!form || problems.length > 0) return;
    setBusy(true);
    try {
      if (editing) await sv.pnp.change(form.id, changeBody(form));
      else await sv.pnp.add(newBody(form));
      say(t("pnp_saved", { name: form.name.trim() }), "ok");
      setForm(null);
      list.reload();
    } catch (e) {
      // a node that already exists, a full list or a node that does not fit stay in the form so that the person can correct them
      if (e instanceof ApiError && (e.code === "pnp_node_exists" || e.code === "bad_pnp_node" || e.code === "pnp_nodes_full")) say(err(e), "error");
      else fail(e);
    } finally {
      setBusy(false);
    }
  };
  const set = (change: Partial<NodeForm>) => setForm((f) => (f ? { ...f, ...change } : f));

  return (
    <>
      <Card
        title={t("pnp_title")}
        actions={
          <>
            <Badge tone={live ? "ok" : "dim"}>{live ? t("live_on") : t("live_off")}</Badge>
            <button onClick={list.reload}>{t("act_refresh")}</button>
            {admin && list.data && (
              <button
                onClick={() => {
                  setEditing(false);
                  setForm({ ...EMPTY_NODE_FORM });
                }}
              >
                {t("pnp_add")}
              </button>
            )}
          </>
        }
      >
        <p className="muted">{t("pnp_help")}</p>
        {list.error != null && !list.data ? (
          <Empty>{err(list.error)}</Empty>
        ) : shown === null ? (
          <p className="muted">{t("svc_loading")}</p>
        ) : (
          <>
            <p>
              <strong>{t("pnp_summary", { registered: counts.registered, ready: counts.ready, notReady: counts.notReady })}</strong>
              {list.data?.limits && <small className="muted"> · {t("pnp_limits", { poll: list.data.limits.poll_s, silence: list.data.limits.silence_s, max: list.data.limits.max })}</small>}
            </p>
            {slow.length > 0 && (
              <div className="warn-box" role="alert">
                <strong>{t("pnp_slow_title")}</strong>
                <ul>
                  {slow.map((w) => (
                    <li key={w.node}>
                      {t("pnp_slow_node", { name: nodes.find((n) => n.id === w.node)?.name ?? w.node, poll: w.poll_s, ms: w.link_lost_ms })}
                      {!w.link_lost_declared && <> {t("pnp_slow_assumed")}</>}
                    </li>
                  ))}
                </ul>
                <small>{t("pnp_slow_fix")}</small>
              </div>
            )}
            {nodes.length === 0 ? (
              <Empty>{t("pnp_none")}</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("pnp_name")}</th>
                    <th>{t("pnp_kind")}</th>
                    <th>{t("pnp_machine")}</th>
                    <th>{t("pnp_address")}</th>
                    <th>{t("pnp_health")}</th>
                    <th>{t("pnp_polls")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {nodes.map((n) => {
                    const acts = nodeActions(sv.allowed, n);
                    const key = healthText(n.health);
                    const facts = n.status ? factsLine(n, t) : "";
                    return (
                      <tr key={n.id}>
                        <td>
                          <strong>{n.name}</strong> <small className="muted">{n.id}</small>
                          {!n.enabled && <Badge tone="dim">{t("pnp_health_disabled")}</Badge>}
                        </td>
                        <td>{t(n.kind === "head" ? "pnp_kind_head" : "pnp_kind_feeder")}</td>
                        <td>{n.machine || "-"}</td>
                        <td>
                          <code>{n.address}</code> <small className="muted">{n.token ? t("pnp_token_set") : t("pnp_token_none")}</small>
                        </td>
                        <td>
                          <Badge tone={healthTone(n.health)}>{key ? t(key) : n.health}</Badge>
                          <Badge tone={n.ready ? "ok" : "bad"}>{n.ready ? t("pnp_ready") : t("pnp_not_ready")}</Badge>
                          {n.poll_too_slow === true && <Badge tone="bad">{t("pnp_poll_too_slow")}</Badge>}
                          {n.evidence === "simulator" && <Badge tone="wait">{t("sim_only")}</Badge>}
                          {typeof n.link_lost_ms === "number" && (
                            <small className="muted machine-facts">{t(n.link_lost_declared === true ? "pnp_link_lost" : "pnp_link_lost_assumed", { ms: n.link_lost_ms })}</small>
                          )}
                          {facts && <small className="muted machine-facts">{facts}</small>}
                          {n.last_error && <small className="muted machine-facts">{n.last_error}</small>}
                        </td>
                        <td>
                          {n.polls.ok} / {n.polls.failed}
                        </td>
                        <td>
                          <div className="row-actions">
                            {acts.includes("poll") && (
                              <button disabled={busy} onClick={() => void poll(n)}>
                                {t("pnp_poll")}
                              </button>
                            )}
                            {acts.includes("edit") && (
                              <button
                                disabled={busy}
                                onClick={() => {
                                  setEditing(true);
                                  setForm(formOf(n));
                                }}
                              >
                                {t("act_edit")}
                              </button>
                            )}
                            {acts.includes("remove") && <DangerButton label={t("act_delete")} disabled={busy} onConfirm={() => void remove(n)} />}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}
      </Card>
      {admin && form && (
        <Card title={editing ? t("pnp_edit", { name: form.name || form.id }) : t("pnp_add")}>
          <div className="form-grid">
            <Field label={t("pnp_kind")}>
              <select value={form.kind} disabled={editing} onChange={(e) => set({ kind: e.target.value === "head" ? "head" : "feeder" })}>
                {PNP_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(k === "head" ? "pnp_kind_head" : "pnp_kind_feeder")}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("pnp_id")} hint={t("pnp_id_hint")}>
              <input value={form.id} disabled={editing} maxLength={32} onChange={(e) => set({ id: e.target.value.trim() })} />
            </Field>
            <Field label={t("pnp_name")}>
              <input value={form.name} maxLength={64} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label={t("pnp_address")}>
              <input value={form.address} placeholder="192.168.0.60:80" onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label={t("pnp_token")} hint={editing ? t("pnp_token_keep") : undefined}>
              <input type="password" autoComplete="off" value={form.token} placeholder={editing && nodes.find((n) => n.id === form.id)?.token ? "********" : ""} onChange={(e) => set({ token: e.target.value })} />
            </Field>
            <Field label={t("pnp_machine")}>
              <select value={form.machine} onChange={(e) => set({ machine: e.target.value })}>
                <option value="">{t("pnp_machine_none")}</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
            </Field>
            <label className="check">
              <input type="checkbox" checked={form.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
              {t("pnp_enabled")}
            </label>
          </div>
          {problems.length > 0 && form.name + form.address !== "" && (
            <ul className="error" role="alert">
              {problems.map((p) => (
                <li key={p}>{t(PROBLEM_TEXT[p])}</li>
              ))}
            </ul>
          )}
          <div className="form-actions">
            <StartButton label={t("act_save")} disabled={busy || problems.length > 0} onConfirm={() => void save()} />
            <button disabled={busy} onClick={() => setForm(null)}>
              {t("act_cancel")}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

/** One line of what the node said last, in the words of the language. */
function factsLine(n: PnpNode, t: (key: TextKey, vars?: Record<string, string | number>) => string): string {
  const s = n.status;
  if (!s) return "";
  const parts: string[] = [];
  if (s.safe === true) parts.push(t("pnp_safe"));
  if (typeof s.selfcheck === "string" && s.selfcheck !== "ok") parts.push(t("pnp_selfcheck", { v: s.selfcheck }));
  const f = nodeFacts(n);
  if (f) parts.push(t(f.key, { ...f.vars, pump: f.pump === null ? "-" : f.pump ? t("pnp_on") : t("pnp_off") }));
  return parts.join(" · ");
}
