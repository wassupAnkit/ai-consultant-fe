"use client";

import { forwardRef, useState } from "react";
import { ExternalLink, HardDrive, Mail, MessageSquarePlus } from "lucide-react";
import { destinationLabel } from "@/lib/constants";
import { hostOf, isCrmSource, isDriveSource, isGmailSource, openableUrl, provenanceLabel } from "@/lib/edge/citations";
import { cn } from "@/lib/utils";

export interface SourceCardProps {
  n?: number;
  title: string;
  url: string;
  section?: string | null;
  excerpt?: string;
  country?: string | null;
  docType?: string | null;
  /** CRM records, Gmail threads and Drive files: the page a browser can open, when there is one. */
  webUrl?: string | null;
  /** Provenance, when the backend sent it: indexed class (site / partner / upload / program) or a live fetch. */
  sourceKind?: string | null;
  source?: string | null;
  live?: boolean;
  /** Search-tab results only; never shown as a number, only as an order. */
  score?: number;
  selected?: boolean;
  /** True when the answer's text cites this number; false = attached but uncited. */
  cited?: boolean;
  onAsk?: () => void;
}

export const SourceCard = forwardRef<HTMLLIElement, SourceCardProps>(function SourceCard(
  { n, title, url, section, excerpt, country, docType, webUrl, sourceKind, source, live, selected, cited = true, onAsk },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const place = destinationLabel(country);
  const crm = isCrmSource({ url, docType });
  // The consultant's own Gmail thread or Drive file: navy, with the product's icon, and never
  // its `gmail://` / `drive://` identifier in place of a host.
  const gmail = !crm && isGmailSource({ url, docType, source });
  const drive = !crm && !gmail && isDriveSource({ url, docType, source });
  const workspace = gmail || drive;
  const WorkspaceIcon = gmail ? Mail : HardDrive;
  // A record whose `crm://` URI is all we have stays unlinked, as before -- only a resolved
  // CRM page earns an action, so the reader never lands on a dead tab.
  const openUrl = openableUrl({ url, docType, webUrl, source });
  const provenance = provenanceLabel({ url, docType, sourceKind, source, live });
  // Indexed excerpts are plain text, but web hits arrive as the page's markdown; the markers
  // read as noise beside a citation, so they are dropped for display only.
  const text = excerpt ? excerpt.replace(/\*\*|__|^\s*[*-]\s+/gm, "").replace(/`/g, "") : excerpt;
  // A doc-type chip only earns its place when it says more than the provenance already does.
  const kindLabel = !crm && !workspace && docType && docType !== "crm_record" ? docType.replace(/[_-]/g, " ") : null;
  const showKind = kindLabel !== null && !provenance.toLowerCase().startsWith(kindLabel.toLowerCase().split(" ")[0]!);

  return (
    <li
      ref={ref}
      className={cn(
        "rounded-lg border border-border bg-card p-3 text-sm transition-[border-color,background-color,box-shadow]",
        selected && "border-primary bg-primary-tint/40 shadow-sm",
        !cited && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2.5">
        {n !== undefined && (
          <span
            className={cn(
              "mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
              crm ? "bg-teal text-teal-foreground" : workspace ? "bg-workspace text-workspace-foreground" : "bg-primary text-primary-foreground",
            )}
          >
            {n}
          </span>
        )}
        <div className="min-w-0 flex-1">
          {crm || !openUrl ? (
            <p className="block font-medium leading-snug text-heading">{crm ? title || "CRM record" : title || hostOf(url)}</p>
          ) : (
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className="block font-medium leading-snug text-heading hover:text-primary-strong hover:underline">
              {title || hostOf(url)}
            </a>
          )}
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {section ? `${section} · ` : ""}
            {crm ? "from your CRM" : gmail ? "Gmail" : drive ? "Google Drive" : hostOf(url)}
          </p>
        </div>
      </div>

      {text && (
        <div className="mt-2">
          <p className={cn("whitespace-pre-line text-[13.5px] leading-relaxed text-foreground/90", !expanded && "line-clamp-5")}>{text}</p>
          {text.length > 280 && (
            <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-1 text-xs font-medium text-primary-strong hover:underline">
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium",
            crm ? "border-teal/40 bg-teal-tint text-teal-foreground" : workspace ? "border-workspace/35 bg-workspace-tint text-workspace-strong" : live ? "border-warning/60 bg-warning-tint text-warning-foreground" : "border-border",
          )}
        >
          {workspace && <WorkspaceIcon className="h-3 w-3" aria-hidden />}
          {provenance}
        </span>
        {place && <span className="rounded-full border border-border px-2 py-0.5">{place}</span>}
        {showKind && <span className="rounded-full border border-border px-2 py-0.5 capitalize">{kindLabel}</span>}
        <span className="ml-auto flex items-center gap-1">
          {onAsk && (
            <button type="button" onClick={onAsk} className="inline-flex h-7 items-center gap-1 rounded-md px-2 hover:bg-accent hover:text-accent-foreground" title="Ask Edge about this page">
              <MessageSquarePlus className="h-3.5 w-3.5" /> Ask
            </button>
          )}
          {openUrl && (
            <a href={openUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-md px-2 font-medium text-primary-strong hover:bg-accent">
              <ExternalLink className="h-3.5 w-3.5" /> {crm ? "Open in CRM" : gmail ? "Open in Gmail" : drive ? "Open in Drive" : "Open"}
            </a>
          )}
        </span>
      </div>
    </li>
  );
});
