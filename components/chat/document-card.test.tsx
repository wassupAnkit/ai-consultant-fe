import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { DocumentExtractionView } from "@/lib/edge/types";
import { MessageAttachments } from "./attachment-chip";
import { DocumentCard, documentLabel } from "./document-card";

// Synthetic document: no real student's data.
const doc: DocumentExtractionView = {
  attachmentId: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b",
  fileName: "passport-scan.jpg",
  documentType: "passport",
  crmDocumentType: "Passport",
  country: "Nepal",
  holderName: "SITA SHARMA",
  fields: [
    { key: "passportNo", label: "Passport number", value: "PA0000001", confidence: "high", source: "mrz" },
    { key: "placeOfBirth", label: "Place of birth", value: "Kathmandu", confidence: "low", source: "visual" },
  ],
  warnings: [{ code: "expires_within_12_months", message: "The passport expires on 2027-03-01, within 12 months." }],
};

describe("DocumentCard", () => {
  test("shows label, country, file, fields with MRZ badge and confidence, and warnings", () => {
    const html = renderToStaticMarkup(<DocumentCard doc={doc} />);
    expect(html).toContain("Passport");
    expect(html).toContain("· Nepal");
    expect(html).toContain("passport-scan.jpg");
    expect(html).toContain(`/api/chat/attachments/${doc.attachmentId}/content`);
    expect(html).toContain("PA0000001");
    expect(html.match(/>MRZ</g)?.length).toBe(1);
    expect(html).toContain("High confidence");
    expect(html).toContain("Low confidence");
    expect(html).toContain("within 12 months");
  });

  test("label falls back to the document type", () => {
    expect(documentLabel({ ...doc, crmDocumentType: null, documentType: "national_id" })).toBe("National ID");
    expect(documentLabel({ ...doc, crmDocumentType: null, documentType: "other" })).toBe("Document");
  });

  test("a file Edit could not read says so", () => {
    const html = renderToStaticMarkup(<DocumentCard doc={{ ...doc, fields: [], warnings: [{ code: "unreadable", message: "The file could not be read." }] }} />);
    expect(html).toContain("No fields could be read");
    expect(html).toContain("could not be read.");
  });
});

describe("documents stay in the chat", () => {
  test("the card's scan and file name open the in-app viewer, never a new tab", () => {
    const html = renderToStaticMarkup(<DocumentCard doc={doc} />);
    expect(html).not.toContain('target="_blank"');
    expect(html).toContain(`aria-label="View ${doc.fileName}"`);
  });

  test("files sent with a question render as thumbnails (images) and tiles (PDFs)", () => {
    const html = renderToStaticMarkup(
      <MessageAttachments
        attachments={[
          { id: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b", fileName: "passport.jpg", mimeType: "image/jpeg", sizeBytes: 120_000, sha256: "x", createdAt: "2026-10-12T00:00:00Z" },
          { id: "7f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4c", fileName: "transcript.pdf", mimeType: "application/pdf", sizeBytes: 300_000, sha256: "y", createdAt: "2026-10-12T00:00:00Z" },
        ]}
      />,
    );
    expect(html).toContain('<img src="/api/chat/attachments/6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b/content"');
    expect(html).toContain("transcript.pdf");
    expect(html).toContain("PDF");
    expect(html).not.toContain("<a ");
  });
});
