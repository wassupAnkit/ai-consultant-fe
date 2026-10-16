"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { MoreHorizontal, Pencil, Pin, PinOff, Route, Search, SquarePen, Trash2, X } from "lucide-react";
import { STEP_SHORT_LABEL } from "@/lib/edge/journey";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useChat } from "@/hooks/use-chat";
import { useShortcutLabels } from "@/hooks/use-chat-shortcuts";
import { SESSION_TITLE_MAX, useSessions } from "@/hooks/use-sessions";
import { track } from "@/lib/analytics";
import { SESSION_RETENTION_HINT } from "@/lib/constants";
import { dayGroup, relativeTime, type DayGroup } from "@/lib/format";
import type { SessionSummary } from "@/lib/edge/types";
import { cn } from "@/lib/utils";

const GROUP_ORDER: DayGroup[] = ["Today", "Yesterday", "Earlier"];

function displayTitle(s: SessionSummary): string {
  return s.title?.trim() || "Untitled conversation";
}

/**
 * Conversations: a new-chat row, a title search, then pinned and dated groups. Each row's
 * actions live in one overflow menu that appears on hover or focus (and always on touch),
 * so titles keep their full width and phones are not left without pin, rename or delete.
 */
export function SessionSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { sessions, loading, error, unavailable, refresh, remove, rename, setPinned } = useSessions();
  const { activeSessionId, status } = useChat();
  const keys = useShortcutLabels();
  const [pendingDelete, setPendingDelete] = useState<SessionSummary | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  /** Set once an edit is settled (committed or cancelled) so a trailing blur does not commit twice. */
  const settledRef = useRef(false);

  const { sections, visibleCount } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = needle ? sessions.filter((s) => displayTitle(s).toLowerCase().includes(needle)) : sessions;
    // Pinned first, in their own group; everything else keeps the existing date grouping.
    const pinned = visible.filter((s) => s.pinned);
    const map = new Map<DayGroup, SessionSummary[]>();
    for (const s of visible) {
      if (s.pinned) continue;
      const g = dayGroup(s.lastActiveAt);
      map.set(g, [...(map.get(g) ?? []), s]);
    }
    const dated = GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g as string, items: map.get(g)! }));
    return {
      sections: pinned.length ? [{ label: "Pinned", items: pinned }, ...dated] : dated,
      visibleCount: visible.length,
    };
  }, [sessions, query]);

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const id = pendingDelete.id;
    setPendingDelete(null);
    const ok = await remove(id);
    if (ok) track("session_delete", { sessionId: id, wasActive: id === activeSessionId });
    if (ok && id === activeSessionId) router.replace("/chat");
  };

  const startRename = (s: SessionSummary) => {
    settledRef.current = false;
    setDraft(s.title?.trim() ?? "");
    setEditingId(s.id);
  };

  const cancelRename = () => {
    settledRef.current = true;
    setEditingId(null);
    setDraft("");
  };

  const commitRename = async (s: SessionSummary) => {
    if (settledRef.current) return;
    settledRef.current = true;
    const next = draft.trim();
    setEditingId(null);
    // An emptied field is a cancel, not a validation error.
    if (!next || next === (s.title?.trim() ?? "")) return;
    const ok = await rename(s.id, next);
    if (ok) track("session_rename", { sessionId: s.id, chars: next.length, wasActive: s.id === activeSessionId });
  };

  const togglePin = async (s: SessionSummary) => {
    const pinned = !s.pinned;
    const ok = await setPinned(s.id, pinned);
    if (ok) track("session_pin", { sessionId: s.id, pinned });
  };

  const listReady = !loading && !error && !unavailable;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="px-2 pt-3">
        <Link
          href="/chat"
          onClick={() => {
            track("new_chat", { fromSessionId: activeSessionId });
            onNavigate?.();
          }}
          className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm font-medium text-foreground transition hover:bg-primary-tint hover:text-accent-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
        >
          <SquarePen className="h-4 w-4 text-primary" />
          New chat
          <kbd className="ml-auto hidden font-sans text-[11px] text-muted-foreground lg:inline">
            {keys.mod}
            {keys.shift}O
          </kbd>
        </Link>
      </div>

      {listReady && sessions.length > 0 && (
        <div className="px-2 pb-1 pt-2">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              // The ⌘K shortcut focuses this by attribute; keep it stable if the markup moves.
              data-conversation-search=""
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuery("");
                }
              }}
              placeholder="Search conversations…"
              aria-label="Search conversations by title"
              className="h-8 w-full rounded-md border border-border/70 bg-card pl-8 pr-8 text-[13px] placeholder:text-muted-foreground focus:border-primary focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
        </div>
      )}

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
        {loading && (
          <ul className="space-y-1 px-1 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </ul>
        )}
        {!loading && unavailable && <p className="px-2 pt-3 text-xs text-muted-foreground">Conversation history is not available for this identity.</p>}
        {!loading && error && (
          <div className="px-2 pt-3 text-xs text-destructive">
            {error}{" "}
            <button className="underline" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}
        {listReady && sessions.length === 0 && <p className="px-2 pt-3 text-xs leading-relaxed text-muted-foreground">No conversations yet. Ask your first question to start one.</p>}
        {listReady && sessions.length > 0 && visibleCount === 0 && (
          <p className="px-2 pt-3 text-xs text-muted-foreground">
            No conversations match &ldquo;{query.trim()}&rdquo;.{" "}
            <button className="underline" onClick={() => setQuery("")}>
              Clear search
            </button>
          </p>
        )}
        {sections.map((section) => (
          <div key={section.label} className="pt-3">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{section.label}</p>
            <ul className="space-y-0.5">
              {section.items.map((s) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  active={s.id === activeSessionId}
                  streaming={s.id === activeSessionId && status === "streaming"}
                  editing={editingId === s.id}
                  draft={draft}
                  onDraftChange={setDraft}
                  onRenameStart={() => startRename(s)}
                  onRenameCommit={() => void commitRename(s)}
                  onRenameCancel={cancelRename}
                  onTogglePin={() => void togglePin(s)}
                  onDelete={() => setPendingDelete(s)}
                  onNavigate={onNavigate}
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <p className="border-t border-border/70 px-3 py-2 text-[11px] leading-snug text-muted-foreground">{SESSION_RETENTION_HINT}</p>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this conversation?</DialogTitle>
            <DialogDescription>
              &ldquo;{pendingDelete?.title?.trim() || "Untitled conversation"}&rdquo; and its {pendingDelete?.messageCount ?? 0} messages will be deleted from your history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionRow({
  session: s,
  active,
  streaming,
  editing,
  draft,
  onDraftChange,
  onRenameStart,
  onRenameCommit,
  onRenameCancel,
  onTogglePin,
  onDelete,
  onNavigate,
}: {
  session: SessionSummary;
  active: boolean;
  streaming: boolean;
  editing: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onRenameStart: () => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
  onNavigate?: () => void;
}) {
  const title = displayTitle(s);
  const [menuOpen, setMenuOpen] = useState(false);

  if (editing) {
    return (
      <li>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRenameCommit();
          }}
          className={cn("flex items-center gap-2 rounded-lg px-2 py-1.5", active && "bg-primary-tint")}
        >
          <input
            autoFocus
            value={draft}
            maxLength={SESSION_TITLE_MAX}
            aria-label={`Rename conversation ${title}`}
            onChange={(e) => onDraftChange(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            onBlur={onRenameCommit}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                onRenameCancel();
              }
            }}
            className="h-7 min-w-0 flex-1 rounded-md border border-primary bg-card px-1.5 text-[13px] font-medium focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </form>
      </li>
    );
  }

  return (
    <li className="group relative">
      <Link
        href={`/chat/${s.id}`}
        onClick={() => {
          if (!active) track("session_open", { sessionId: s.id, messageCount: s.messageCount });
          onNavigate?.();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          onRenameStart();
        }}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-9 items-center gap-2 rounded-lg py-1.5 pl-2 pr-9 text-[13px] transition-colors hover:bg-muted focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
          active && "bg-primary-tint font-medium text-navy hover:bg-primary-tint dark:text-foreground",
        )}
      >
        {s.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" aria-label="Pinned" />}
        <span className="min-w-0 flex-1">
          <span className="block truncate leading-5">{title}</span>
          {s.guided && (
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-normal text-teal-foreground dark:text-teal">
              <Route className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate">Guided{s.currentStep ? ` · ${STEP_SHORT_LABEL[s.currentStep]}` : ""}</span>
            </span>
          )}
          {(streaming || active) && (
            <span className="block text-[11px] font-normal text-muted-foreground">
              {relativeTime(s.lastActiveAt)}
              {streaming ? " · answering…" : ""}
            </span>
          )}
        </span>
      </Link>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Actions for conversation ${title}`}
            className={cn(
              "absolute right-1 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent hover:text-accent-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              // Hidden until the row is hovered or focused; always shown where there is no hover.
              "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
              menuOpen && "opacity-100",
            )}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={onTogglePin} className="gap-2">
            {s.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            {s.pinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onRenameStart} className="gap-2">
            <Pencil className="h-4 w-4" /> Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onDelete} className="gap-2 text-destructive focus:bg-destructive/10 focus:text-destructive">
            <Trash2 className="h-4 w-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
