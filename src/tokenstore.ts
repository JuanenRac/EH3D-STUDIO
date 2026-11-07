/* Where the login token of this browser is kept. By default it lives in sessionStorage: it is gone when the tab or the browser is closed, and another tab of the same
 * browser does not see it. A person who ticks "remember me" at the sign-in keeps it in localStorage instead, so that the next visit needs no password. Signing out (or a
 * refusal because the login ended) removes it from both. A browser that keeps nothing (a private window, blocked site data) is not an error: the login then lasts until the
 * page is closed. GPL-3.0-or-later. */

/** The one key the token is kept under, in either store. */
export const TOKEN_KEY = "eh3d-studio.token";

/** What the functions need of a web store (the real ones are `window.sessionStorage` and `window.localStorage`). */
export interface TokenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The two stores; either may be missing (`null`). */
export interface TokenStores {
  session: TokenStore | null;
  local: TokenStore | null;
}

function pick(get: () => Storage): TokenStore | null {
  try {
    return get();
  } catch {
    return null;
  }
}

/** The stores of this browser; a store that the browser refuses is `null`. */
export function browserStores(): TokenStores {
  return { session: pick(() => window.sessionStorage), local: pick(() => window.localStorage) };
}

function get(store: TokenStore | null): string | null {
  try {
    const v = store?.getItem(TOKEN_KEY) ?? null;
    return v !== null && v !== "" ? v : null;
  } catch {
    return null;
  }
}

function remove(store: TokenStore | null): void {
  try {
    store?.removeItem(TOKEN_KEY);
  } catch {
    /* nothing to remove */
  }
}

function put(store: TokenStore | null, token: string): boolean {
  try {
    if (!store) return false;
    store.setItem(TOKEN_KEY, token);
    return true;
  } catch {
    return false;
  }
}

/** The token kept by this tab (sessionStorage) or, when the person asked to be remembered, by this browser (localStorage). `null` when there is none. */
export function readToken(stores: TokenStores): string | null {
  return get(stores.session) ?? get(stores.local);
}

/** Whether the token that `readToken` finds was kept for later visits (it is in localStorage and not in this tab's store). */
export function isRemembered(stores: TokenStores): boolean {
  return get(stores.session) === null && get(stores.local) !== null;
}

/** Keeps the token. Without `remember` it goes to sessionStorage only (and is taken out of localStorage); with it, to localStorage only (and is taken out of sessionStorage).
 * When localStorage refuses it, the token stays in sessionStorage. Returns where it was kept: `"session"`, `"local"` or `"none"`. */
export function saveToken(stores: TokenStores, token: string, remember: boolean): "session" | "local" | "none" {
  if (remember && put(stores.local, token)) {
    remove(stores.session);
    return "local";
  }
  if (put(stores.session, token)) {
    remove(stores.local);
    return "session";
  }
  remove(stores.local);
  return "none";
}

/** Signing out: the token goes from both stores. */
export function clearToken(stores: TokenStores): void {
  remove(stores.session);
  remove(stores.local);
}
