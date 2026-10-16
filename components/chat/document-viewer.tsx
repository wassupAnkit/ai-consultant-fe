"use client";

/**
 * In-app viewer for student documents: a passport or ID opens over the chat, never in a new tab.
 *
 * - Images: fit to the window; zoom in/out, rotate (phone photos are often sideways), scroll to pan.
 * - PDFs: the browser's own PDF viewer, inline. The bytes are fetched and shown from a blob: URL
 *   because the app's CSP (`frame-ancestors 'none'`) forbids framing our own /api routes.
 * - HEIC/HEIF (iPhone photos) render in Safari; elsewhere the viewer says so and offers Download.
 * - Several files from one message: arrows (and ← →) move between them.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { attachmentContentUrl, formatBytes } from "@/lib/edge/attachments";
import { cn } from "@/lib/utils";

export interface ViewableDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes?: number;
}

interface ViewerApi {
  open: (docs: ViewableDocument[], index?: number) => void;
}

const ViewerContext = createContext<ViewerApi>({ open: () => {} });

export function useDocumentViewer(): ViewerApi {
  return useContext(ViewerContext);
}

export function DocumentViewerProvider({ children }: { children: ReactNode }) {
  const [docs, setDocs] = useState<ViewableDocument[]>([]);
  const [index, setIndex] = useState(0);
  const open = useCallback((list: ViewableDocument[], at = 0) => {
    if (!list.length) return;
    setDocs(list);
    setIndex(Math.max(0, Math.min(list.length - 1, at)));
  }, []);
  const api = useMemo(() => ({ open }), [open]);
  return (
    <ViewerContext.Provider value={api}>
      {children}
      <DocumentViewer docs={docs} index={index} onIndex={setIndex} onClose={() => setDocs([])} />
    </ViewerContext.Provider>
  );
}

/** Image types every current browser can draw (HEIC only Safari: tried, with a fallback). */
export const isImage = (mime: string) => mime.startsWith("image/");
export const isPdf = (mime: string) => mime === "application/pdf";

function DocumentViewer({ docs, index, onIndex, onClose }: { docs: ViewableDocument[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const doc = docs[index];
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Reset per document.
  useEffect(() => {
    setZoom(1);
    setRotation(0);
    setFailed(false);
    setLoaded(false);
  }, [doc?.id]);

  // PDFs: fetch once and show from a blob: URL (see the file comment).
  useEffect(() => {
    if (!doc || !isPdf(doc.mimeType)) return;
    const controller = new AbortController();
    let url: string | null = null;
    setPdfUrl(null);
    fetch(attachmentContentUrl(doc.id), { signal: controller.signal })
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error(String(r.status)))))
      .then((blob) => {
        url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        setPdfUrl(url);
        setLoaded(true);
      })
      .catch((err: Error) => err.name !== "AbortError" && setFailed(true));
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [doc]);

  const go = (step: number) => docs.length > 1 && onIndex((index + step + docs.length) % docs.length);

  if (!doc) return null;
  const image = isImage(doc.mimeType);
  const src = attachmentContentUrl(doc.id);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="flex h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1100px,calc(100vw-4rem))]"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
          if (image && (e.key === "+" || e.key === "=")) setZoom((z) => Math.min(4, z + 0.5));
          if (image && e.key === "-") setZoom((z) => Math.max(1, z - 0.5));
        }}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-2.5 pr-12">
          <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-medium text-foreground">{doc.fileName}</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {[docs.length > 1 ? `${index + 1} of ${docs.length}` : null, doc.sizeBytes ? formatBytes(doc.sizeBytes) : null, "Visible only to you"].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
          {image && !failed && (
            <div className="flex items-center gap-1">
              <ToolButton label="Zoom out" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
                <ZoomOut className="h-4 w-4" />
              </ToolButton>
              <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <ToolButton label="Zoom in" onClick={() => setZoom((z) => Math.min(4, z + 0.5))} disabled={zoom >= 4}>
                <ZoomIn className="h-4 w-4" />
              </ToolButton>
              <ToolButton label="Rotate" onClick={() => setRotation((r) => (r + 90) % 360)}>
                <RotateCw className="h-4 w-4" />
              </ToolButton>
            </div>
          )}
          <a
            href={src}
            download={doc.fileName}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-medium text-foreground transition hover:border-primary/50"
          >
            <Download className="h-3.5 w-3.5" /> Download
          </a>
        </div>

        <div className="relative min-h-0 flex-1 bg-muted/40">
          {!loaded && !failed && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" /> Opening…
            </div>
          )}

          {failed ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <FileText className="h-10 w-10 text-muted-foreground" />
              <p className="max-w-sm text-sm text-muted-foreground">
                {/heic|heif/i.test(doc.mimeType)
                  ? "This browser can't show iPhone HEIC photos. Download it to view, or open Edge in Safari."
                  : "This document couldn't be shown here. Download it to view."}
              </p>
            </div>
          ) : image ? (
            <div className="h-full overflow-auto">
              <div className="flex min-h-full min-w-full items-center justify-center p-4" style={{ width: `${zoom * 100}%`, height: zoom > 1 ? `${zoom * 100}%` : undefined }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- an owner-only, uncached API image, not a static asset */}
                <img
                  key={doc.id}
                  src={src}
                  alt={doc.fileName}
                  onLoad={() => setLoaded(true)}
                  onError={() => setFailed(true)}
                  draggable={false}
                  className={cn("max-h-full max-w-full select-none rounded-md bg-white object-contain shadow-md transition-transform duration-200", zoom > 1 && "max-h-none max-w-none")}
                  style={{ transform: `rotate(${rotation}deg)`, width: zoom > 1 ? "100%" : undefined }}
                />
              </div>
            </div>
          ) : isPdf(doc.mimeType) && pdfUrl ? (
            <iframe src={pdfUrl} title={doc.fileName} className="h-full w-full border-0 bg-white" />
          ) : null}

          {docs.length > 1 && (
            <>
              <NavButton side="left" label="Previous document" onClick={() => go(-1)} />
              <NavButton side="right" label="Next document" onClick={() => go(1)} />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NavButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground shadow-md ring-1 ring-border transition hover:bg-card",
        side === "left" ? "left-3" : "right-3",
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
