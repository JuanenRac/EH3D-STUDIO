/* The explorer of the project store: the projects of an application, the tree of the files with their versions, the lock, the import and export of the `.eh3dproj` container,
 * and a preview of what a file holds. The tag (`If-Match`) of every write is handled here from the list the person saw; a refusal of 412, 428 or 423 is a warning with a way out. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Dispatch as ReactDispatch } from "react";
import { useApp } from "../context";
import { Badge, Card, DangerButton, Empty, Field } from "../components/ui";
import { explorerReducer, INITIAL_EXPLORER } from "../services/explorer";
import { readPicked, saveBytes, useNowS, whenText } from "../services/format";
import { STUDIO_APP, useFeed, useServices } from "../services/context";
import { affects } from "../services/events";
import { canHide, canUnlock } from "../services/permissions";
import {
  allTags,
  buildTree,
  bytesText,
  clock,
  downloadName,
  filterProjects,
  isConflict,
  joinPath,
  lockIsShort,
  lockView,
  plainName,
  saveFile,
  sortProjects,
  tagsOf,
  totalBytes,
  validFileName,
  visibleRows,
  writeProblem,
} from "../services/store";
import type { ProjectOrder, WriteProblem } from "../services/store";
import type { AppQuota, StoreProject, StoreProjectSummary } from "../services/types";
import { FilePreview } from "../components/FilePreview";
import type { TextKey } from "../i18n";

const ORDERS: ProjectOrder[] = ["updated", "name", "files"];
const FALLBACK_APPS = [STUDIO_APP, "pcb", "cam", "laser", "pnp", "cad", "tool-manager"];

/** The refusals that the person solves by looking again (somebody changed the file, or holds the project); the others are told with the sentence of the refusal. */
const CONFLICT_TEXT: Partial<Record<WriteProblem, TextKey>> = {
  changed: "pj_conflict_changed",
  needs_tag: "pj_conflict_changed",
  locked: "pj_conflict_locked",
};

