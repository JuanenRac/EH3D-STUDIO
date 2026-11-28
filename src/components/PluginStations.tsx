/* The page of one of the plugins `pcb`, `laser` or `cad`: its machines with what each says of itself, example requests that fill the form of the queue (nothing is sent from here) and
 * the report of the jobs. The three plugins are simulators and the page says so for each machine. GPL-3.0-or-later. */
import { useState } from "react";
import { useApp } from "../context";
import { useServices } from "../services/context";
import { detailFacts, isSimulatorOnly } from "../services/safety";
import { EXAMPLES, readReport } from "../services/stations";
import type { Report, StationPlugin } from "../services/stations";
import type { WorkJobSummary, WorkMachineInfo } from "../services/types";
import type { TextKey } from "../i18n";
import { Badge, Card, Empty, Field } from "./ui";

const INTRO: Record<StationPlugin, TextKey> = { pcb: "st_pcb_intro", laser: "st_laser_intro", cad: "st_cad_intro" };

export function PluginStations({
  plugin,
  machines,
  jobs,
  onUse,
}: {
  plugin: StationPlugin;
  machines: WorkMachineInfo[];
  jobs: WorkJobSummary[];
  /** Puts the request in the form of the queue, with the machine chosen. */
  onUse: (machine: string, request: string) => void;
}) {
  const { t, err, say } = useApp();
  const sv = useServices();
  const [machine, setMachine] = useState("");
  const [shown, setShown] = useState<{ id: string; report: Report } | null>(null);
  const own = machines.filter((m) => m.plugin === plugin);
  const ownJobs = jobs.filter((j) => j.plugin === plugin);
  const chosen = own.find((m) => m.id === machine)?.id ?? own[0]?.id ?? "";

  const open = async (id: string) => {
    try {
      const job = await sv.work.job(id);
      setShown({ id, report: readReport(job.view) });
    } catch (e) {
      say(err(e), "error");
    }
  };

  return (
    <div className="stack">
      <Card title={t("ov_machines")}>
        <p className="hint">{t(INTRO[plugin])}</p>
        {own.length === 0 ? (
          <Empty>{t("st_none")}</Empty>
        ) : (
          <ul>
            {own.map((m) => (
              <li key={m.id}>
                <strong>{m.name || m.id}</strong> <small className="muted">{m.id}</small>{" "}
                <Badge tone={m.state === "busy" ? "run" : "ok"}>{m.state === "busy" ? t("st_busy") : t("st_idle")}</Badge>
                {isSimulatorOnly(m.detail, m.capabilities) && <Badge tone="wait">{t("sim_only")}</Badge>}
                <small className="muted machine-facts">
                  {detailFacts(m.detail)
                    .map((f) => `${f.key}: ${f.value}`)
                    .join(" · ")}
                </small>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {own.length > 0 && sv.allowed("jobs.prepare") && (
        <Card title={t("wk_new_job")}>
          <p className="hint">{t("st_example_note")}</p>
          <Field label={t("jobs_machine")}>
            <select value={chosen} onChange={(e) => setMachine(e.target.value)}>
              {own.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name || m.id}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-actions">
            {EXAMPLES[plugin].map((e) => (
              <button type="button" key={e.kind} onClick={() => onUse(chosen, JSON.stringify(e.request, null, 2))}>
                {e.kind}
              </button>
            ))}
          </div>
        </Card>
      )}
      <Card title={t("st_reports")}>
        {ownJobs.length === 0 ? (
          <Empty>{t("st_no_jobs")}</Empty>
        ) : (
          <ul>
            {ownJobs.map((j) => (
              <li key={j.id}>
                <code>{j.id}</code> {j.name} <small className="muted">{j.machine}</small>{" "}
                <button type="button" onClick={() => void open(j.id)}>
                  {t("st_view_report")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {shown && (
          <section aria-label={shown.id}>
            <h4>
              <code>{shown.id}</code> {shown.report.verdict && <Badge tone={shown.report.verdict === "pass" ? "ok" : "bad"}>{shown.report.verdict === "pass" ? t("st_pass") : t("st_fail")}</Badge>}
            </h4>
            {shown.report.facts.length === 0 && shown.report.issues.length === 0 ? (
              <Empty>{t("st_no_report")}</Empty>
            ) : (
              <p className="muted">{shown.report.facts.map((f) => `${f.key}: ${f.value}`).join(" · ")}</p>
            )}
            {shown.report.issues.length > 0 && (
              <table className="table">
                <tbody>
                  {shown.report.issues.map((i, n) => (
                    <tr key={n}>
                      <td>{i.severity && <Badge tone={i.severity === "error" ? "bad" : "wait"}>{i.severity}</Badge>}</td>
                      <td>
                        <code>{i.code}</code>
                      </td>
                      <td>{i.item}</td>
                      <td>{i.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </Card>
    </div>
  );
}
