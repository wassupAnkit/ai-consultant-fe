"use client";

import { useState } from "react";
import { AlertCircle, FileText, Image as ImageIcon, Loader2, Maximize2, X } from "lucide-react";
import type { ComposerAttachment } from "@/hooks/use-composer-attachments";
import { attachmentContentUrl, formatBytes } from "@/lib/edge/attachments";
import type { AttachmentView } from "@/lib/edge/types";
import { cn } from "@/lib/utils";
import { isImage, isPdf, useDocumentViewer } from "./document-viewer";

export function FileIcon({ type, className }: { type: string; className?: string }) {
  const Icon = type.startsWith("image/") ? ImageIcon : FileText;
  return <Icon className={cn("h-3.5 w-3.5 shrink-0", className)} aria-hidden />;
}

/**
 * A file waiting in the composer: the same removable-chip shape as the attached student
 * (`components/guided/student-mention.tsx`), in the neutral primary tint rather than CRM teal.
 * While uploading it shows a percentage and a progress line along its foot.
 */
export function ComposerAttachmentChip({ item, onRemove }: { item: ComposerAttachment; onRemove: () => void }) {
  const failed = item.status === "error";
  const uploading = item.status === "uploading";
  return (
    <span
      className={cn(
        "relative inline-flex h-8 max-w-[15rem] items-center gap-1.5 overflow-hidden rounded-full border pl-2 pr-1.5 text-xs font-medium animate-fade-in-up",
        failed ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-primary/30 bg-primary-tint text-foreground",
      )}
      title={failed ? `${item.name}: ${item.error ?? "upload failed"}` : `${item.name} · ${formatBytes(item.size)}`}
    >
      {uploading ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" aria-hidden /> : failed ? <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> : item.previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- a local blob: preview of the picked file
        <img src={item.previewUrl} alt="" className="h-5 w-5 shrink-0 rounded object-cover ring-1 ring-border" />
      ) : (
        <FileIcon type={item.type} className="text-primary" />
      )}
      <span className="truncate">{item.name}</span>
      <span className={cn("shrink-0 tabular-nums", failed ? "text-destructive" : "text-muted-foreground")}>
        {uploading ? `${Math.round(item.progress * 100)}%` : failed ? "Failed" : formatBytes(item.size)}
      </span>
      <span className="sr-only" aria-live="polite">
        {uploading ? "Uploading" : failed ? `Upload failed: ${item.error ?? ""}` : "Uploaded"}
      </span>
      <button type="button" onClick={onRemove} aria-label={`Remove ${item.name}`} className="rounded-full p-0.5 hover:bg-card/70">
        <X className="h-3 w-3" />
      </button>
      {uploading && <span className="absolute bottom-0 left-0 h-0.5 bg-primary transition-[width]" style={{ width: `${Math.max(4, item.progress * 100)}%` }} aria-hidden />}
    </span>
  );
}

/**
 * Files sent with a question, shown in the chat itself: image scans as thumbnails, PDFs as a
 * tile. Clicking one opens the in-app viewer over the chat (never a new tab), with the
 * message's other files a swipe away.
 */
export function MessageAttachments({ attachments }: { attachments: AttachmentView[] }) {
  const viewer = useDocumentViewer();
  const docs = attachments.map((a) => ({ id: a.id, fileName: a.fileName, mimeType: a.mimeType, sizeBytes: a.sizeBytes }));
  return (
    <>
      {attachments.map((a, i) => (
        <AttachmentThumb key={a.id} attachment={a} onOpen={() => viewer.open(docs, i)} />
      ))}
    </>
  );
}

export function AttachmentThumb({ attachment, onOpen, className, compact = false }: { attachment: Pick<AttachmentView, "id" | "fileName" | "mimeType" | "sizeBytes">; onOpen: () => void; className?: string; compact?: boolean }) {
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const image = isImage(attachment.mimeType);
  const label = `View ${attachment.fileName}`;

  if (image && state !== "failed") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        title={label}
        className={cn(
          "group relative h-28 w-40 overflow-hidden rounded-xl border border-border bg-muted shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 animate-fade-in-up",
          className,
        )}
      >
        {state === "loading" && <span className="absolute inset-0 animate-pulse bg-muted-foreground/10 motion-reduce:animate-none" aria-hidden />}
        {/* eslint-disable-next-line @next/next/no-img-element -- an owner-only, uncached API image, not a static asset */}
        <img
          src={attachmentContentUrl(attachment.id)}
          alt=""
          loading="lazy"
          onLoad={() => setState("ready")}
          onError={() => setState("failed")}
          className={cn("h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]", state === "ready" ? "opacity-100" : "opacity-0")}
        />
        {compact ? (
          <Maximize2 className="absolute bottom-1 right-1 h-3 w-3 rounded bg-black/50 p-0.5 text-white opacity-0 transition group-hover:opacity-100" aria-hidden />
        ) : (
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4 text-left text-[11px] font-medium text-white">
            <span className="truncate">{attachment.fileName}</span>
            <Maximize2 className="ml-auto h-3 w-3 shrink-0 opacity-0 transition group-hover:opacity-100" aria-hidden />
          </span>
        )}
      </button>
    );
  }
  // PDFs, and images this browser cannot draw (HEIC outside Safari): a tile that opens the viewer.
  if (compact) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={label}
        title={label}
        className={cn("flex items-center justify-center rounded-xl border border-border bg-primary-tint shadow-sm transition hover:border-primary/50 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40", className)}
      >
        <FileText className="h-6 w-6 text-primary" aria-hidden />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-28 w-40 flex-col justify-between rounded-xl border border-border bg-card p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 animate-fade-in-up",
        className,
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint">
        <FileText className="h-5 w-5 text-primary" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-medium text-foreground">{attachment.fileName}</span>
        <span className="block text-[11px] text-muted-foreground">
          {isPdf(attachment.mimeType) ? "PDF" : "Image"}
          {attachment.sizeBytes > 0 ? ` · ${formatBytes(attachment.sizeBytes)}` : ""}
        </span>
      </span>
    </button>
  );
}
