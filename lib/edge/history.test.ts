import { describe, expect, test } from "bun:test";
import { fromHistory } from "./history";
import type { AttachmentView, DocumentExtractionView, HistoryMessage } from "./types";

const base: HistoryMessage = { role: "human", content: "Read the attached documents.", intent: null, createdAt: "2026-10-12T08:00:00.000Z", sources: [], refused: false, disclaimer: null, requestId: null, traceId: null };

const attachment: AttachmentView = { id: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b", fileName: "passport.jpg", mimeType: "image/jpeg", sizeBytes: 812_345, sha256: "a".repeat(64), createdAt: "2026-10-12T07:59:00.000Z" };

const doc: DocumentExtractionView = {
  attachmentId: attachment.id,
  fileName: "passport.jpg",
  documentType: "passport",
  crmDocumentType: "Passport",
  country: "Nepal",
  holderName: "SITA SHARMA",
  fields: [{ key: "passportNo", label: "Passport number", value: "PA0000001", confidence: "high", source: "mrz" }],
  warnings: [{ code: "expires_within_12_months", message: "Expires on 2027-03-01." }],
};

describe("fromHistory: document intake", () => {
  test("a human turn keeps its attachments", () => {
    const m = fromHistory({ ...base, attachments: [attachment] }, 0);
    expect(m.role).toBe("user");
    expect(m.attachments).toEqual([attachment]);
    expect(m.documents).toBeUndefined();
  });

  test("an AI turn keeps its documents", () => {
    const m = fromHistory({ ...base, role: "ai", content: "Here is what I read.", documents: [doc] }, 1);
    expect(m.role).toBe("assistant");
    expect(m.documents).toEqual([doc]);
    expect(m.attachments).toBeUndefined();
  });

  test("turns from before document intake read as none", () => {
    expect(fromHistory(base, 0).attachments).toEqual([]);
    expect(fromHistory({ ...base, role: "ai" }, 1).documents).toEqual([]);
  });
});
