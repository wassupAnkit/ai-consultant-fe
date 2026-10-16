"use client";

import type { MouseEvent } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { EdgeSource } from "@/lib/edge/types";
import { isCrmSource, isDriveSource, isGmailSource, openableUrl, originOf } from "@/lib/edge/citations";
import { cn } from "@/lib/utils";

interface CitationChipProps {
  n: number;
  source?: EdgeSource;
  selected?: boolean;
  onSelect: (n: number) => void;
}

/**
 * Inline [n] marker rendered as a small round pill. Click (or Enter) shows the excerpt in the
 * sources panel; ctrl/⌘-click opens the page — for a CRM record that means its page in the
 * CRM, when the backend resolved one. Blue = knowledge base or web, teal = the consultant's
 * own CRM, navy = their own Gmail or Drive; the tooltip says which in words as well, so colour
 * is never the only signal.
 */
export function CitationChip({ n, source, selected, onSelect }: CitationChipProps) {
  // Never the raw `crm://` URI: it is an identifier, not a link, and opening it would give
  // the reader a dead tab. A record without a resolved page falls back to the excerpt.
  const href = openableUrl(source);
  const crm = isCrmSource(source);
  const gmail = !crm && isGmailSource(source);
  const drive = !crm && !gmail && isDriveSource(source);
  const kind = crm ? " (CRM record)" : gmail ? " (Gmail)" : drive ? " (Google Drive)" : "";
  const opens = crm ? "in the CRM" : gmail ? "in Gmail" : drive ? "in Drive" : "the page";
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if ((e.metaKey || e.ctrlKey) && href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }
    onSelect(n);
  };
  const chip = (
    <button
      type="button"
      onClick={onClick}
      aria-label={source ? `Source ${n}${kind}: ${source.title}` : `Source ${n}`}
      className={cn(
        // A 20px hit box with a 2px halo: legible without breaking the line's rhythm.
        "mx-0.5 inline-flex h-5 min-w-5 -translate-y-px items-center justify-center rounded-full border px-1 align-middle text-[11px] font-semibold leading-none tabular-nums transition",
        crm
          ? "border-teal/40 bg-teal-tint text-teal-foreground hover:border-teal hover:bg-teal/20"
          : gmail || drive
            ? "border-workspace/35 bg-workspace-tint text-workspace-strong hover:border-workspace hover:bg-workspace/15"
            : "border-primary/25 bg-primary-tint text-primary-strong hover:border-primary/60 hover:bg-primary/15",
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        !source && "border-dashed opacity-70",
      )}
    >
      {n}
    </button>
  );
  if (!source) return chip;
  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs border border-border bg-popover text-popover-foreground shadow-md">
        <p className="text-xs font-medium leading-snug">{source.title}</p>
        <p className="text-[11px] text-muted-foreground">
          {source.section ? `${source.section} · ` : ""}
          {originOf(source)}
        </p>
        {source.excerpt && <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground/90">{source.excerpt}</p>}
        <p className="mt-1 text-[11px] text-muted-foreground/80">Click for the excerpt{href ? ` · ⌘/Ctrl-click to open ${opens}` : ""}</p>
      </TooltipContent>
    </Tooltip>
  );
}
