/* The places of the tools in the bar of the tool changer: the table tool -> place of the `rack` of the second version of the request. A tool with no place, a place shared by two
 * tools and a place the machine does not define are warned about, as in BUNGARD-GUI, and the other refusals of the server are found before the request goes out. */
import { useMemo, useState } from "react";
import { useApp } from "../context";
import { Card, Field } from "./ui";
import { DEFAULT_RACK, MAX_PLACE, buildRack, carryAssignment, checkSlots, fillInOrder, parseTools, selectable, withRack } from "../services/atc";
import type { Assignment, Problem, RackOptions } from "../services/atc";
import type { TextKey } from "../i18n";

type Vars = Record<string, string | number>;

export function problemText(p: Problem): [TextKey, Vars] {
  switch (p.kind) {
    case "unassigned":
      return ["atc_p_unassigned", { tool: p.tool }];
    case "undefined":
      return ["atc_p_undefined", { tool: p.tool, place: p.place }];
    case "shared":
      return ["atc_p_shared", { place: p.place, tools: p.tools.join(", ") }];
    case "test_pin":
    case "carry_pin":
      return ["atc_p_pin", {}];
    case "carry_without_in":
    case "carry_in_needs_first":
      return ["atc_p_carry", {}];
    case "carry_place_taken":
      return ["atc_p_taken", { place: p.place }];
    case "first_too_high":
    case "too_many_tools":
      return ["atc_p_max", { max: p.max }];
  }
}

export function AtcEditor({ request, onRequest, canEdit }: { request: string; onRequest: (text: string) => void; canEdit: boolean }) {
  const { t } = useApp();
  const [toolsText, setToolsText] = useState("1 2 3");
  const [assign, setAssign] = useState<Assignment>({});
  const [options, setOptions] = useState<RackOptions>(DEFAULT_RACK);

  const tools = useMemo(() => parseTools(toolsText), [toolsText]);
  const defined: number[] | undefined = undefined;
  const list = useMemo(() => tools ?? [], [tools]);
  const mine = useMemo(() => carryAssignment(list, assign), [list, assign]);
  const problems = useMemo(() => (tools ? checkSlots(list, mine, defined, options) : []), [tools, list, mine, defined, options]);
  const places = selectable(defined);
  const rack = useMemo(() => buildRack(list, mine, options), [list, mine, options]);

  const set = (tool: number, place: number | null) => setAssign({ ...mine, [tool]: place });
  const useIn = () => {
    let base: Record<string, unknown> = {};
    try {
      const v: unknown = JSON.parse(request);
      if (typeof v === "object" && v !== null && !Array.isArray(v)) base = v as Record<string, unknown>;
    } catch {
      base = {};
    }
    onRequest(JSON.stringify(withRack(base, rack), null, 2));
  };

  return (
    <Card title={t("atc_title")} wide>
      <div className="form-grid">
        <Field label={t("atc_tools")} hint={tools === null ? t("atc_tools_bad") : undefined}>
          <input value={toolsText} aria-invalid={tools === null} onChange={(e) => setToolsText(e.target.value)} />
        </Field>
        <Field label={t("atc_first")}>
          <input type="number" min={0} max={MAX_PLACE} value={options.first} onChange={(e) => setOptions({ ...options, first: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} />
        </Field>
        <Field label={t("atc_carry_slot")}>
          <input
            type="number"
            min={0}
            max={MAX_PLACE}
            value={options.carrySlot ?? ""}
            onChange={(e) => setOptions({ ...options, carrySlot: e.target.value === "" ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)) })}
          />
        </Field>
      </div>
      <div className="form-actions">
        <label className="check">
          <input type="checkbox" checked={options.carryIn} onChange={(e) => setOptions({ ...options, carryIn: e.target.checked })} />
          {t("atc_carry_in")}
        </label>
        <label className="check">
          <input type="checkbox" checked={options.carryOut} onChange={(e) => setOptions({ ...options, carryOut: e.target.checked })} />
          {t("atc_carry_out")}
        </label>
      </div>
      {list.length === 0 ? null : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("prep_tool")}</th>
              <th>{t("atc_place")}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((tool) => {
              const mineProblems = problems.filter((p) => ("tool" in p && p.tool === tool) || (p.kind === "shared" && p.tools.includes(tool)));
              return (
                <tr key={tool}>
                  <td>T{tool}</td>
                  <td>
                    <select aria-label={`${t("atc_place")} T${tool}`} value={mine[tool] ?? ""} disabled={!canEdit} aria-invalid={mineProblems.length > 0} onChange={(e) => set(tool, e.target.value === "" ? null : Number(e.target.value))}>
                      <option value="">-</option>
                      {places.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td aria-hidden="true">{mineProblems.length > 0 ? <span className="warn">▲</span> : mine[tool] != null ? <span className="ok">✔</span> : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {problems.length > 0 && (
        <ul className="warn-box" role="alert">
          {problems.map((p, i) => {
            const [key, vars] = problemText(p);
            return <li key={i}>{t(key, vars)}</li>;
          })}
        </ul>
      )}
      <div className="form-actions">
        <button disabled={!canEdit || list.length === 0} onClick={() => setAssign(fillInOrder(list, mine, defined))}>
          {t("atc_fill")}
        </button>
        <button disabled={!canEdit} onClick={() => setAssign({})}>
          {t("live_clear")}
        </button>
        <button className="primary" disabled={!canEdit || problems.length > 0 || list.length === 0} onClick={useIn}>
          {t("atc_use")}
        </button>
      </div>
      {rack && (
        <pre className="log" aria-label={t("atc_title")}>
          {JSON.stringify({ request_version: 2, rack }, null, 2)}
        </pre>
      )}
    </Card>
  );
}
