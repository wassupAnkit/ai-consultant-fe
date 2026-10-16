"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

/** `student` exists only on guided sessions: the student's live CRM record. */
export type SourcesTab = "cited" | "search" | "student";

interface SourcesPanelContextValue {
  /** Assistant message whose sources are shown; null = latest answer. */
  selectedMessageId: string | null;
  /** Citation number to highlight. */
  selectedN: number | null;
  tab: SourcesTab;
  /** Whether the panel drawer is open on screens where it is not docked. */
  open: boolean;
  select: (messageId: string, n?: number | null) => void;
  clearSelection: () => void;
  setTab: (tab: SourcesTab) => void;
  setOpen: (open: boolean) => void;
}

const SourcesPanelContext = createContext<SourcesPanelContextValue | null>(null);

export function SourcesPanelProvider({ children }: { children: ReactNode }) {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [selectedN, setSelectedN] = useState<number | null>(null);
  const [tab, setTab] = useState<SourcesTab>("cited");
  const [open, setOpen] = useState(false);

  const select = useCallback((messageId: string, n: number | null = null) => {
    setSelectedMessageId(messageId);
    setSelectedN(n);
    setTab("cited");
    setOpen(true);
  }, []);
  const clearSelection = useCallback(() => {
    setSelectedMessageId(null);
    setSelectedN(null);
  }, []);

  const value = useMemo(
    () => ({ selectedMessageId, selectedN, tab, open, select, clearSelection, setTab, setOpen }),
    [selectedMessageId, selectedN, tab, open, select, clearSelection],
  );
  return <SourcesPanelContext.Provider value={value}>{children}</SourcesPanelContext.Provider>;
}

export function useSourcesPanel(): SourcesPanelContextValue {
  const ctx = useContext(SourcesPanelContext);
  if (!ctx) throw new Error("useSourcesPanel must be used within SourcesPanelProvider");
  return ctx;
}
