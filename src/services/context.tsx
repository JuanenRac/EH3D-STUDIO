/* What the pages of the common services share: the transport, the clients of the four services, who the person is (the role and the scopes the server gave the login), and the one
 * stream of events of the tab, which is opened while a page that follows it is shown and closed when the last one is left. GPL-3.0-or-later. */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../context";
import { AuthClient } from "./authsvc";
import { EventFeed } from "./events";
import type { FeedEvent, FeedHello, FeedListener, FeedStatus, SourceLike } from "./events";
import { ServiceHttp } from "./http";
import { can } from "./permissions";
import type { Action, Who } from "./permissions";
import { StoreClient } from "./store";
import type { AuthClaims } from "./types";
import { WorkClient } from "./work";

/** The application name Studio logs in with and keeps its projects under. */
export const STUDIO_APP = "studio";

export interface ServicesState {
  http: ServiceHttp;
  auth: AuthClient;
  work: WorkClient;
  store: (app: string) => StoreClient;
  claims: AuthClaims | null;
  who: Who;
  /** Whether the role (and the scopes of the token) allow the action; the server decides in the end. */
  allowed: (action: Action) => boolean;
  /** Opens the stream while the caller needs it; call the result to let it go. */
  acquireFeed: () => () => void;
  feed: EventFeed;
}

export const ServicesContext = createContext<ServicesState | null>(null);

export function useServices(): ServicesState {
  const v = useContext(ServicesContext);
  if (!v) throw new Error("useServices outside of the services");
  return v;
}

export function ServicesProvider({ children }: { children: ReactNode }) {
  const { api, session } = useApp();
  const http = useMemo(() => {
    const tr = api.transport();
    return new ServiceHttp(tr.token, tr.fetcher, { normal: tr.timeouts.normal, transfer: tr.timeouts.long });
  }, [api]);
  const auth = useMemo(() => new AuthClient(http), [http]);
  const work = useMemo(() => new WorkClient(http), [http]);
  const stores = useRef(new Map<string, StoreClient>());
  const store = useCallback(
    (app: string) => {
      let c = stores.current.get(app);
      if (!c) {
        c = new StoreClient(http, app);
        stores.current.set(app, c);
      }
      return c;
    },
    [http],
  );
  const [claims, setClaims] = useState<AuthClaims | null>(null);
  useEffect(() => {
    let alive = true;
    auth.claims().then(
      (c) => alive && setClaims(c),
      () => alive && setClaims(null),
    );
    return () => {
      alive = false;
    };
  }, [auth, session.name, session.role]);
  // the role the session said is the floor: the claims can only add the scopes that narrow it
  const who: Who = useMemo(() => ({ role: session.role, scopes: claims?.scopes ?? null }), [session.role, claims]);
  const allowed = useCallback((a: Action) => can(who, a), [who]);

  const feed = useMemo(
    () =>
      new EventFeed({
        open: (url) => {
          if (typeof EventSource === "undefined") throw new Error("no EventSource");
          return new EventSource(url) as unknown as SourceLike;
        },
        ticket: async () => (await api.ticket()).ticket,
      }),
    [api],
  );
  const users = useRef(0);
  const acquireFeed = useCallback(() => {
    users.current += 1;
    if (users.current === 1) feed.start();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      users.current -= 1;
      if (users.current === 0) feed.stop();
    };
  }, [feed]);
  useEffect(() => () => feed.stop(), [feed]);

  const value: ServicesState = useMemo(() => ({ http, auth, work, store, claims, who, allowed, acquireFeed, feed }), [http, auth, work, store, claims, who, allowed, acquireFeed, feed]);
  return <ServicesContext.Provider value={value}>{children}</ServicesContext.Provider>;
}

/** Follows the stream while the page is shown: the handlers get the events as they come; the status says whether it is live, mending itself or has given up. */
export function useFeed(handlers: { onEvent?: (e: FeedEvent) => void; onResync?: () => void; onHello?: (h: FeedHello) => void }): { status: FeedStatus; attempt: number; retry: () => void } {
  const { feed, acquireFeed } = useServices();
  const [now, setNow] = useState<{ status: FeedStatus; attempt: number }>({ status: "idle", attempt: 0 });
  const latest = useRef(handlers);
  latest.current = handlers;
  useEffect(() => {
    const listener: FeedListener = {
      onStatus: (status, attempt) => setNow({ status, attempt }),
      onEvent: (e) => latest.current.onEvent?.(e),
      onResync: () => latest.current.onResync?.(),
      onHello: (h) => latest.current.onHello?.(h),
    };
    const off = feed.subscribe(listener);
    const release = acquireFeed();
    return () => {
      off();
      release();
    };
  }, [feed, acquireFeed]);
  const retry = useCallback(() => feed.start(), [feed]);
  return { ...now, retry };
}
