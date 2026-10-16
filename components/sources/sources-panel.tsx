"use client";

import { useEffect, useMemo, useRef } from "react";
import { BookOpen, Search, UserRound } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useSourcesPanel, type SourcesTab } from "@/hooks/use-sources-panel";
import { useGuide } from "@/hooks/use-guide";
import { StudentPanel } from "@/components/guided/student-panel";
import { citedNumbers } from "@/lib/edge/citations";
import type { ChatMessage, EdgeSource } from "@/lib/edge/types";
import { cn } from "@/lib/utils";
import { KnowledgeSearch } from "./knowledge-search";
import { SourceCard } from "./source-card";

const SOURCE_TABS: { id: SourcesTab; label: string; icon: typeof BookOpen }[] = [
  { id: "cited", label: "Sources", icon: BookOpen },
  { id: "search", label: "Search", icon: Search },
];
/** A guided session leads with its student. */
const GUIDED_TABS: typeof SOURCE_TABS = [{ id: "student", label: "Student", icon: UserRound }, ...SOURCE_TABS];

/** Provenance fields the backend sends on a source but older `EdgeSource` types may not declare. */
type SourceWithProvenance = EdgeSource & { sourceKind?: string | null; source?: string | null; live?: boolean };

export function SourcesPanel() {
  const { messages } = useChat();
  const panel = useSourcesPanel();
  const { guide } = useGuide();
  const guided = Boolean(guide);
  const TABS = guided ? GUIDED_TABS : SOURCE_TABS;
  // The student tab is there on guided sessions, never forced: the chat leads. A stale one
  // falls back to sources when the conversation on screen is not guided.
  const { setTab } = panel;
  useEffect(() => {
    if (!guided && panel.tab === "student") setTab("cited");
  }, [guided, panel.tab, setTab]);

  const target = useMemo(() => {
    if (panel.selectedMessageId) return messages.find((m) => m.id === panel.selectedMessageId) ?? null;
    return [...messages].reverse().find((m) => m.role === "assistant" && (m.sources?.length ?? 0) > 0) ?? null;
  }, [messages, panel.selectedMessageId]);
  // The question that produced the answer, so the header says what these sources are for.
  const question = useMemo(() => {
    if (!target) return null;
    const idx = messages.findIndex((m) => m.id === target.id);
    return messages.slice(0, idx).reverse().find((m) => m.role === "user")?.content ?? null;
  }, [messages, target]);
  const { cited, consulted } = useMemo(() => split(target), [target]);
  const sources = target?.sources ?? [];

  const refs = useRef(new Map<number, HTMLLIElement>());
  useEffect(() => {
    if (panel.selectedN === null) return;
    const el = refs.current.get(panel.selectedN);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [panel.selectedN, target?.id]);

  const card = (s: SourceWithProvenance, isCited: boolean) => (
    <SourceCard
      key={`${s.n}-${s.url}`}
      ref={(el) => {
        if (el) refs.current.set(s.n, el);
        else refs.current.delete(s.n);
      }}
      n={s.n}
      title={s.title}
      url={s.url}
      section={s.section}
      excerpt={s.excerpt}
      country={s.country}
      docType={s.docType}
      webUrl={s.webUrl}
      sourceKind={s.sourceKind}
      source={s.source}
      live={s.live}
      cited={isCited}
      selected={panel.selectedN === s.n}
    />
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Right padding below xl clears the drawer's close button; docked, there is none. */}
      <div className="shrink-0 pl-3 pr-12 pt-3 xl:pr-3">
        <div className="flex rounded-lg bg-muted p-0.5" role="tablist" aria-label="Sources panel">
          {TABS.map((t) => {
            const active = panel.tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                id={`sources-tab-${t.id}`}
                aria-selected={active}
                aria-controls={`sources-panel-${t.id}`}
                tabIndex={active ? 0 : -1}
                onClick={() => panel.setTab(t.id)}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                  e.preventDefault();
                  const next = TABS[(TABS.findIndex((x) => x.id === panel.tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length]!;
                  panel.setTab(next.id);
                  document.getElementById(`sources-tab-${next.id}`)?.focus();
                }}
                className={cn(
                  "inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  active ? "bg-card text-heading shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
                {t.id === "cited" && sources.length > 0 && <span className={cn("rounded-full px-1.5 text-[10px] font-semibold tabular-nums", active ? "bg-primary-tint text-primary-strong" : "bg-border/60")}>{sources.length}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {panel.tab === "student" && guided ? (
        <div id="sources-panel-student" role="tabpanel" aria-labelledby="sources-tab-student" className="flex min-h-0 flex-1 flex-col">
          <StudentPanel />
        </div>
      ) : panel.tab === "search" ? (
        <div id="sources-panel-search" role="tabpanel" aria-labelledby="sources-tab-search" className="flex min-h-0 flex-1 flex-col">
          <KnowledgeSearch />
        </div>
      ) : (
        <div id="sources-panel-cited" role="tabpanel" aria-labelledby="sources-tab-cited" className="min-h-0 flex-1 overflow-y-auto p-3">
          {sources.length === 0 ? (
            <div className="mt-10 px-2 text-center">
              <BookOpen className="mx-auto h-6 w-6 text-muted-foreground/50" />
              <p className="mt-3 font-heading text-base text-heading">No sources yet</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                When Edge answers, the evidence it drew on — knowledge-base pages, partner sites, live web pages and your CRM records — appears here. Click a numbered citation in an answer to jump to it.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-start justify-between gap-2 text-xs text-muted-foreground">
                <p className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.12em]">Sources for</span>
                  {question && <span className="mt-0.5 block truncate text-[13px] text-foreground">“{question}”</span>}
                </p>
                {panel.selectedMessageId && (
                  <button type="button" onClick={panel.clearSelection} className="shrink-0 font-medium text-primary-strong hover:underline">
                    Latest answer
                  </button>
                )}
              </div>
              {cited.length > 0 && <ul className="space-y-2">{cited.map((s) => card(s, true))}</ul>}
              {consulted.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Also consulted, not cited</p>
                  <ul className="space-y-2">{consulted.map((s) => card(s, false))}</ul>
                </>
              )}
              <p className="mt-3 text-xs leading-snug text-muted-foreground">Excerpts are the exact text the answer drew on. Open the page or record to verify before advising a student.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** The answer's sources in two groups: the ones its text cites, then the rest it was given. */
function split(message: ChatMessage | null): { cited: SourceWithProvenance[]; consulted: SourceWithProvenance[] } {
  const sources = (message?.sources ?? []) as SourceWithProvenance[];
  if (!message) return { cited: [], consulted: [] };
  const used = new Set(citedNumbers(message.content));
  // A draft cites nothing by design; then every source counts as "cited" so the list is not all greyed out.
  if (used.size === 0) return { cited: sources, consulted: [] };
  return { cited: sources.filter((s) => used.has(s.n)), consulted: sources.filter((s) => !used.has(s.n)) };
}
