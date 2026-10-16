"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { deleteSession as apiDeleteSession, updateSession as apiUpdateSession, EdgeApiError, listSessions, SESSION_TITLE_MAX } from "@/lib/edge/api";
import type { SessionSummary } from "@/lib/edge/types";

export { SESSION_TITLE_MAX };

interface SessionsContextValue {
  sessions: SessionSummary[];
  loading: boolean;
  error: string | null;
  /** True in open mode / when the backend cannot list sessions for this identity. */
  unavailable: boolean;
  refresh: () => Promise<void>;
  remove: (id: string) => Promise<boolean>;
  /** Optimistic rename; rolls back and toasts on failure. Returns false if nothing changed. */
  rename: (id: string, title: string) => Promise<boolean>;
  /** Optimistic pin/unpin; rolls back and toasts on failure. */
  setPinned: (id: string, pinned: boolean) => Promise<boolean>;
  /**
   * A title the backend chose (the `session` stream event), applied in place. A conversation
   * not in the list yet — its first turn just created it — triggers a refresh instead.
   */
  applyTitle: (id: string, title: string) => void;
}

const SessionsContext = createContext<SessionsContextValue | null>(null);

export function SessionsProvider({ children }: { children: ReactNode }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const inflight = useRef<Promise<void> | null>(null);

  const refresh = useCallback(async () => {
    if (inflight.current) return inflight.current;
    const p = (async () => {
      try {
        const list = await listSessions(50);
        setSessions(list);
        setError(null);
        setUnavailable(false);
      } catch (err) {
        if (err instanceof EdgeApiError && err.code === "no_identity") {
          setUnavailable(true);
          setSessions([]);
        } else {
          setError(err instanceof Error ? err.message : "Could not load conversations");
        }
      } finally {
        setLoading(false);
        inflight.current = null;
      }
    })();
    inflight.current = p;
    return p;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const previous = sessions;
    setSessions((s) => s.filter((x) => x.id !== id));
    try {
      await apiDeleteSession(id);
      return true;
    } catch (err) {
      setSessions(previous);
      toast.error(err instanceof Error ? err.message : "Could not delete the conversation");
      return false;
    }
  }, [sessions]);

  const rename = useCallback(async (id: string, title: string) => {
    const next = title.trim();
    if (!next || next.length > SESSION_TITLE_MAX) {
      toast.error(`A title must be between 1 and ${SESSION_TITLE_MAX} characters`);
      return false;
    }
    const previous = sessions;
    if (previous.find((x) => x.id === id)?.title?.trim() === next) return false;
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, title: next } : x)));
    try {
      const updated = await apiUpdateSession(id, { title: next });
      setSessions((s) => s.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      return true;
    } catch (err) {
      setSessions(previous);
      toast.error(err instanceof Error ? err.message : "Could not rename the conversation");
      return false;
    }
  }, [sessions]);

  const setPinned = useCallback(async (id: string, pinned: boolean) => {
    const previous = sessions;
    setSessions((s) => s.map((x) => (x.id === id ? { ...x, pinned } : x)));
    try {
      const updated = await apiUpdateSession(id, { pinned });
      setSessions((s) => s.map((x) => (x.id === id ? { ...x, ...updated } : x)));
      return true;
    } catch (err) {
      setSessions(previous);
      toast.error(err instanceof Error ? err.message : `Could not ${pinned ? "pin" : "unpin"} the conversation`);
      return false;
    }
  }, [sessions]);

  const applyTitle = useCallback(
    (id: string, title: string) => {
      const next = title.trim();
      if (!next) return;
      let found = false;
      setSessions((s) =>
        s.map((x) => {
          if (x.id !== id) return x;
          found = true;
          return { ...x, title: next };
        }),
      );
      if (!found) void refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({ sessions, loading, error, unavailable, refresh, remove, rename, setPinned, applyTitle }),
    [sessions, loading, error, unavailable, refresh, remove, rename, setPinned, applyTitle],
  );
  return <SessionsContext.Provider value={value}>{children}</SessionsContext.Provider>;
}

export function useSessions(): SessionsContextValue {
  const ctx = useContext(SessionsContext);
  if (!ctx) throw new Error("useSessions must be used within SessionsProvider");
  return ctx;
}
