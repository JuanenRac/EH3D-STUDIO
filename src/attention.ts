/* A job that waits for the operator must not wait because the tab is in the background: the title of the page counts the jobs that wait, and, when the person asked
 * for it, a sound and a notification of the browser say when a new one starts waiting. GPL-3.0-or-later. */
import { useEffect, useRef } from "react";
import type { Api } from "./api";

/** Is there a new reason to call the person: more jobs wait than the last time we looked. */
export function shouldAlert(before: number, now: number): boolean {
  return now > before;
}

/** The title of the page: `(2) EH3D Studio` while two jobs wait. */
export function titleFor(waiting: number): string {
  return waiting > 0 ? `(${waiting}) EH3D Studio` : "EH3D Studio";
}

/** Two short notes, as a bell; a browser that does not allow sound stays silent. */
export function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1174.66].forEach((hz, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = hz;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.22);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* no sound */
  }
}

/** Looks now and then (every `seconds`, at least 5) for the jobs that wait, keeps the title up to date and, with `alerts`, calls the person. */
export function useAttention(api: Api, signedIn: boolean, seconds: number, alerts: boolean, message: string) {
  const last = useRef(0);
  const alertsRef = useRef(alerts);
  alertsRef.current = alerts;
  const messageRef = useRef(message);
  messageRef.current = message;
  useEffect(() => {
    if (!signedIn) {
      document.title = titleFor(0);
      return;
    }
    let alive = true;
    const look = () => {
      api.jobs({ state: "waiting_operator" }).then(
        (jobs) => {
          if (!alive) return;
          const n = jobs.length;
          document.title = titleFor(n);
          if (alertsRef.current && shouldAlert(last.current, n)) {
            beep();
            try {
              if ("Notification" in window && Notification.permission === "granted") new Notification("EH3D Studio", { body: messageRef.current });
            } catch {
              /* a browser without notifications */
            }
          }
          last.current = n;
        },
        () => undefined,
      );
    };
    look();
    const id = setInterval(look, Math.max(seconds, 5) * 1000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [api, signedIn, seconds]);
}
