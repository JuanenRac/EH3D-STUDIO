/* The 3D printers the server watches, read only: state, temperatures, progress, time left, layers, alerts and the warnings a person should see. There is not one control
 * here: nothing can be sent to a printer, and the only thing asked of the server is the list (GET). GPL-3.0-or-later. */
import { useEffect, useRef } from "react";
import { useApp, usePolled } from "../context";
import { beep } from "../attention";
import { useServices } from "../services/context";
import { Badge, Card, Empty, Progress } from "./ui";
import { healthKey, healthTone, news, remainingParts, stateKey, stateTone, temperatureText, warningKey, warningsOf } from "../services/printers";
import type { Printer, TemperatureName } from "../services/printers";
import type { TextKey } from "../i18n";

const TEMPERATURE_TEXT: Record<TemperatureName, TextKey> = { nozzle: "pr_nozzle", bed: "pr_bed", chamber: "pr_chamber" };

export function PrintersCard() {
  const { t, err, say, refreshS, alerts } = useApp();
  const sv = useServices();
  const list = usePolled(() => sv.printers.list(), refreshS);
  const before = useRef<Printer[] | null>(null);

  // what appears after the first reading is told at once; what was already wrong when the page opened is in the box of the warnings
  useEffect(() => {
    if (!list.data) return;
    const last = before.current;
    before.current = list.data;
    if (!last) return;
    const { warnings, finished } = news(last, list.data);
    for (const w of warnings) say(`${w.printer}: ${t(warningKey(w.kind), { detail: w.detail })}`, w.serious ? "error" : "ok");
    for (const name of finished) say(`${name}: ${t("pr_finished_now")}`, "ok");
    if (alerts && (finished.length > 0 || warnings.some((w) => w.serious))) beep();
  }, [list.data, alerts, say, t]);

  const printers = list.data;
  const warnings = printers ? warningsOf(printers) : [];

  return (
    <Card title={t("pr_title")} actions={<button onClick={list.reload}>{t("act_refresh")}</button>}>
      <p className="muted">{t("pr_help")}</p>
      {list.error != null && (
        <p className="error" role="alert">
          {printers ? `${t("pr_old")} ` : ""}
          {err(list.error)}
        </p>
      )}
      {printers === null ? (
        list.error == null && <p className="muted">{t("svc_loading")}</p>
      ) : printers.length === 0 ? (
        <Empty>{t("pr_none")}</Empty>
      ) : (
        <>
          {warnings.length > 0 && (
            <ul className="error printer-warnings" role="alert" aria-label={t("pr_warnings")}>
              {warnings.map((w) => (
                <li key={w.key}>
                  <strong>{w.printer}</strong>: {t(warningKey(w.kind), { detail: w.detail })}
                </li>
              ))}
            </ul>
          )}
          <table className="table">
            <thead>
              <tr>
                <th>{t("pr_name")}</th>
                <th>{t("pr_state")}</th>
                <th>{t("pr_temperatures")}</th>
                <th>{t("pr_progress")}</th>
                <th>{t("pr_camera")}</th>
              </tr>
            </thead>
            <tbody>
              {printers.map((p) => (
                <PrinterRow key={p.id} p={p} />
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function PrinterRow({ p }: { p: Printer }) {
  const { t } = useApp();
  const left = p.remainingS === null ? null : remainingParts(p.remainingS);
  return (
    <tr data-printer={p.id}>
      <td>
        <strong>{p.name}</strong> <small className="muted">{p.family === "moonraker" ? "Klipper / Moonraker" : "Bambu Lab LAN"}</small>
        {p.simulated ? <Badge tone="wait">{t("sim_only")}</Badge> : <Badge tone="dim">{t("pr_unvalidated")}</Badge>}
      </td>
      <td>
        <Badge tone={healthTone(p.health)}>{t(healthKey(p.health))}</Badge>
        {p.state && <Badge tone={stateTone(p.state)}>{t(stateKey(p.state))}</Badge>}
        {p.health === "stale" && p.ageS !== null && <small className="muted machine-facts">{t("pr_age", { s: p.ageS })}</small>}
        {p.certificateSeen && <small className="muted machine-facts">{t("pr_certificate", { f: p.certificateSeen })}</small>}
      </td>
      <td>{p.temperatures.length === 0 ? "-" : p.temperatures.map((x) => <div key={x.name}>{`${t(TEMPERATURE_TEXT[x.name])}: ${temperatureText(x)}`}</div>)}</td>
      <td>
        {p.job && <div>{p.job}</div>}
        {p.progress === null ? (
          "-"
        ) : (
          <>
            <Progress percent={p.progress} tone={p.state === "paused" ? "wait" : p.state === "finished" ? "ok" : "run"} />
            <small>{Math.floor(p.progress)} %</small>
          </>
        )}
        {left && (
          <small className="muted machine-facts">
            {left.h > 0 ? t("pr_left_hm", { h: left.h, m: left.m }) : t("pr_left_m", { m: left.m })}
            {p.remainingEstimated ? ` (${t("pr_estimated")})` : ""}
          </small>
        )}
        {p.layers !== null && <small className="muted machine-facts">{t("pr_layers", { layer: p.layer ?? "-", layers: p.layers })}</small>}
      </td>
      <td>{p.camera === null ? "-" : p.camera ? t("pr_camera_yes") : t("pr_camera_no")}</td>
    </tr>
  );
}
