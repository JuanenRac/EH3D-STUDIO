/* Design and factory: the reports that the design tools (EH3D-PHOENIX-PCB: check, connectivity, bill of materials, fabrication package and panel) left as JSON files in a project of the
 * store, read as tables with the severity said in words and in a mark as well as in a colour. Running the checks on the server is not possible yet: the buttons are there, off,
 * and the page says which routes the server would need (docs/DESIGN_FACTORY_CONTRACT_NEEDS.md). */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../context";
import { Badge, Card, Empty } from "../components/ui";
import { copyText } from "../clipboard";
import { useServices } from "../services/context";
import {
  DESIGN_KINDS,
  DESIGN_RUN_AVAILABLE,
  SEVERITIES,
  SEVERITY_MARK,
  coordinates,
  countBySeverity,
  filterFindings,
  locations,
  parseReportText,
  reportCandidates,
} from "../services/design";
import type { Finding, Report, Severity } from "../services/design";
import { bytesText } from "../services/store";
import type { StoreProjectSummary } from "../services/types";
import type { TextKey } from "../i18n";

const DESIGN_APPS = ["pcb", "cam", "laser", "pnp", "cad"];

interface Found {
  file: string;
  report: Report;
}

export function FactoryPage() {
  const { t, err } = useApp();
  const sv = useServices();
  const [app, setApp] = useState(DESIGN_APPS[0]);
  const store = useMemo(() => sv.store(app), [sv, app]);
  const [projects, setProjects] = useState<StoreProjectSummary[] | null>(null);
  const [projectsError, setProjectsError] = useState<unknown>(null);
  const [project, setProject] = useState("");
  const [reports, setReports] = useState<Found[] | null>(null);
  const [scanError, setScanError] = useState<unknown>(null);
  const [file, setFile] = useState("");
  const canRead = sv.allowed("projects.read");

  useEffect(() => {
    setProject("");
    setProjects(null);
    setProjectsError(null);
    if (!canRead) return;
    let alive = true;
    store.list().then(
      (p) => alive && setProjects(p.items),
      (e) => alive && setProjectsError(e),
    );
    return () => {
      alive = false;
    };
  }, [store, canRead]);

  const scan = useCallback(async () => {
    setReports(null);
    setScanError(null);
    setFile("");
    if (!project) return;
    try {
      const files = await store.files(project);
      const names = reportCandidates(files);
      const found: Found[] = [];
      for (const name of names) {
        const r = await store.read(project, name, undefined, 2 * 1024 * 1024);
        const report = parseReportText(new TextDecoder().decode(r.bytes));
        if (report) found.push({ file: name, report });
      }
      setReports(found);
      setFile(found[0]?.file ?? "");
    } catch (e) {
      setScanError(e);
      setReports([]);
    }
  }, [store, project]);

  useEffect(() => {
    void scan();
  }, [scan]);

  if (!canRead) return <Card title={t("nav_factory")}>{<Empty>{t("svc_not_allowed")}</Empty>}</Card>;
  const shown = reports?.find((r) => r.file === file) ?? null;

  return (
    <div className="stack">
      <Card title={t("fx_run")} wide>
        <p className="hint">{t("fx_run_hint")}</p>
        <div className="form-actions">
          {DESIGN_KINDS.map((k) => (
            <button key={k} disabled={!DESIGN_RUN_AVAILABLE || !project} title={t("svc_unavailable")}>
              {t(`fx_rk_${k}` as TextKey)}
            </button>
          ))}
          <Badge tone="dim">{t("svc_unavailable")}</Badge>
        </div>
      </Card>

      <Card title={t("fx_reports")} wide actions={<button onClick={() => void scan()}>{t("act_refresh")}</button>}>
        <div className="filters">
          <label>
            {t("pj_app")}
            <select value={app} onChange={(e) => setApp(e.target.value)}>
              {DESIGN_APPS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("nav_projects")}
            <select value={project} onChange={(e) => setProject(e.target.value)}>
              <option value="">-</option>
              {(projects ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          {reports && reports.length > 0 && (
            <label>
              {t("fx_reports")}
              <select value={file} onChange={(e) => setFile(e.target.value)}>
                {reports.map((r) => (
                  <option key={r.file} value={r.file}>
                    {r.file} · {t(`fx_rk_${r.report.kind}` as TextKey)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {projectsError != null && <p className="error">{err(projectsError)}</p>}
        {scanError != null && <p className="error">{err(scanError)}</p>}
        {projects !== null && projects.length === 0 && <Empty>{t("pj_empty")}</Empty>}
        {project && reports === null && <p className="muted">{t("svc_loading")}</p>}
        {project && reports !== null && reports.length === 0 && scanError == null && <Empty>{t("fx_none")}</Empty>}
      </Card>

      {shown && <ReportView key={shown.file} found={shown} />}
    </div>
  );
}

function SeverityBadge({ s }: { s: Severity }) {
  const { t } = useApp();
  return (
    <span className={`sev sev-${s}`}>
      <span aria-hidden="true">{SEVERITY_MARK[s]}</span> {t(`fx_sev_${s}` as TextKey)}
    </span>
  );
}

function ReportView({ found }: { found: Found }) {
  const { t } = useApp();
  const r = found.report;
  return (
    <Card title={`${found.file} · ${t(`fx_rk_${r.kind}` as TextKey)}`} wide>
      {(r.kind === "check" || r.kind === "connectivity") && <CheckView r={r} />}
      {r.kind === "bom" && <BomView r={r} />}
      {r.kind === "assembly_bom" && (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>{t("fx_face")}</th>
                <th>{t("fx_parts_board")}</th>
                <th>{t("fx_parts_panel")}</th>
                <th>{t("fx_not_fitted")}</th>
              </tr>
            </thead>
            <tbody>
              {r.faces.map((f) => (
                <tr key={f.face}>
                  <td>{f.face}</td>
                  <td>{f.partsBoard}</td>
                  <td>{f.partsPanel}</td>
                  <td>{f.notFitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <FindingsTable findings={r.faces.flatMap((f) => f.findings)} />
        </>
      )}
      {r.kind === "fabpack" && (
        <>
          <dl className="facts">
            <dt>{t("fx_board")}</dt>
            <dd>{r.board || "-"}</dd>
            <dt>{t("fx_profile")}</dt>
            <dd>{r.profile || "-"}</dd>
          </dl>
          <table className="table">
            <thead>
              <tr>
                <th>{t("pj_file")}</th>
                <th>{t("pj_size")}</th>
                <th>SHA-256</th>
              </tr>
            </thead>
            <tbody>
              {r.files.map((f) => (
                <tr key={f.path}>
                  <td>{f.path}</td>
                  <td>{bytesText(f.bytes)}</td>
                  <td>
                    <code title={f.sha256}>{f.sha256.slice(0, 16)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.notes.length > 0 && (
            <ul>
              {r.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}
      {r.kind === "panel" && (
        <>
          <dl className="facts">
            <dt>{t("fx_panel_size")}</dt>
            <dd>
              {r.widthMm} × {r.heightMm} mm
            </dd>
            <dt>{t("fx_panel_grid")}</dt>
            <dd>
              {r.columns} × {r.rows} ({r.copies})
            </dd>
          </dl>
          {r.notes.length > 0 && (
            <ul>
              {r.notes.map((n, i) => (
                <li key={i}>
                  <code>{n.code}</code> {n.detail}
                </li>
              ))}
            </ul>
          )}
          {r.files.length > 0 && <p className="hint">{r.files.join(", ")}</p>}
        </>
      )}
    </Card>
  );
}

function CheckView({ r }: { r: Extract<Report, { kind: "check" | "connectivity" }> }) {
  const { t } = useApp();
  const count = countBySeverity(r.confirmed);
  return (
    <>
      <p role="status">
        {r.passes ? <Badge tone="ok">✔ {t("fx_passes")}</Badge> : <Badge tone="bad">✖ {t("fx_fails")}</Badge>} · {SEVERITIES.map((s) => `${t(`fx_sev_${s}` as TextKey)}: ${count[s]}`).join(" · ")} · {t("fx_inconclusive")}: {r.inconclusive.length}
      </p>
      <h4>{t("fx_confirmed")}</h4>
      <FindingsTable findings={r.confirmed} />
      {r.inconclusive.length > 0 && (
        <>
          <h4>{t("fx_inconclusive")}</h4>
          <FindingsTable findings={r.inconclusive} />
        </>
      )}
    </>
  );
}

function FindingsTable({ findings }: { findings: Finding[] }) {
  const { t, say } = useApp();
  const [severity, setSeverity] = useState<Severity | "">("");
  const [text, setText] = useState("");
  const [place, setPlace] = useState("");
  const shown = useMemo(() => filterFindings(findings, { severity, text, location: place }), [findings, severity, text, place]);
  const places = useMemo(() => locations(findings).slice(0, 12), [findings]);
  if (findings.length === 0) return <Empty>{t("fx_nothing")}</Empty>;
  return (
    <>
      <div className="filters">
        <label>
          {t("fx_severity")}
          <select value={severity} onChange={(e) => setSeverity(e.target.value as Severity | "")}>
            <option value="">{t("jobs_all")}</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {t(`fx_sev_${s}` as TextKey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("jobs_search")}
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} />
        </label>
        {place && (
          <button type="button" className="chip on" onClick={() => setPlace("")}>
            {place} ✕
          </button>
        )}
      </div>
      {!place && places.length > 1 && (
        <div className="chips" role="group" aria-label={t("fx_object")}>
          {places.map((p) => (
            <button key={p.location} type="button" className="chip" onClick={() => setPlace(p.location)}>
              {p.location} · {p.count}
            </button>
          ))}
        </div>
      )}
      <table className="table">
        <thead>
          <tr>
            <th>{t("fx_severity")}</th>
            <th>{t("fx_code")}</th>
            <th>{t("fx_object")}</th>
            <th>{t("fx_where")}</th>
            <th>{t("fx_detail")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((f, i) => {
            const at = coordinates(f);
            return (
              <tr key={i}>
                <td>
                  <SeverityBadge s={f.severity} />
                </td>
                <td>
                  <code>{f.code}</code>
                </td>
                <td>
                  {f.location ? (
                    <button type="button" className="link" onClick={() => setPlace(f.location)}>
                      {f.location}
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {at ? (
                    <button type="button" className="link" onClick={() => void copyText(at).then((ok) => ok && say(t("act_copied"), "ok"))} title={t("act_copy")}>
                      {at} mm
                    </button>
                  ) : (
                    "-"
                  )}
                </td>
                <td>
                  {f.measuredMm !== undefined && f.limitMm !== undefined ? `${f.measuredMm} / ${f.limitMm} mm ` : ""}
                  {f.detail}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function BomView({ r }: { r: Extract<Report, { kind: "bom" }> }) {
  const { t } = useApp();
  return (
    <>
      <p role="status">
        {r.complete ? <Badge tone="ok">✔ {t("fx_complete")}</Badge> : <Badge tone="wait">▲ {t("fx_incomplete")}</Badge>} · {t("prep_copies")}: {r.boards} · {t("fx_waste")}: {r.wastePercent}% · {r.currency}
      </p>
      <table className="table">
        <thead>
          <tr>
            <th>{t("fx_refs")}</th>
            <th>#</th>
            <th>{t("fx_value")}</th>
            <th>{t("fx_footprint")}</th>
            <th>{t("fx_mpn")}</th>
            <th>{t("fx_supplier")}</th>
            <th>{t("fx_cost")}</th>
            <th>{t("up_status")}</th>
          </tr>
        </thead>
        <tbody>
          {r.lines.map((l, i) => (
            <tr key={i}>
              <td>{l.references.join(", ")}</td>
              <td>{l.quantity}</td>
              <td>{l.value}</td>
              <td>{l.footprint}</td>
              <td>{[l.manufacturer, l.mpn].filter(Boolean).join(" ")}</td>
              <td>{l.supplier || "-"}</td>
              <td>{l.costBatch ? `${l.costBatch} ${r.currency}` : "-"}</td>
              <td>{l.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.totals.length > 0 && (
        <dl className="facts">
          {r.totals.map(([k, v]) => (
            <div key={k} className="contents">
              <dt>{t(`fx_tot_${k}` as TextKey)}</dt>
              <dd>
                {v} {r.currency}
              </dd>
            </div>
          ))}
        </dl>
      )}
      <FindingsTable findings={r.findings} />
    </>
  );
}

