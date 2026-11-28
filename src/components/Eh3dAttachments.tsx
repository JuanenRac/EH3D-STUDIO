/* The attachments of an `.eh3d` file a person chooses: the list, text and pictures shown inside, a copy saved of anything else. The file stays in the browser. Nothing is run, a link is
 * only written out, and saving a program, a script, a page, an archive or an unknown file asks first. GPL-3.0-or-later. */
import { useEffect, useState } from "react";
import { useApp } from "../context";
import { Eh3dError, LIMITS, openProject, pictureType, readAttachment, viewOf } from "../services/eh3d";
import type { Attachment, Project } from "../services/eh3d";
import { saveBytes } from "../services/format";
import { bytesText } from "../services/store";
import type { TextKey } from "../i18n";
import { Badge, Card, DangerButton, Empty, Field } from "./ui";

const PROBLEMS: Record<Eh3dError["problem"], TextKey> = { not_zip: "ea_not_project", unsupported: "ea_unsupported", damaged: "ea_damaged", too_large: "ea_too_large" };

type Shown = { id: string; name: string; verified: boolean | null; text?: string; picture?: string };

export function Eh3dAttachments() {
  const { t, say } = useApp();
  const [project, setProject] = useState<Project | null>(null);
  const [problem, setProblem] = useState<TextKey | null>(null);
  const [shown, setShown] = useState<Shown | null>(null);

  // the address of a picture is given back to the browser when another one is shown or the card goes
  const picture = shown?.picture;
  useEffect(() => () => void (picture && URL.revokeObjectURL(picture)), [picture]);

  const fail = (e: unknown) => setProblem(e instanceof Eh3dError ? PROBLEMS[e.problem] : "ea_damaged");

  const open = async (file: File | null) => {
    setProject(null);
    setShown(null);
    setProblem(null);
    if (!file) return;
    try {
      setProject(await openProject(file));
    } catch (e) {
      fail(e);
    }
  };

  const show = async (p: Project, a: Attachment) => {
    setProblem(null);
    setShown(null);
    const kind = viewOf(a);
    try {
      const content = await readAttachment(p, a, kind === "image" ? LIMITS.image : LIMITS.text);
      const base = { id: a.sha256, name: a.name, verified: content.verified };
      if (kind === "text") setShown({ ...base, text: new TextDecoder().decode(content.bytes) });
      else {
        const type = pictureType(content.bytes);
        if (!type) setProblem("ea_no_view");
        else setShown({ ...base, picture: URL.createObjectURL(new Blob([content.bytes as unknown as BlobPart], { type })) });
      }
    } catch (e) {
      fail(e);
    }
  };

  const save = async (p: Project, a: Attachment) => {
    setProblem(null);
    try {
      const content = await readAttachment(p, a, LIMITS.save);
      saveBytes(content.bytes, a.name);
      if (content.verified === null) say(t("ea_not_checked"), "ok");
    } catch (e) {
      fail(e);
    }
  };

  return (
    <Card title={t("ea_title")}>
      <p className="hint">{t("ea_intro")}</p>
      <Field label={t("ea_choose")}>
        <input type="file" accept=".eh3d" onChange={(e) => void open(e.target.files?.[0] ?? null)} />
      </Field>
      {problem && (
        <p className="error" role="alert">
          {t(problem)}
        </p>
      )}
      {project && project.attachments.length === 0 && <Empty>{t("ea_none")}</Empty>}
      {project && project.attachments.length > 0 && (
        <ul>
          {project.attachments.map((a) => (
            <li key={a.sha256}>
              <strong>{a.name}</strong>{" "}
              <small className="muted">
                {a.kind} · {bytesText(a.size)}
                {a.components.length > 0 ? ` · ${a.components.join(", ")}` : ""}
              </small>
              {a.asks && <Badge tone="bad">{t("ea_danger")}</Badge>}
              {a.url !== null ? (
                <small className="hint">
                  {" "}
                  {t("ea_link")} <code>{a.url}</code>
                </small>
              ) : (
                <span className="row-actions">
                  {viewOf(a) !== "none" && (
                    <button type="button" onClick={() => void show(project, a)}>
                      {t("ea_view")}
                    </button>
                  )}
                  {a.asks ? (
                    <DangerButton deliberate label={t("ea_save")} onConfirm={() => void save(project, a)} />
                  ) : (
                    <button type="button" onClick={() => void save(project, a)}>
                      {t("ea_save")}
                    </button>
                  )}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <section aria-label={shown.name}>
          <h4>{shown.name}</h4>
          {shown.verified === null && <p className="hint">{t("ea_not_checked")}</p>}
          {shown.text !== undefined && <pre style={{ maxHeight: "24rem", overflow: "auto", whiteSpace: "pre-wrap" }}>{shown.text}</pre>}
          {shown.picture && <img src={shown.picture} alt={shown.name} style={{ maxWidth: "100%" }} />}
        </section>
      )}
    </Card>
  );
}
