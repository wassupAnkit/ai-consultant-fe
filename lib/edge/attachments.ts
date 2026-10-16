import type { AttachmentView, DocumentExtractionView } from "./types";

/**
 * Student documents attached in chat (document intake, Phase 1). The rules here mirror the Edge
 * backend's `POST /v1/chat/attachments` contract so a file the backend would refuse is refused in
 * the browser first, before any bytes leave the counsellor's machine. The backend still checks.
 */

/** Types the backend accepts. HEIC/HEIF are what iPhones save photos of a passport as. */
export const ATTACHMENT_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
/** The file picker's `accept`. `.heic/.heif` too: Windows often has no MIME mapping for them, and would hide them otherwise. */
export const ATTACHMENT_ACCEPT = [...ATTACHMENT_TYPES, ".heic", ".heif"].join(",");
/** `STUDENT_DOC_MAX_BYTES`: 10 MB, the CRM's own limit. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Most files one message may carry (the chat request's `attachments` limit). */
export const MAX_ATTACHMENTS = 5;
/** Sent as the message when the counsellor attached files but typed nothing. */
export const DEFAULT_ATTACHMENT_MESSAGE = "Read the attached documents.";

const EXTENSION_TYPES: Record<string, (typeof ATTACHMENT_TYPES)[number]> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/** The minimal File shape the checks read; lets tests pass plain objects. */
export interface FileLike {
  name: string;
  type: string;
  size: number;
}

/**
 * The file's MIME type, or the one its extension implies when the browser left `type` empty
 * (Chrome and Firefox on Windows/Linux report HEIC as ""). Null when it is not a type Edge reads.
 */
export function attachmentType(file: FileLike): string | null {
  const type = file.type.toLowerCase();
  if ((ATTACHMENT_TYPES as readonly string[]).includes(type)) return type;
  if (type && type !== "application/octet-stream") return null;
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  return EXTENSION_TYPES[ext] ?? null;
}

/** Why this file can't be attached, or null when it can. */
export function validateAttachment(file: FileLike): string | null {
  if (!attachmentType(file)) return `${file.name}: only PDF, JPEG, PNG, WebP or HEIC files can be attached.`;
  if (file.size === 0) return `${file.name} is empty.`;
  if (file.size > ATTACHMENT_MAX_BYTES) return `${file.name} is ${formatBytes(file.size)}; the limit is 10 MB.`;
  return null;
}

/**
 * Split a drop/paste/pick into the files to upload and the reasons the rest were refused,
 * given how many the message already carries. Files past the per-message limit are refused
 * in one line rather than one toast each.
 */
export function selectAttachments<T extends FileLike>(files: readonly T[], alreadyAttached: number): { accepted: T[]; errors: string[] } {
  const accepted: T[] = [];
  const errors: string[] = [];
  let overLimit = 0;
  for (const file of files) {
    const error = validateAttachment(file);
    if (error) {
      errors.push(error);
      continue;
    }
    if (alreadyAttached + accepted.length >= MAX_ATTACHMENTS) {
      overLimit++;
      continue;
    }
    accepted.push(file);
  }
  if (overLimit) errors.push(`Up to ${MAX_ATTACHMENTS} files per message; ${overLimit} more ${overLimit === 1 ? "was" : "were"} not attached.`);
  return { accepted, errors };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  const mb = bytes / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** The owner-only preview of an attachment, opened in a new tab. */
export function attachmentContentUrl(id: string): string {
  return `/api/chat/attachments/${encodeURIComponent(id)}/content`;
}

/** Replace the extraction for this attachment in place, or append it; the list never reorders. */
export function upsertDocument(list: DocumentExtractionView[] | undefined, doc: DocumentExtractionView): DocumentExtractionView[] {
  const current = list ?? [];
  const index = current.findIndex((d) => d.attachmentId === doc.attachmentId);
  if (index === -1) return [...current, doc];
  const next = [...current];
  next[index] = doc;
  return next;
}

export class AttachmentUploadError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AttachmentUploadError";
  }
}

/** What the counsellor reads when an upload is refused, by status. */
export function uploadErrorMessage(status: number, backendMessage?: string): string {
  if (status === 413) return "Too large: the limit is 10 MB.";
  if (status === 415) return "Edge can't read this file type.";
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 0) return "Upload failed: check your connection.";
  return backendMessage || `Upload failed (HTTP ${status}).`;
}

