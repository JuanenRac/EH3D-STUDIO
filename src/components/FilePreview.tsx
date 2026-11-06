/* What a file of a project holds: its versions with their SHA-256, and a preview — a text (also the drilling, G-code and Gerber files) up to a limit, or an image. A file that is
 * too big, or is not text or image, is not shown: the person downloads it. */
import { useEffect, useState } from "react";
import { useApp } from "../context";
import { Card, Empty } from "./ui";
import { whenText } from "../services/format";
import { PREVIEW_MAX_BYTES, bytesText, imageType, isJsonName, prettyJson, previewKind, textPreview } from "../services/store";
import type { StoreClient, TextPreview } from "../services/store";
import type { StoreFile, StoreVersion } from "../services/types";

type Shown = { kind: "loading" } | { kind: "error"; error: unknown } | { kind: "big" } | { kind: "binary" } | { kind: "text"; preview: TextPreview } | { kind: "image"; url: string };

export function FilePreview({
  store,
  projectId,
  file,
  onClose,
  onDownload,
}: {
  store: StoreClient;
  projectId: string;
  file: StoreFile | null;
  onClose: () => void;
  onDownload: (name: string, version?: number) => void;
}) {
  const { t, err } = useApp();
  const name = file?.name ?? "";
  const [version, setVersion] = useState<number | null>(null);
  const [versions, setVersions] = useState<StoreVersion[] | null>(null);
  const [versionsError, setVersionsError] = useState<unknown>(null);
  const [shown, setShown] = useState<Shown>({ kind: "loading" });

  useEffect(() => {
    setVersion(null);
    setVersions(null);
    setVersionsError(null);
    if (!name) return;
    let alive = true;
    store.versions(projectId, name).then(
      (v) => alive && setVersions(v),
      (e) => alive && setVersionsError(e),
    );
    return () => {
      alive = false;
    };
  }, [store, projectId, name, file?.sha256]);

  const current = version === null ? file : (versions?.find((v) => v.version === version) ?? null);
  const size = current?.size ?? 0;
  const sha = current?.sha256 ?? "";

  useEffect(() => {
    if (!name || !current) return;
    const kind = previewKind(name);
    if (kind === "binary") {
      setShown({ kind: "binary" });
      return;
    }
    if (size > PREVIEW_MAX_BYTES) {
      setShown({ kind: "big" });
      return;
    }
    let alive = true;
    let url: string | null = null;
    setShown({ kind: "loading" });
    store.read(projectId, name, version ?? undefined, PREVIEW_MAX_BYTES).then(
      (r) => {
        if (!alive) return;
        if (kind === "image") {
          url = URL.createObjectURL(new Blob([r.bytes as unknown as BlobPart], { type: imageType(name) }));
          setShown({ kind: "image", url });
          return;
        }
        const p = textPreview(r.bytes, { fileSize: size });
        if (p.binary) setShown({ kind: "binary" });
        else setShown({ kind: "text", preview: isJsonName(name) && !p.truncated ? { ...p, text: prettyJson(p.text) } : p });
      },
      (e) => alive && setShown({ kind: "error", error: e }),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
    // the preview follows the file, its version and its content (the sha)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, projectId, name, version, sha]);

  if (!file) return null;
  return (
    <Card
      title={`${file.name}${version !== null ? ` · v${version}` : ""}`}
      wide
      actions={
        <>
          <button onClick={() => onDownload(file.name, version ?? undefined)}>{t("act_download")}</button>
          <button onClick={onClose}>{t("act_close")}</button>
        </>
      }
    >
      <div className="preview" aria-live="polite">
        {shown.kind === "loading" && <p className="muted">{t("svc_loading")}</p>}
        {shown.kind === "error" && <p className="error">{err(shown.error)}</p>}
        {shown.kind === "big" && <Empty>{t("pj_preview_big", { size: bytesText(size) })}</Empty>}
        {shown.kind === "binary" && <Empty>{t("pj_preview_binary")}</Empty>}
        {shown.kind === "image" && <img className="preview-image" src={shown.url} alt={file.name} />}
        {shown.kind === "text" && (
          <>
            <pre className="log" tabIndex={0} aria-label={file.name}>
              {shown.preview.text}
            </pre>
            {shown.preview.truncated && <p className="hint">{t("pj_preview_cut", { n: shown.preview.lines })}</p>}
          </>
        )}
      </div>
      <h4>{t("pj_versions")}</h4>
      {versionsError != null && <p className="error">{err(versionsError)}</p>}
      {versions === null && versionsError == null && <p className="muted">{t("svc_loading")}</p>}
      {versions !== null && (
        <table className="table">
          <thead>
            <tr>
              <th>{t("pj_version")}</th>
              <th>{t("pj_size")}</th>
              <th>SHA-256</th>
              <th>{t("jobs_by")}</th>
              <th>{t("job_created")}</th>
              <th>{t("pj_comment")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.version} className={(version ?? file.version) === v.version ? "on" : ""}>
                <td>v{v.version}</td>
                <td>{bytesText(v.size)}</td>
                <td>
                  <code title={v.sha256}>{v.sha256.slice(0, 12)}</code>
                </td>
                <td>{v.by ?? ""}</td>
                <td>{whenText(v.at)}</td>
                <td>{v.comment ?? ""}</td>
                <td>
                  <div className="row-actions">
                    <button aria-pressed={(version ?? file.version) === v.version} onClick={() => setVersion(v.version === file.version ? null : v.version)}>
                      {t("pj_view")}
                    </button>
                    <button onClick={() => onDownload(file.name, v.version)}>{t("act_download")}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
