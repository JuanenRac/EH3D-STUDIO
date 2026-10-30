/* Prepare a job: pick the machine, give the work (the files the programs read, or the holes typed by hand), look at the plan and the time it will take, and keep it
 * ready. The job never starts by itself: it is started from the list of jobs or from its own page. */
import { useMemo, useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, Empty, Field } from "../components/ui";
import { PlanDownload, PlanView } from "../components/PlanView";
import { copyNames, defaultDrillTool, drillRequest, fileRequest, fileSlot, kindOfFiles, nameFromFile, parseHoles, toolColour, toolsUsed } from "../jobtools";
import type { DrillToolInput, SourceFiles } from "../jobtools";
import { duration } from "../model";
import type { JobView } from "../types";

type Source = "files" | "typed";

export function PreparePage({ machineId = "" }: { machineId?: string }) {
  const { api, t, err, say } = useApp();
  const machines = usePolled(() => api.machines(), 0);
  const [machine, setMachine] = useState(machineId);
  const [copies, setCopies] = useState(1);
  const [source, setSource] = useState<Source>("files");
  const [name, setName] = useState("");
  const [files, setFiles] = useState<SourceFiles>({});
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [sorting, setSorting] = useState("");
  const [boardMm, setBoardMm] = useState(1.6);
  const [typed, setTyped] = useState("");
  const [tools, setTools] = useState<Record<number, DrillToolInput>>({});
  const [view, setView] = useState<JobView | null>(null);
  const [busy, setBusy] = useState(false);

  const list = machines.data ?? [];
  const chosen = machine || list[0]?.id || "";
  const parsed = useMemo(() => parseHoles(typed), [typed]);
  const used = toolsUsed(parsed.holes);

  const readFiles = async (picked: FileList | null) => {
    if (!picked) return;
    const next: SourceFiles = {};
    const names: string[] = [];
    for (const f of Array.from(picked)) {
      const slot = fileSlot(f.name);
      if (!slot) continue;
      next[slot] = await f.text();
      names.push(f.name);
      if (!name && (slot === "ncd" || slot === "plt")) setName(nameFromFile(f.name));
    }
    setFiles(next);
    setFileNames(names);
    setView(null);
  };

  const request = () => {
    if (source === "files") {
      const kind = kindOfFiles(files);
      return kind ? fileRequest(kind, name.trim() || "job", files, sorting) : null;
    }
    if (parsed.holes.length === 0 || parsed.bad.length > 0) return null;
    return drillRequest(
      name.trim() || "job",
      boardMm,
      used.map((n) => tools[n] ?? defaultDrillTool(n)),
      parsed.holes,
    );
  };
  const body = request();
  const setTool = (n: number, patch: Partial<DrillToolInput>) => {
    setTools((old) => ({ ...old, [n]: { ...(old[n] ?? defaultDrillTool(n)), ...patch } }));
    setView(null);
  };

  const preview = async () => {
    if (!body || !chosen) return;
    setBusy(true);
    try {
      setView(await api.previewJob(chosen, body));
    } catch (e) {
      setView(null);
      say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!body || !chosen) return;
    setBusy(true);
    try {
      let first: { id?: string } | null = null;
      for (const copy of copyNames(String(body.name), copies)) {
        const job = await api.createJob(chosen, { ...body, name: copy });
        first = first ?? job;
      }
      say(copies > 1 ? t("prep_created_n", { n: copies }) : t("prep_created"), "ok");
      window.location.hash = copies === 1 && first?.id ? `#/job/${first.id}` : "#/jobs";
    } catch (e) {
      say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };

  if (machines.data && list.length === 0) return <Empty>{t("fleet_empty")}</Empty>;
  return (
    <div className="stack">
      <Card title={t("nav_prepare")} wide>
        <p className="hint">{t("prep_help")}</p>
        <div className="form-grid">
          <Field label={t("jobs_machine")}>
            <select
              value={chosen}
              onChange={(e) => {
                setMachine(e.target.value);
                setView(null);
              }}
            >
              {list.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("prep_name")}>
            <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label={t("prep_source")}>
            <select
              value={source}
              onChange={(e) => {
                setSource(e.target.value as Source);
                setView(null);
              }}
            >
              <option value="files">{t("prep_from_files")}</option>
              <option value="typed">{t("prep_from_typed")}</option>
            </select>
          </Field>
        </div>

        {source === "files" ? (
          <div className="form-grid">
            <Field label={t("prep_files")} hint={t("prep_files_hint")}>
              <input type="file" multiple accept=".ncd,.dtd,.plt,.rtd,.NCD,.DTD,.PLT,.RTD" onChange={(e) => void readFiles(e.target.files)} />
            </Field>
            {kindOfFiles(files) === "drill" && (
              <Field label={t("prep_sorting")} hint={t("prep_sorting_hint")}>
                <select value={sorting} onChange={(e) => setSorting(e.target.value)}>
                  <option value="">{t("prep_sorting_machine")}</option>
                  {["none", "x", "y", "special"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {fileNames.length > 0 && (
              <p className="hint">
                {fileNames.map((n) => (
                  <Badge key={n} tone="dim">
                    {n}
                  </Badge>
                ))}
              </p>
            )}
          </div>
        ) : (
          <>
            <div className="form-grid">
              <Field label={t("prep_board")} hint={t("prep_board_hint")}>
                <input type="number" min={0.1} max={20} step={0.1} value={boardMm} onChange={(e) => setBoardMm(Number(e.target.value))} />
              </Field>
            </div>
            <Field label={t("prep_holes")} hint={t("prep_holes_hint")}>
              <textarea
                rows={8}
                spellCheck={false}
                value={typed}
                placeholder={"1  10.0  10.0\n1  30.0  10.0\n2  20.0  20.0"}
                onChange={(e) => {
                  setTyped(e.target.value);
                  setView(null);
                }}
              />
            </Field>
            {parsed.bad.length > 0 && <p className="error">{t("prep_bad_lines", { lines: parsed.bad.slice(0, 8).join(", ") })}</p>}
            {used.length > 0 && (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("prep_tool")}</th>
                    <th>{t("prep_holes_n")}</th>
                    <th>{t("prep_feed")}</th>
                    <th>{t("prep_rpm")}</th>
                    <th>{t("prep_extra")}</th>
                  </tr>
                </thead>
                <tbody>
                  {used.map((n) => {
                    const tl = tools[n] ?? defaultDrillTool(n);
                    return (
                      <tr key={n}>
                        <td>
                          <i className="swatch" style={{ background: toolColour(n) }} /> T{n}
                        </td>
                        <td>{parsed.holes.filter((h) => h.tool === n).length}</td>
                        <td>
                          <input type="number" min={1} value={tl.feed_mm_min} onChange={(e) => setTool(n, { feed_mm_min: Number(e.target.value) })} />
                        </td>
                        <td>
                          <input type="number" min={0} step={500} value={tl.spindle_rpm} onChange={(e) => setTool(n, { spindle_rpm: Number(e.target.value) })} />
                        </td>
                        <td>
                          <input type="number" min={0} max={5} step={0.1} value={tl.extra_stroke_mm} onChange={(e) => setTool(n, { extra_stroke_mm: Number(e.target.value) })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        <div className="form-grid">
          <Field label={t("prep_copies")} hint={t("prep_copies_hint")}>
            <input type="number" min={1} max={50} value={copies} onChange={(e) => setCopies(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
          </Field>
        </div>
        <div className="form-actions">
          <button disabled={!body || busy || !chosen} onClick={() => void preview()}>
            {t("prep_preview")}
          </button>
          <button className="primary" disabled={!body || busy || !chosen} onClick={() => void create()}>
            {t("prep_keep")}
          </button>
        </div>
      </Card>

      {view && (
        <Card title={t("prep_plan")} wide>
          <div className="plan-grid">
            <div>
              <PlanView view={view} label={t("prep_plan")} />
              <PlanDownload name={name.trim() || "plan"} />
            </div>
            <div>
              <dl className="facts">
                <dt>{t("jobs_estimate")}</dt>
                <dd>{duration(view.estimate_s)}</dd>
                <dt>{t("prep_travel")}</dt>
                <dd>{view.travel_mm != null ? `${(view.travel_mm / 1000).toFixed(2)} m` : "-"}</dd>
                <dt>{t("prep_holes_n")}</dt>
                <dd>{view.holes.length}</dd>
                <dt>{t("prep_size")}</dt>
                <dd>{view.bounds_mm ? `${(view.bounds_mm[2] - view.bounds_mm[0]).toFixed(1)} x ${(view.bounds_mm[3] - view.bounds_mm[1]).toFixed(1)} mm` : "-"}</dd>
              </dl>
              <ToolTable view={view} />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export function ToolTable({ view }: { view: JobView }) {
  const { t } = useApp();
  if (view.tools.length === 0) return null;
  return (
    <table className="table">
      <thead>
        <tr>
          <th>{t("prep_tool")}</th>
          <th>{t("prep_holes_n")}</th>
          <th>{t("prep_feed")}</th>
          <th>{t("prep_rpm")}</th>
        </tr>
      </thead>
      <tbody>
        {view.tools.map((tl) => (
          <tr key={tl.number}>
            <td>
              <i className="swatch" style={{ background: toolColour(tl.number) }} /> T{tl.number}
            </td>
            <td>{tl.count}</td>
            <td>{tl.feed_mm_min ?? "-"}</td>
            <td>{tl.spindle_rpm ?? "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