/** One XHR POST with upload progress (only XHR reports it); resolves with the status and body text. */
function postWithProgress(
  url: string,
  body: FormData,
  options: { onProgress?: (fraction: number) => void; signal?: AbortSignal },
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) options.onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText ?? "" });
    xhr.onerror = () => reject(new AttachmentUploadError(0, uploadErrorMessage(0)));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    if (options.signal) {
      if (options.signal.aborted) {
        reject(new DOMException("Upload cancelled", "AbortError"));
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }
    xhr.send(body);
  });
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function errorOf(status: number, parsed: Record<string, unknown> | null): AttachmentUploadError {
  const err = parsed?.error as string | { message?: string } | undefined;
  return new AttachmentUploadError(status, uploadErrorMessage(status, typeof err === "string" ? err : err?.message));
}

/** S3 answers a refused POST with XML; the only refusals a counsellor can act on are size and type. */
export function s3ErrorStatus(status: number, xml: string): number {
  if (/EntityTooLarge/.test(xml)) return 413;
  if (/Policy Condition failed[^<]*Content-Type/i.test(xml)) return 415;
  return status;
}

interface UploadSlot {
  uploadId: string;
  url: string;
  fields: Record<string, string>;
  ticket: string;
}

/**
 * Upload one file. In production the file goes straight from the browser to S3, because the
 * load balancer's firewall blocks binary request bodies:
 *  1. `POST /api/chat/attachments/uploads` (JSON) → a presigned S3 POST and a ticket;
 *  2. the file is posted to S3 (progress reported, up to 95%);
 *  3. `POST /api/chat/attachments/uploads/complete` → the stored attachment.
 * Where no bucket is configured (503 `direct_upload_disabled`, local development) it falls back
 * to the multipart route. The file is re-wrapped with the type its extension implies when the
 * browser left it blank, so the backend's type check sees `image/heic`, not octet-stream.
 */
export async function uploadAttachment(
  file: File,
  options: { sessionId?: string | null; onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<AttachmentView> {
  const type = attachmentType(file) || file.type;
  const typed = type && type !== file.type ? new File([file], file.name, { type }) : file;

  let start: Response;
  try {
    start = await fetch("/api/chat/attachments/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ fileName: file.name, mimeType: type, sizeBytes: file.size, ...(options.sessionId ? { sessionId: options.sessionId } : {}) }),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new DOMException("Upload cancelled", "AbortError");
    throw new AttachmentUploadError(0, uploadErrorMessage(0));
  }
  const started = parseJson(await start.text());
  const code = (started?.error as { code?: string } | undefined)?.code;
  // No bucket configured (503), or a backend from before direct upload (404): the multipart route.
  if ((start.status === 503 && code === "direct_upload_disabled") || start.status === 404) return uploadMultipart(typed, options);
  if (start.status !== 201 || !started) throw errorOf(start.status, started);
  const slot = started as unknown as UploadSlot;

  // S3 wants the policy fields first and the file last.
  const form = new FormData();
  for (const [k, v] of Object.entries(slot.fields)) form.append(k, v);
  form.append("file", typed);
  const sent = await postWithProgress(slot.url, form, { signal: options.signal, onProgress: (f) => options.onProgress?.(f * 0.95) });
  if (sent.status < 200 || sent.status >= 300) {
    const status = s3ErrorStatus(sent.status, sent.text);
    throw new AttachmentUploadError(status, uploadErrorMessage(status));
  }

  let done: Response;
  try {
    done = await fetch("/api/chat/attachments/uploads/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ticket: slot.ticket }),
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw new DOMException("Upload cancelled", "AbortError");
    throw new AttachmentUploadError(0, uploadErrorMessage(0));
  }
  const completed = parseJson(await done.text());
  if (done.status >= 200 && done.status < 300 && completed?.attachment) {
    options.onProgress?.(1);
    return completed.attachment as AttachmentView;
  }
  throw errorOf(done.status, completed);
}

/** The multipart route (`POST /api/chat/attachments`): local development, or no bucket configured. */
async function uploadMultipart(file: File, options: { sessionId?: string | null; onProgress?: (fraction: number) => void; signal?: AbortSignal }): Promise<AttachmentView> {
  const body = new FormData();
  body.append("file", file);
  if (options.sessionId) body.append("sessionId", options.sessionId);
  const r = await postWithProgress("/api/chat/attachments", body, options);
  const parsed = parseJson(r.text);
  if (r.status >= 200 && r.status < 300 && parsed?.attachment) return parsed.attachment as AttachmentView;
  throw errorOf(r.status, parsed);
}
