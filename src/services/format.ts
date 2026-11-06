/* Small things the pages of the common services share: dates, a file read from the computer, a file handed to the computer, and the clock of a countdown. GPL-3.0-or-later. */
import { useEffect, useState } from "react";
import { ApiError } from "../api";
import { DEFAULT_LIMITS } from "./http";

/** A time in seconds since 1970 as the person's computer writes it; `-` when there is none. */
export function whenText(seconds: number | null | undefined): string {
  return seconds == null || seconds <= 0 ? "-" : new Date(seconds * 1000).toLocaleString();
}

/** The bytes of a file chosen on the computer. A file over the limit of an upload is refused before it is read. */
export async function readPicked(file: File, max: number = DEFAULT_LIMITS.maxUpload): Promise<Uint8Array> {
  if (file.size > max) throw new ApiError(0, "upload_too_big", String(max));
  return new Uint8Array(await file.arrayBuffer());
}

/** Hands bytes to the computer as a download. */
export function saveBytes(bytes: Uint8Array, filename: string, type = "application/octet-stream"): void {
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** The time now in seconds, renewed every second while `active`: the clock of a countdown. */
export function useNowS(active: boolean): number {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    if (!active) return;
    setNow(Math.floor(Date.now() / 1000));
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
