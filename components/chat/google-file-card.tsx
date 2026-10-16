"use client";

import { ExternalLink, FileSpreadsheet, FileText, Lock } from "lucide-react";
import { isDecidable } from "@/lib/edge/crm-writes";
import { fileFields, proposalLink, proposalStatusLabel } from "@/lib/edge/workspace-proposals";
import type { CrmWriteProposalView } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { STATUS_TONE, useProposalClock } from "./crm-write-card";

export interface GoogleFileCardProps {
  view: CrmWriteProposalView;
  onDecide: (decision: "approve" | "reject") => void;
}

/** A Doc's content line by line: "# " / "## " headings bold, "- " bullets indented. Plain text only, never HTML. */
function DocPreview({ content }: { content: string }) {
  return (
    <div
      role="region"
      aria-label="Document content"
      tabIndex={0}
      className="max-h-72 overflow-y-auto break-words rounded-lg border border-border bg-muted/40 px-3 py-2 text-[13.5px] leading-relaxed text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <p key={i} className="mt-1.5 font-semibold">{line.slice(3)}</p>;
        if (line.startsWith("# ")) return <p key={i} className="mt-2 text-[15px] font-semibold first:mt-0">{line.slice(2)}</p>;
        if (line.startsWith("- ")) return <p key={i} className="pl-4 before:-ml-3 before:mr-1.5 before:content-['•']">{line.slice(2)}</p>;
        return line ? <p key={i}>{line}</p> : <div key={i} className="h-2" />;
      })}
    </div>
  );
}

function SheetPreview({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div role="region" aria-label="Sheet preview" tabIndex={0} className="max-h-72 overflow-auto rounded-lg border border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="w-full border-collapse text-[12.5px]">
        {header && (
          <thead className="sticky top-0 bg-muted">
            <tr>
              {header.map((c, i) => (
                <th key={i} className="border-b border-border px-2 py-1 text-left font-semibold text-foreground">{c}</th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {body.map((r, i) => (
            <tr key={i} className="odd:bg-muted/30">
              {r.map((c, j) => (
                <td key={j} className="border-b border-border px-2 py-1 align-top text-foreground last:border-b-0">{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A `crm_write_proposal` with `provider: "docs"`: a new Google Doc or Sheet Edge prepared. Nothing
 * is created until Create; the file lands in the consultant's own Drive, private to them, and Edge
 * never shares it.
 */
export function GoogleFileCard({ view, onDecide }: GoogleFileCardProps) {
  const now = useProposalClock();
  const f = fileFields(view);
  const applying = view.status === "applying";
  const showButtons = isDecidable(view, now) || applying;
  const link = proposalLink(view);
  const kindLabel = f.kind === "sheet" ? "Google Sheet" : "Google Doc";
  const Icon = f.kind === "sheet" ? FileSpreadsheet : FileText;

  const decide = (decision: "approve" | "reject") => {
    if (applying) return;
    track("crm_write_decision", { proposalId: view.proposalId, requestId: view.requestId, tool: view.tool, provider: "docs", decision });
    onDecide(decision);
  };

  return (
    <div className="not-prose my-3 max-w-xl overflow-hidden rounded-lg border border-workspace/35 bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-workspace-tint/50 px-3.5 py-2.5">
        <Icon className="h-4 w-4 shrink-0 text-workspace-strong" aria-hidden />
        <span className="text-sm font-medium text-foreground">New {kindLabel}</span>
        {f.title && <span className="min-w-0 truncate text-sm text-muted-foreground">{f.title}</span>}
      </div>

      <div className="space-y-2.5 px-3.5 py-3 text-[13px]">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Private to you — not shared with anyone.
        </p>
        {f.kind === "sheet" ? (
          <>
            {(f.rowsLabel || f.tab) && (
              <p className="text-xs text-muted-foreground">
                {f.rowsLabel}
                {f.tab ? ` · tab “${f.tab}”` : ""}
              </p>
            )}
            {f.rows.length ? <SheetPreview rows={f.rows} /> : <p className="text-xs text-muted-foreground">(no rows)</p>}
          </>
        ) : f.content ? (
          <DocPreview content={f.content} />
        ) : (
          <p className="text-xs text-muted-foreground">(empty document)</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-3.5 py-2.5">
        {showButtons ? (
          <>
            <Button type="button" variant="workspace" size="sm" disabled={applying} onClick={() => decide("approve")}>
              Create {f.kind === "sheet" ? "sheet" : "doc"}
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={applying} onClick={() => decide("reject")}>
              Discard
            </Button>
            <p className="text-xs text-muted-foreground">Created in your Drive.</p>
          </>
        ) : (
          <>
            <p aria-live="polite" className={cn("text-xs font-medium", STATUS_TONE[view.status])}>
              {proposalStatusLabel(view)}
            </p>
            {link && (
              <a href={link} target="_blank" rel="noopener noreferrer" className="ml-auto inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-primary-strong hover:bg-accent">
                <ExternalLink className="h-3.5 w-3.5" /> Open in {f.kind === "sheet" ? "Google Sheets" : "Google Docs"}
              </a>
            )}
          </>
        )}
      </div>
    </div>
  );
}
