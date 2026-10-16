"use client";

import { CircleAlert, FileText } from "lucide-react";
import { attachmentType } from "@/lib/edge/attachments";
import type { DocumentExtractionView, DocumentField } from "@/lib/edge/types";
import { cn } from "@/lib/utils";
import { AttachmentThumb } from "./attachment-chip";
import { useDocumentViewer } from "./document-viewer";

const TYPE_LABEL: Record<DocumentExtractionView["documentType"], string> = {
  passport: "Passport",
  national_id: "National ID",
  other: "Document",
};

/** The CRM checklist name when Edge filed it under one, else the kind of document it read. */
export function documentLabel(doc: DocumentExtractionView): string {
  return doc.crmDocumentType ?? TYPE_LABEL[doc.documentType] ?? "Document";
}

const CONFIDENCE: Record<DocumentField["confidence"], { dot: string; text: string }> = {
  high: { dot: "bg-success", text: "High confidence" },
  medium: { dot: "bg-warning", text: "Medium confidence: check against the document" },
  low: { dot: "bg-destructive", text: "Low confidence: check against the document" },
};

/**
 * What Edge read from one attached document (`document_extraction`), shown above the approval
 * cards it led to: the fields with how sure Edge is of each (MRZ = read from the checksummed
 * machine-readable zone), then anything the counsellor should look at before approving.
 */
export function DocumentCard({ doc }: { doc: DocumentExtractionView }) {
  const viewer = useDocumentViewer();
  // The extraction view carries no MIME type; the file name's extension is enough to pick image or PDF.
  const file = { id: doc.attachmentId, fileName: doc.fileName, mimeType: attachmentType({ name: doc.fileName, type: "", size: 0 }) ?? "image/jpeg", sizeBytes: 0 };
  const open = () => viewer.open([file]);
  return (
    <div className="not-prose my-3 max-w-xl overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-b border-border bg-muted/50 px-3.5 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        <span className="text-sm font-medium text-foreground">{documentLabel(doc)}</span>
        {doc.country && <span className="text-sm text-muted-foreground">· {doc.country}</span>}
        <button
          type="button"
          onClick={open}
          className="ml-auto min-w-0 max-w-full truncate text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          title={`View ${doc.fileName}`}
        >
          {doc.fileName}
        </button>
      </div>

      <div className="space-y-3 px-3.5 py-3">
        <div className="flex items-center gap-3">
          <AttachmentThumb attachment={file} onOpen={open} compact className="h-16 w-24 shrink-0" />
          <div className="min-w-0">
            {doc.holderName && <p className="truncate text-sm font-medium text-foreground">{doc.holderName}</p>}
            <p className="text-xs text-muted-foreground">Click the scan to check it against what Edge read.</p>
          </div>
        </div>
        {doc.fields.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="my-0 w-full text-[13px]">
              <tbody>
                {doc.fields.map((f) => {
                  const c = CONFIDENCE[f.confidence] ?? CONFIDENCE.low;
                  return (
                    <tr key={f.key} className="border-b border-border last:border-0">
                      <td className="w-[40%] px-3 py-1.5 align-top text-muted-foreground">{f.label}</td>
                      <td className="px-3 py-1.5 align-top font-medium text-foreground">
                        <span className="break-words">{f.value}</span>
                      </td>
                      <td className="w-px whitespace-nowrap px-3 py-1.5 text-right align-top">
                        <span className="inline-flex items-center gap-1.5">
                          {f.source === "mrz" && (
                            <span className="inline-flex h-4 items-center rounded border border-primary/30 bg-primary-tint px-1 text-[10px] font-semibold tracking-wide text-primary-strong" title="Read from the machine-readable zone (checksummed)">
                              MRZ
                            </span>
                          )}
                          <span className={cn("inline-block h-2 w-2 rounded-full", c.dot)} title={c.text} aria-hidden />
                          <span className="sr-only">{c.text}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[13px] text-muted-foreground">No fields could be read from this file.</p>
        )}

        {doc.warnings.length > 0 && (
          <ul className="space-y-1.5 rounded-lg border border-warning/50 bg-warning-tint px-3 py-2 text-[13px] leading-snug text-warning-foreground" aria-label="Warnings">
            {doc.warnings.map((w, i) => (
              <li key={`${w.code}-${i}`} className="flex items-start gap-2">
                <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span>{w.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
