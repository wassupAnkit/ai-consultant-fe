import { afterEach, describe, expect, test } from "bun:test";
import { ATTACHMENT_MAX_BYTES, attachmentType, formatBytes, MAX_ATTACHMENTS, s3ErrorStatus, selectAttachments, upsertDocument, uploadAttachment, uploadErrorMessage, validateAttachment } from "./attachments";
import type { DocumentExtractionView } from "./types";

const file = (name: string, type: string, size = 200_000) => ({ name, type, size });

describe("attachmentType", () => {
  test("accepts every type the backend reads", () => {
    for (const [name, type] of [
      ["p.pdf", "application/pdf"],
      ["p.jpg", "image/jpeg"],
      ["p.png", "image/png"],
      ["p.webp", "image/webp"],
      ["p.heic", "image/heic"],
      ["p.heif", "image/heif"],
    ]) {
      expect(attachmentType(file(name!, type!))).toBe(type!);
    }
  });

  test("falls back to the extension when the browser left the type blank", () => {
    expect(attachmentType(file("IMG_0001.HEIC", ""))).toBe("image/heic");
    expect(attachmentType(file("scan.pdf", "application/octet-stream"))).toBe("application/pdf");
  });

  test("refuses other types even with an allowed extension", () => {
    expect(attachmentType(file("passport.pdf", "text/html"))).toBeNull();
    expect(attachmentType(file("notes.docx", ""))).toBeNull();
    expect(attachmentType(file("anim.gif", "image/gif"))).toBeNull();
  });
});