export function ProjectsPage({ route }: { route: string }) {
  const { t, err, say, session } = useApp();
  const sv = useServices();
  const [apps, setApps] = useState<string[]>(FALLBACK_APPS);
  const routeApp = route.includes("/") ? route.split("/")[0] : "";
  const routeProject = route.includes("/") ? route.split("/").slice(1).join("/") : "";
  const [app, setApp] = useState(routeApp || STUDIO_APP);
  const store = useMemo(() => sv.store(app), [sv, app]);
  const [s, dispatch] = useReducer(explorerReducer, INITIAL_EXPLORER);
  const [newName, setNewName] = useState("");
  const [newBox, setNewBox] = useState<File | null>(null);
  const canRead = sv.allowed("projects.read");
  const canWrite = sv.allowed("projects.write");

  useEffect(() => {
    let alive = true;
    sv.auth.apps().then(
      (r) => alive && r.apps.length > 0 && setApps(r.apps.includes(app) ? r.apps : [app, ...r.apps]),
      () => undefined,
    );
    return () => {
      alive = false;
    };
    // the list of applications is asked once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sv]);

  const loadList = useCallback(async () => {
    dispatch({ type: "projects_load" });
    try {
      const page = await store.list();
      dispatch({ type: "projects_ok", items: page.items, total: page.total });
    } catch (e) {
      dispatch({ type: "projects_fail", error: e });
    }
  }, [store]);

  const loadDetail = useCallback(
    async (id: string) => {
      dispatch({ type: "detail", action: { type: "load" } });
      try {
        dispatch({ type: "detail", action: { type: "ok", data: await store.get(id) } });
      } catch (e) {
        dispatch({ type: "detail", action: { type: "fail", error: e } });
      }
    },
    [store],
  );

  useEffect(() => {
    dispatch({ type: "select", id: null });
    if (canRead) void loadList();
  }, [loadList, canRead]);

  useEffect(() => {
    if (routeProject) dispatch({ type: "select", id: routeProject });
  }, [routeProject]);

  useEffect(() => {
    if (s.selected && canRead) void loadDetail(s.selected);
  }, [s.selected, loadDetail, canRead]);

  // the stream tells when a project changes: the list (and the open project) are asked for again, at most once in a while
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedRef = useRef(s.selected);
  selectedRef.current = s.selected;
  useFeed({
    onEvent: (e) => {
      if (!affects(e, "projects") || (e.app && e.app !== app)) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void loadList();
        if (selectedRef.current && (!e.project || e.project === selectedRef.current)) void loadDetail(selectedRef.current);
      }, 400);
    },
    onResync: () => {
      void loadList();
      if (selectedRef.current) void loadDetail(selectedRef.current);
    },
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const list: StoreProjectSummary[] = useMemo(
    () => sortProjects(filterProjects(s.projects.data ?? [], { query: s.query, tag: s.tag, mine: s.mine, me: session.name }), s.order),
    [s.projects.data, s.query, s.tag, s.mine, s.order, session.name],
  );
  const tags = useMemo(() => allTags(s.projects.data ?? []), [s.projects.data]);

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const p = await store.create(name);
      if (newBox) {
        const r = await store.importContainer(p.id, await readPicked(newBox));
        say(t("pj_imported", { n: r.imported, u: r.unchanged }), "ok");
      } else {
        say(t("up_state_done"), "ok");
      }
      setNewName("");
      setNewBox(null);
      await loadList();
      dispatch({ type: "select", id: p.id });
    } catch (e) {
      say(err(e), "error");
      void loadList();
    }
  };

  if (!canRead) return <Card title={t("nav_projects")}>{<Empty>{t("svc_not_allowed")}</Empty>}</Card>;

  return (
    <div className="split">
      <Card
        title={t("nav_projects")}
        actions={
          <>
            <select aria-label={t("pj_app")} value={app} onChange={(e) => setApp(e.target.value)}>
              {apps.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button onClick={() => void loadList()}>{t("act_refresh")}</button>
          </>
        }
      >
        <div className="filters">
          <label>
            {t("jobs_search")}
            <input type="search" value={s.query} onChange={(e) => dispatch({ type: "query", query: e.target.value })} />
          </label>
          <label>
            {t("jobs_order")}
            <select value={s.order} onChange={(e) => dispatch({ type: "order", order: e.target.value as ProjectOrder })}>
              {ORDERS.map((o) => (
                <option key={o} value={o}>
                  {t(o === "updated" ? "order_newest" : o === "name" ? "order_name" : "pj_order_files")}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={s.mine} onChange={(e) => dispatch({ type: "mine", mine: e.target.checked })} />
            {t("pj_mine")}
          </label>
        </div>
        {tags.length > 0 && (
          <div className="chips" role="group" aria-label={t("pj_tags")}>
            {tags.map((x) => (
              <button key={x.tag} type="button" className={`chip${s.tag === x.tag ? " on" : ""}`} aria-pressed={s.tag === x.tag} onClick={() => dispatch({ type: "tag", tag: x.tag })}>
                #{x.tag} · {x.count}
              </button>
            ))}
          </div>
        )}
        {s.projects.status === "error" && <p className="error">{err(s.projects.error)}</p>}
        {s.projects.status === "loading" && s.projects.data === null && <p className="muted">{t("svc_loading")}</p>}
        {s.projects.status === "ready" && list.length === 0 && <Empty>{t("pj_empty")}</Empty>}
        <ul className="plist" aria-label={t("nav_projects")}>
          {list.map((p) => (
            <li key={p.id}>
              <button type="button" className={`prow${p.id === s.selected ? " on" : ""}`} aria-current={p.id === s.selected} onClick={() => dispatch({ type: "select", id: p.id })}>
                <strong>{plainName(p.name)}</strong>
                <small>
                  {p.owner} · {t("pj_files_n", { n: p.files ?? 0 })} · {whenText(p.updated)}
                </small>
                <span className="prow-marks">
                  {tagsOf(p.name).map((x) => (
                    <Badge key={x} tone="dim">
                      #{x}
                    </Badge>
                  ))}
                  {p.locked && <Badge tone="wait">{t("pj_lock")}</Badge>}
                  {p.deleted && <Badge tone="bad">{t("pj_hidden")}</Badge>}
                </span>
              </button>
            </li>
          ))}
        </ul>
        {canWrite ? (
          <form
            className="new-project"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <h4>{t("pj_new")}</h4>
            <Field label={t("mach_name")}>
              <input value={newName} maxLength={120} onChange={(e) => setNewName(e.target.value)} />
            </Field>
            <Field label={t("pj_from_container")}>
              <input type="file" accept=".eh3dproj,application/zip" onChange={(e) => setNewBox(e.target.files?.[0] ?? null)} />
            </Field>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={newName.trim() === ""}>
                {t("act_create")}
              </button>
            </div>
          </form>
        ) : (
          <p className="hint">{t("svc_read_only")}</p>
        )}
      </Card>
      <div className="stack">
        {s.selected === null ? (
          <Card>
            <Empty>{t("pj_pick")}</Empty>
          </Card>
        ) : s.detail.data === null ? (
          <Card>{s.detail.status === "error" ? <p className="error">{err(s.detail.error)}</p> : <p className="muted">{t("svc_loading")}</p>}</Card>
        ) : (
          <ProjectDetail
            key={s.detail.data.id}
            project={s.detail.data}
            file={s.file}
            conflict={s.conflict}
            collapsed={s.collapsed}
            dispatch={dispatch}
            reload={() => loadDetail(s.detail.data!.id).then(loadList)}
            refreshList={loadList}
            storeApp={app}
          />
        )}
      </div>
    </div>
  );
}

type Dispatch = ReactDispatch<Parameters<typeof explorerReducer>[1]>;

interface Pending {
  name: string;
  bytes: Uint8Array;
  comment: string;
}

function ProjectDetail({
  project,
  file,
  conflict,
  collapsed,
  dispatch,
  reload,
  refreshList,
  storeApp,
}: {
  project: StoreProject;
  file: string | null;
  conflict: { problem: WriteProblem; name: string; detail: string } | null;
  collapsed: string[];
  dispatch: Dispatch;
  reload: () => Promise<void>;
  refreshList: () => Promise<void>;
  storeApp: string;
}) {
  const { t, err, say, session } = useApp();
  const sv = useServices();
  const store = useMemo(() => sv.store(storeApp), [sv, storeApp]);
  const id = project.id;
  const canWrite = sv.allowed("projects.write");
  const who = sv.who;
  const lockedNow = project.lock != null && project.lock.expires * 1000 > Date.now();
  const now = useNowS(lockedNow);
  const lv = lockView(project.lock, session.name, now);
  const blockedByOther = lv.state === "other";
  const tree = useMemo(() => buildTree(project.files), [project.files]);
  const rows = useMemo(() => visibleRows(tree, new Set(collapsed)), [tree, collapsed]);
  const [upName, setUpName] = useState("");
  const [upFolder, setUpFolder] = useState("");
  const [upComment, setUpComment] = useState("");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [rename, setRename] = useState(project.name);
  const [busy, setBusy] = useState(false);
  const pending = useRef<Pending | null>(null);
  // the limits of the store of this application, to show next to what the project uses (a server without the route shows the use alone)
  const [quota, setQuota] = useState<AppQuota | null>(null);
  useEffect(() => {
    let alive = true;
    store.quota().then(
      (q) => alive && setQuota(q),
      () => alive && setQuota(null),
    );
    return () => {
      alive = false;
    };
  }, [store, project.etag]);

  const finalName = joinPath(upFolder, upName || upFile?.name || "");
  const nameOk = validFileName(finalName);

  const run = async (job: () => Promise<void>) => {
    setBusy(true);
    try {
      await job();
    } catch (e) {
      if (isConflict(e)) dispatch({ type: "conflict", notice: { problem: writeProblem(e), name: "", detail: "" } });
      else say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };

  const upload = (bytes: Uint8Array, name: string, comment: string, seen: readonly StoreProject["files"][number][]) =>
    run(async () => {
      const outcome = await saveFile(store, id, name, bytes, seen, comment || undefined);
      if (outcome.kind === "saved") {
        pending.current = null;
        dispatch({ type: "conflict", notice: null });
        say(outcome.result.unchanged ? t("up_current") : t("pj_saved", { v: outcome.result.version }), "ok");
        setUpFile(null);
        setUpName("");
        setUpComment("");
        await reload();
      } else if (outcome.kind === "conflict") {
        pending.current = { name, bytes, comment };
        dispatch({ type: "conflict", notice: { problem: outcome.problem, name, detail: outcome.detail } });
      } else {
        say(err(outcome.error), "error");
      }
    });

  const doUpload = () =>
    run(async () => {
      if (!upFile || !nameOk) return;
      const bytes = await readPicked(upFile);
      await upload(bytes, finalName, upComment, project.files);
    });

  // the person decided to write over what changed: the list is read again and its tag is the one used
  const overwrite = () =>
    run(async () => {
      const p = pending.current;
      if (!p) return;
      const fresh = await store.files(id);
      await upload(p.bytes, p.name, p.comment, fresh);
    });

  const download = (name: string, version?: number) =>
    run(async () => {
      const r = await store.read(id, name, version);
      saveBytes(r.bytes, downloadName(name, version ? `.v${version}` : ""));
    });

  const remove = (name: string, sha: string) =>
    run(async () => {
      try {
        await store.remove(id, name, sha);
        say(t("up_state_done"), "ok");
        if (file === name) dispatch({ type: "file", name: null });
        await reload();
      } catch (e) {
        if (isConflict(e)) dispatch({ type: "conflict", notice: { problem: writeProblem(e), name, detail: "" } });
        else throw e;
      }
    });

  const exportAll = () =>
    run(async () => {
      saveBytes(await store.exportContainer(id), downloadName(project.name, ".eh3dproj"), "application/zip");
    });

  const importInto = (f: File | null) => {
    if (!f) return;
    void run(async () => {
      const r = await store.importContainer(id, await readPicked(f));
      say(t("pj_imported", { n: r.imported, u: r.unchanged }), "ok");
      await reload();
    });
  };

  const takeLock = () =>
    run(async () => {
      await store.lock(id);
      await reload();
    });
  const releaseLock = (force: boolean) =>
    run(async () => {
      await store.unlock(id, force);
      await reload();
    });

  const saveName = () =>
    run(async () => {
      try {
        await store.rename(id, rename.trim(), project.etag);
        say(t("up_state_done"), "ok");
        await reload();
      } catch (e) {
        if (isConflict(e)) dispatch({ type: "conflict", notice: { problem: writeProblem(e), name: project.name, detail: "" } });
        else throw e;
      }
    });

  const hide = () =>
    run(async () => {
      await store.hide(id);
      say(t("up_state_done"), "ok");
      dispatch({ type: "select", id: null });
      await refreshList();
    });
  const purge = () =>
    run(async () => {
      await store.purge(id);
      say(t("up_state_done"), "ok");
      dispatch({ type: "select", id: null });
      await refreshList();
    });

  const bytes = project.bytes ?? totalBytes(project.files);
  const writeBlocked = !canWrite || busy;

  return (
    <>
      <Card
        title={plainName(project.name)}
        actions={
          <>
            <button disabled={busy} onClick={() => void reload()}>
              {t("act_refresh")}
            </button>
            <button disabled={busy || project.files.length === 0} onClick={() => void exportAll()}>
              {t("mach_export")} .eh3dproj
            </button>
          </>
        }
      >
        <dl className="facts">
          <dt>{t("acc_name")}</dt>
          <dd>
            {project.name} {project.deleted && <Badge tone="bad">{t("pj_hidden")}</Badge>}
          </dd>
          <dt>{t("pj_owner")}</dt>
          <dd>{project.owner}</dd>
          <dt>{t("job_created")}</dt>
          <dd>{whenText(project.created)}</dd>
          <dt>{t("pj_updated")}</dt>
          <dd>{whenText(project.updated)}</dd>
          <dt>{t("pj_quota")}</dt>
          <dd>
            {bytesText(bytes)}
            {quota && ` / ${bytesText(quota.limits.project_max_mb * 1024 * 1024)}`} · {t("pj_files_n", { n: project.files.length })}
            {quota && ` / ${quota.limits.project_max_files}`}
          </dd>
        </dl>
        {canWrite && (
          <div className="form-grid">
            <Field label={t("mach_name")}>
              <input value={rename} maxLength={120} onChange={(e) => setRename(e.target.value)} />
            </Field>
            <div className="form-actions align-end">
              <button disabled={writeBlocked || rename.trim() === "" || rename.trim() === project.name || blockedByOther} onClick={() => void saveName()}>
                {t("act_save")}
              </button>
              {canHide(who, session.name, project.owner) && !project.deleted && <DangerButton label={t("pj_hide")} disabled={busy || blockedByOther} onConfirm={() => void hide()} />}
              {project.deleted && sv.allowed("projects.purge") && <DangerButton label={t("pj_purge")} disabled={busy} onConfirm={() => void purge()} />}
            </div>
          </div>
        )}
        <LockBar
          project={project}
          view={lv}
          now={now}
          canLock={sv.allowed("projects.lock")}
          canRelease={project.lock ? canUnlock(who, session.name, project.lock.holder) : false}
          canForce={sv.allowed("projects.force_unlock")}
          busy={busy}
          onTake={() => void takeLock()}
          onRelease={(force) => void releaseLock(force)}
        />
      </Card>

      {conflict && (
        <div className="warn-box" role="alert">
          <strong>{conflict.name ? `${conflict.name}: ` : ""}</strong>
          {CONFLICT_TEXT[conflict.problem] ? t(CONFLICT_TEXT[conflict.problem]!) : null}
          {conflict.problem === "locked" && project.lock ? ` ${t("pj_lock_by", { who: project.lock.holder })}` : null}
          <div className="form-actions">
            <button onClick={() => void reload()}>{t("pj_conflict_reload")}</button>
            {pending.current && canWrite && conflict.problem !== "locked" && (
              <DangerButton label={t("pj_conflict_overwrite")} onConfirm={() => void overwrite()} />
            )}
            <button onClick={() => dispatch({ type: "conflict", notice: null })}>{t("act_close")}</button>
          </div>
        </div>
      )}

      <Card title={t("prep_files")} wide>
        {project.files.length === 0 ? (
          <Empty>{t("pj_no_files")}</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("pj_file")}</th>
                <th>{t("pj_version")}</th>
                <th>{t("pj_size")}</th>
                <th>SHA-256</th>
                <th>{t("jobs_by")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => (
                <tr key={`${n.folder ? "d" : "f"}:${n.path}`} className={n.file && n.path === file ? "on" : ""}>
                  <td style={{ paddingLeft: `${10 + n.depth * 18}px` }}>
                    {n.folder ? (
                      <button type="button" className="link" aria-expanded={!collapsed.includes(n.path)} onClick={() => dispatch({ type: "toggle_folder", path: n.path })}>
                        {collapsed.includes(n.path) ? "▸" : "▾"} {n.name}/
                      </button>
                    ) : (
                      <button type="button" className="link" aria-pressed={n.path === file} onClick={() => dispatch({ type: "file", name: n.path === file ? null : n.path })}>
                        {n.name}
                      </button>
                    )}
                  </td>
                  <td>{n.file ? `v${n.file.version}` : t("pj_files_n", { n: n.count })}</td>
                  <td>{bytesText(n.size)}</td>
                  <td>{n.file ? <code title={n.file.sha256}>{n.file.sha256.slice(0, 12)}</code> : ""}</td>
                  <td>{n.file?.by ?? ""}</td>
                  <td>
                    {n.file && (
                      <div className="row-actions">
                        <button disabled={busy} onClick={() => void download(n.path)}>
                          {t("act_download")}
                        </button>
                        {canWrite && <DangerButton label={t("act_delete")} disabled={busy || blockedByOther} onConfirm={() => void remove(n.path, n.file!.sha256)} />}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {canWrite ? (
          <form
            className="upload"
            onSubmit={(e) => {
              e.preventDefault();
              void doUpload();
            }}
          >
            <h4>{t("pj_upload")}</h4>
            <div className="form-grid">
              <Field label={t("pj_file")}>
                <input
                  type="file"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setUpFile(f);
                    if (f) setUpName(f.name);
                  }}
                />
              </Field>
              <Field label={t("pj_folder")}>
                <input value={upFolder} onChange={(e) => setUpFolder(e.target.value)} />
              </Field>
              <Field label={t("acc_name")}>
                <input value={upName} aria-invalid={finalName !== "" && !nameOk} onChange={(e) => setUpName(e.target.value)} />
              </Field>
              <Field label={t("pj_comment")}>
                <input value={upComment} maxLength={200} onChange={(e) => setUpComment(e.target.value)} />
              </Field>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit" disabled={writeBlocked || !upFile || !nameOk || blockedByOther}>
                {t("act_upload")}
              </button>
              <label className="button">
                {t("mach_import")} .eh3dproj
                <input type="file" hidden accept=".eh3dproj,application/zip" disabled={writeBlocked || blockedByOther} onChange={(e) => importInto(e.target.files?.[0] ?? null)} />
              </label>
            </div>
          </form>
        ) : (
          <p className="hint">{t("svc_read_only")}</p>
        )}
      </Card>

      {file && <FilePreview store={store} projectId={id} file={project.files.find((f) => f.name === file) ?? null} onClose={() => dispatch({ type: "file", name: null })} onDownload={download} />}
    </>
  );
}

function LockBar({
  project,
  view,
  now,
  canLock,
  canRelease,
  canForce,
  busy,
  onTake,
  onRelease,
}: {
  project: StoreProject;
  view: ReturnType<typeof lockView>;
  now: number;
  canLock: boolean;
  canRelease: boolean;
  canForce: boolean;
  busy: boolean;
  onTake: () => void;
  onRelease: (force: boolean) => void;
}) {
  const { t } = useApp();
  return (
    <div className="lockbar" role="status">
      <strong>{t("pj_lock")}</strong>{" "}
      {view.state === "free" ? (
        <span className="muted">{t("pj_lock_free")}</span>
      ) : (
        <>
          <Badge tone={view.state === "mine" ? "ok" : "wait"}>{view.state === "mine" ? t("acc_you") : t("pj_lock_by", { who: view.holder })}</Badge>{" "}
          <span className={project.lock && lockIsShort(project.lock, now) ? "warn" : ""}>{t("pj_lock_left", { time: clock(view.remainingS) })}</span>
        </>
      )}
      <span className="lock-actions">
        {canLock && view.state !== "other" && (
          <button disabled={busy} onClick={onTake}>
            {view.state === "mine" ? t("pj_lock_renew") : t("pj_lock_take")}
          </button>
        )}
        {view.state === "mine" && canRelease && (
          <button disabled={busy} onClick={() => onRelease(false)}>
            {t("pj_lock_release")}
          </button>
        )}
        {view.state === "other" && canForce && <DangerButton label={t("pj_lock_force")} disabled={busy} onConfirm={() => onRelease(true)} />}
      </span>
    </div>
  );
}
