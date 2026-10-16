"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { AlertTriangle, Loader2, Route, X } from "lucide-react";
import { EdgeApiError, searchCrmContacts } from "@/lib/edge/api";
import { initials } from "@/lib/edge/journey";
import type { CrmContactMatch } from "@/lib/edge/types";
import { cn } from "@/lib/utils";

/** An `@name` token ending at the caret: start of input or after whitespace, no spaces inside. */
const MENTION = /(^|\s)@([^\s@]{0,40})$/;

type SearchState = { kind: "typing" } | { kind: "loading" } | { kind: "done"; results: CrmContactMatch[] } | { kind: "error"; message: string };

/**
 * `@` in the message box attaches a CRM student to the chat, which is how a guided session
 * starts: no dialog, no form. The search runs in the CRM as the consultant, so it only lists
 * students they can see. Keyboard first: ↑/↓ to choose, Enter or Tab to attach, Esc to close.
 */
export function useStudentMention({ value, caret, enabled, onPick }: { value: string; caret: number; enabled: boolean; onPick: (student: CrmContactMatch, next: { value: string; caret: number }) => void }) {
  const m = enabled ? MENTION.exec(value.slice(0, caret)) : null;
  const query = m ? m[2]! : null;
  const start = m ? caret - m[2]!.length - 1 : -1;
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [search, setSearch] = useState<SearchState>({ kind: "typing" });
  const [index, setIndex] = useState(0);
  // Enter pressed before the CRM answered: attach the first match the moment it arrives, so a
  // quick "@sadek ⏎" does what it looks like it does instead of sending a plain message.
  const [pickWhenReady, setPickWhenReady] = useState(false);
  const open = query !== null && dismissedAt !== start;

  // A fresh "@" reopens the menu even after Esc closed an earlier one.
  useEffect(() => {
    if (dismissedAt !== null && dismissedAt !== start) setDismissedAt(null);
  }, [start, dismissedAt]);

  useEffect(() => {
    if (!open || query === null || query.length < 2) {
      setSearch({ kind: "typing" });
      return;
    }
    const controller = new AbortController();
    const t = setTimeout(() => {
      setSearch({ kind: "loading" });
      searchCrmContacts(query, controller.signal)
        .then((results) => {
          setSearch({ kind: "done", results });
          setIndex(0);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSearch({
            kind: "error",
            message: err instanceof EdgeApiError && err.code === "crm_unavailable" ? "The CRM isn't connected for your account right now." : err instanceof Error ? err.message : "The CRM search failed.",
          });
        });
    }, 250);
    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [open, query]);

  const results = search.kind === "done" ? search.results : [];
  useEffect(() => {
    if (!pickWhenReady) return;
    if (!open || search.kind === "error" || (search.kind === "done" && !search.results.length)) setPickWhenReady(false);
    else if (search.kind === "done") {
      setPickWhenReady(false);
      pick(search.results[0]!);
    }
  }, [pickWhenReady, search, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (student: CrmContactMatch) => {
    // The @token goes; the rest of what the consultant typed stays exactly where it was.
    const before = value.slice(0, start);
    const after = value.slice(caret);
    const next = !before || /\s$/.test(before) ? before + after.replace(/^[ \t]+/, "") : before + after;
    onPick(student, { value: next, caret: start });
  };

  /** Handles the keys the menu owns; returns true when the textarea should not act on the key. */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): boolean => {
    if (!open) return false;
    if (e.key === "Escape") {
      e.preventDefault();
      setDismissedAt(start);
      return true;
    }
    if (!results.length) {
      if (e.key !== "Enter" || e.shiftKey) return false;
      e.preventDefault();
      if (search.kind === "loading" || (search.kind === "typing" && query !== null && query.length >= 2)) setPickWhenReady(true);
      return true;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) % results.length);
      return true;
    }
    if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
      e.preventDefault();
      pick(results[index] ?? results[0]!);
      return true;
    }
    return false;
  };

  return { open, query: query ?? "", search, results, index, setIndex, pick, onKeyDown, pending: pickWhenReady, close: () => setDismissedAt(start) };
}

export function MentionMenu({ mention }: { mention: ReturnType<typeof useStudentMention> }) {
  if (!mention.open) return null;
  const { search, results, index } = mention;
  return (
    <div
      role="listbox"
      id="student-mention-menu"
      aria-label="Attach a student from the CRM"
      className="absolute bottom-full left-0 z-30 mb-2 w-full max-w-[26rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg animate-fade-in-up"
      // Keep the caret in the textarea while clicking a row.
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        <Route className="h-3.5 w-3.5 text-teal-foreground dark:text-teal" />
        Work on a student&rsquo;s journey
        <button type="button" onClick={mention.close} aria-label="Close" className="ml-auto rounded p-0.5 hover:bg-muted">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="max-h-72 overflow-y-auto p-1.5" aria-live="polite">
        {search.kind === "typing" && !mention.pending && <p className="px-2.5 py-3 text-[13px] text-muted-foreground">Type a student&rsquo;s name, email or phone from the CRM.</p>}
        {(search.kind === "loading" || (search.kind === "typing" && mention.pending)) && (
          <p className="flex items-center gap-2 px-2.5 py-3 text-[13px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching the CRM for &ldquo;{mention.query}&rdquo;…{mention.pending ? " The first match will be attached." : ""}
          </p>
        )}
        {search.kind === "error" && (
          <p className="flex items-start gap-2 px-2.5 py-3 text-[13px] text-warning-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {search.message}
          </p>
        )}
        {search.kind === "done" && results.length === 0 && <p className="px-2.5 py-3 text-[13px] text-muted-foreground">No students visible to you match &ldquo;{mention.query}&rdquo;.</p>}
        {results.map((c, i) => (
          <button
            key={c.id}
            type="button"
            role="option"
            aria-selected={i === index}
            onMouseEnter={() => mention.setIndex(i)}
            onClick={() => mention.pick(c)}
            className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition", i === index ? "bg-primary-tint" : "hover:bg-muted")}
          >
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-tint text-[10.5px] font-semibold text-teal-foreground">{initials(c.name)}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-heading">{c.name}</span>
              <span className="block truncate text-[11.5px] text-muted-foreground">{[c.email, c.branch].filter(Boolean).join(" · ") || "No email on record"}</span>
            </span>
            {c.status && <span className="shrink-0 text-[11px] text-muted-foreground">{c.status}</span>}
          </button>
        ))}
      </div>
      {results.length > 0 && <p className="border-t border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground">↑↓ choose · Enter attach · Esc close</p>}
    </div>
  );
}

/** The attached-but-not-yet-sent student, as a removable chip in the composer. */
export function AttachedStudent({ student, onRemove }: { student: CrmContactMatch; onRemove: () => void }) {
  return (
    <span
      className="inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-full border border-teal/40 bg-teal-tint pl-1 pr-1.5 text-xs font-medium text-teal-foreground animate-fade-in-up dark:text-teal"
      title={`Sending turns this chat into ${student.name}'s journey, with their CRM record alongside`}
    >
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-card text-[10px] font-semibold">{initials(student.name)}</span>
      <span className="truncate">{student.name}</span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${student.name}`} className="rounded-full p-0.5 hover:bg-card/70">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
