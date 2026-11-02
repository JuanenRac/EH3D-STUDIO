/*
 * The rule of a page that asks again every few seconds: a new request is not made while the last one is still in flight, so a server that answers slowly
 * (or not at all, until the timeout) does not pile up requests that arrive out of order.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */

/** Wraps `run` (which starts a request and returns its promise) so that calling it while the last request is not finished does nothing. Returns whether a request was started. */
export function skipWhileBusy(run: () => Promise<unknown>): () => boolean {
  let busy = false;
  return () => {
    if (busy) return false;
    busy = true;
    const done = () => {
      busy = false;
    };
    run().then(done, done);
    return true;
  };
}