describe("validateAttachment", () => {
  test("passes a normal passport scan", () => {
    expect(validateAttachment(file("passport.jpg", "image/jpeg"))).toBeNull();
  });

  test("allows exactly 10 MB and refuses one byte more", () => {
    expect(validateAttachment(file("a.pdf", "application/pdf", ATTACHMENT_MAX_BYTES))).toBeNull();
    expect(validateAttachment(file("a.pdf", "application/pdf", ATTACHMENT_MAX_BYTES + 1))).toContain("limit is 10 MB");
  });

  test("refuses an unsupported type and an empty file", () => {
    expect(validateAttachment(file("cv.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toContain("only PDF, JPEG, PNG, WebP or HEIC");
    expect(validateAttachment(file("a.png", "image/png", 0))).toContain("empty");
  });
});

describe("selectAttachments", () => {
  test(`keeps at most ${MAX_ATTACHMENTS} per message, counting those already attached`, () => {
    const files = Array.from({ length: 4 }, (_, i) => file(`p${i}.png`, "image/png"));
    const { accepted, errors } = selectAttachments(files, 3);
    expect(accepted.map((f) => f.name)).toEqual(["p0.png", "p1.png"]);
    expect(errors).toEqual([`Up to ${MAX_ATTACHMENTS} files per message; 2 more were not attached.`]);
  });

  test("invalid files are reported and do not use up a slot", () => {
    const { accepted, errors } = selectAttachments([file("big.pdf", "application/pdf", ATTACHMENT_MAX_BYTES + 1), file("ok.pdf", "application/pdf")], 4);
    expect(accepted.map((f) => f.name)).toEqual(["ok.pdf"]);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("big.pdf");
  });

  test("nothing over the limit when the message is full", () => {
    const { accepted, errors } = selectAttachments([file("a.pdf", "application/pdf")], MAX_ATTACHMENTS);
    expect(accepted).toEqual([]);
    expect(errors[0]).toContain("1 more was not attached");
  });
});

describe("formatBytes / uploadErrorMessage", () => {
  test("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(200 * 1024)).toBe("200 KB");
    expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
    expect(formatBytes(ATTACHMENT_MAX_BYTES)).toBe("10 MB");
  });

  test("words the backend's refusals for the counsellor", () => {
    expect(uploadErrorMessage(413)).toBe("Too large: the limit is 10 MB.");
    expect(uploadErrorMessage(415)).toBe("Edge can't read this file type.");
    expect(uploadErrorMessage(500, "Storage unavailable")).toBe("Storage unavailable");
    expect(uploadErrorMessage(502)).toBe("Upload failed (HTTP 502).");
  });
});

describe("upsertDocument", () => {
  const doc = (attachmentId: string, holderName: string | null = null): DocumentExtractionView => ({
    attachmentId,
    fileName: `${attachmentId}.jpg`,
    documentType: "passport",
    crmDocumentType: "Passport",
    country: "Nepal",
    holderName,
    fields: [],
    warnings: [],
  });

  test("appends new attachments in order and replaces by attachmentId", () => {
    let list = upsertDocument(undefined, doc("a"));
    list = upsertDocument(list, doc("b"));
    list = upsertDocument(list, doc("a", "SITA SHARMA"));
    expect(list.map((d) => d.attachmentId)).toEqual(["a", "b"]);
    expect(list[0]!.holderName).toBe("SITA SHARMA");
  });
});

describe("uploadAttachment (direct to S3)", () => {
  type Sent = { url: string; body: FormData };
  const realFetch = globalThis.fetch;
  const realXhr = (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
  let posted: Sent[] = [];
  let calls: { url: string; body: unknown }[] = [];

  /** A minimal XHR: answers every POST with `reply(url)` and reports full progress. */
  function fakeXhr(reply: (url: string) => { status: number; text: string }) {
    return class {
      status = 0;
      responseText = "";
      responseType = "";
      upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
      onload?: () => void;
      onerror?: () => void;
      onabort?: () => void;
      private url = "";
      open(_m: string, url: string) {
        this.url = url;
      }
      send(body: FormData) {
        posted.push({ url: this.url, body });
        this.upload.onprogress?.({ lengthComputable: true, loaded: 10, total: 10 });
        const r = reply(this.url);
        this.status = r.status;
        this.responseText = r.text;
        this.onload?.();
      }
      abort() {}
    };
  }

  function fakeFetch(routes: Record<string, { status: number; body: unknown }>) {
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const r = routes[url];
      return new Response(JSON.stringify(r?.body ?? {}), { status: r?.status ?? 500 });
    }) as typeof fetch;
  }

  afterEach(() => {
    globalThis.fetch = realFetch;
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = realXhr;
    posted = [];
    calls = [];
  });

  const file = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "passport.png", { type: "image/png" });
  const view = { id: "a1", fileName: "passport.png", mimeType: "image/png", sizeBytes: 4, sha256: "x", createdAt: "2026-10-12T00:00:00Z" };

  test("slot → file to S3 (fields first, file last) → complete", async () => {
    fakeFetch({
      "/api/chat/attachments/uploads": { status: 201, body: { uploadId: "u1", url: "https://b.s3.example.com/", fields: { key: "incoming/u1", Policy: "p", "Content-Type": "image/png" }, ticket: "t.s" } },
      "/api/chat/attachments/uploads/complete": { status: 201, body: { attachment: view } },
    });
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = fakeXhr(() => ({ status: 204, text: "" }));
    const progress: number[] = [];
    const out = await uploadAttachment(file(), { sessionId: "s1", onProgress: (p) => progress.push(p) });

    expect(out).toEqual(view);
    expect(calls[0]).toEqual({ url: "/api/chat/attachments/uploads", body: { fileName: "passport.png", mimeType: "image/png", sizeBytes: 4, sessionId: "s1" } });
    expect(posted[0]!.url).toBe("https://b.s3.example.com/");
    expect([...posted[0]!.body.keys()]).toEqual(["key", "Policy", "Content-Type", "file"]);
    expect(calls[1]).toEqual({ url: "/api/chat/attachments/uploads/complete", body: { ticket: "t.s" } });
    expect(progress.at(-1)).toBe(1);
  });

  test("no bucket configured → the multipart route", async () => {
    fakeFetch({ "/api/chat/attachments/uploads": { status: 503, body: { error: { code: "direct_upload_disabled", message: "off" } } } });
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = fakeXhr(() => ({ status: 201, text: JSON.stringify({ attachment: view }) }));
    expect(await uploadAttachment(file(), { sessionId: "s1" })).toEqual(view);
    expect(posted[0]!.url).toBe("/api/chat/attachments");
    expect(posted[0]!.body.get("sessionId")).toBe("s1");

    // A backend from before direct upload has no such route.
    posted = [];
    fakeFetch({ "/api/chat/attachments/uploads": { status: 404, body: { error: { code: "not_found" } } } });
    expect(await uploadAttachment(file())).toEqual(view);
    expect(posted[0]!.url).toBe("/api/chat/attachments");
  });

  test("S3 refusing the size reads as the 10 MB limit; a refused slot keeps the backend's status", async () => {
    fakeFetch({ "/api/chat/attachments/uploads": { status: 201, body: { uploadId: "u1", url: "https://b.s3.example.com/", fields: {}, ticket: "t.s" } } });
    (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = fakeXhr(() => ({ status: 400, text: "<Error><Code>EntityTooLarge</Code></Error>" }));
    await expect(uploadAttachment(file())).rejects.toMatchObject({ status: 413, message: "Too large: the limit is 10 MB." });

    fakeFetch({ "/api/chat/attachments/uploads": { status: 415, body: { error: { code: "unsupported_type", message: "Attach a PDF or an image." } } } });
    await expect(uploadAttachment(file())).rejects.toMatchObject({ status: 415 });
  });

  test("s3ErrorStatus", () => {
    expect(s3ErrorStatus(400, "<Code>EntityTooLarge</Code>")).toBe(413);
    expect(s3ErrorStatus(403, "<Message>Invalid according to Policy: Policy Condition failed: [\"eq\", \"$Content-Type\", \"image/png\"]</Message>")).toBe(415);
    expect(s3ErrorStatus(403, "<Code>AccessDenied</Code>")).toBe(403);
  });
});
