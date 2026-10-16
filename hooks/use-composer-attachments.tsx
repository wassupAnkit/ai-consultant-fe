"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AttachmentUploadError, selectAttachments, uploadAttachment } from "@/lib/edge/attachments";
import type { AttachmentView } from "@/lib/edge/types";
import { track } from "@/lib/analytics";

/** One file in the composer: uploading as soon as it is added, then ready to send or failed. */
export interface ComposerAttachment {
  key: string;
  name: string;
  size: number;
  type: string;
  status: "uploading" | "done" | "error";
  /** 0..1 while uploading. */
  progress: number;
  view?: AttachmentView;
  error?: string;
  /** A local blob: preview of an image the browser can draw, for the chip's thumbnail. Revoked on remove/send. */
  previewUrl?: string;
}

const PREVIEWABLE = ["image/jpeg", "image/png", "image/webp"];
const revoke = (a: ComposerAttachment) => a.previewUrl && URL.revokeObjectURL(a.previewUrl);

let counter = 0;

/**
 * Files attached to the message being written. Each uploads the moment it is added (pick, drop
 * or paste), so by the time the counsellor presses Send only ids travel with the message.
 * Removing a chip cancels its upload; unmounting the composer cancels all of them.
 */
export function useComposerAttachments(sessionId: string | null) {
  const [items, setItems] = useState<ComposerAttachment[]>([]);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const aborts = useRef(new Map<string, AbortController>());
  const sessionRef = useRef(sessionId);
  sessionRef.current = sessionId;

  const update = useCallback((key: string, patch: Partial<ComposerAttachment>) => {
    setItems((list) => list.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }, []);

  const add = useCallback(
    (files: File[] | FileList) => {
      const list = Array.from(files);
      if (!list.length) return;
      const { accepted, errors } = selectAttachments(list, itemsRef.current.length);
      for (const message of errors) toast.error(message);
      if (!accepted.length) return;
      const added = accepted.map<[File, ComposerAttachment]>((file) => [
        file,
        {
          key: `att-${Date.now().toString(36)}-${(counter++).toString(36)}`,
          name: file.name,
          size: file.size,
          type: file.type,
          status: "uploading",
          progress: 0,
          ...(PREVIEWABLE.includes(file.type) ? { previewUrl: URL.createObjectURL(file) } : {}),
        },
      ]);
      // Counted against the limit straight away, before React re-renders.
      itemsRef.current = [...itemsRef.current, ...added.map(([, a]) => a)];
      setItems(itemsRef.current);
      for (const [file, item] of added) {
        const controller = new AbortController();
        aborts.current.set(item.key, controller);
        uploadAttachment(file, { sessionId: sessionRef.current, signal: controller.signal, onProgress: (progress) => update(item.key, { progress }) })
          .then((view) => {
            update(item.key, { status: "done", progress: 1, view });
            track("attachment_upload", { sessionId: sessionRef.current, mimeType: view.mimeType, sizeBytes: view.sizeBytes });
          })
          .catch((err: unknown) => {
            if ((err as Error).name === "AbortError") return;
            const message = err instanceof AttachmentUploadError ? err.message : "Upload failed.";
            update(item.key, { status: "error", error: message });
            track("attachment_upload_error", { sessionId: sessionRef.current, status: err instanceof AttachmentUploadError ? err.status : null });
          })
          .finally(() => aborts.current.delete(item.key));
      }
    },
    [update],
  );

  const remove = useCallback((key: string) => {
    aborts.current.get(key)?.abort();
    aborts.current.delete(key);
    itemsRef.current.filter((a) => a.key === key).forEach(revoke);
    itemsRef.current = itemsRef.current.filter((a) => a.key !== key);
    setItems(itemsRef.current);
  }, []);

  /** Hand over the uploaded files for sending and empty the composer. */
  const take = useCallback((): AttachmentView[] => {
    const views = itemsRef.current.flatMap((a) => (a.status === "done" && a.view ? [a.view] : []));
    itemsRef.current.forEach(revoke);
    itemsRef.current = [];
    setItems([]);
    return views;
  }, []);

  useEffect(() => {
    const pending = aborts.current;
    const current = itemsRef;
    return () => {
      for (const c of pending.values()) c.abort();
      pending.clear();
      current.current.forEach(revoke);
    };
  }, []);

  const uploading = items.some((a) => a.status === "uploading");
  const ready = items.filter((a) => a.status === "done").length;
  /** Files that failed to upload: sending waits until each is removed (or re-added), never drops them silently. */
  const failed = items.filter((a) => a.status === "error").map((a) => a.name);
  return { items, add, remove, take, uploading, ready, failed };
}
