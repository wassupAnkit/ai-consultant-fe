import { afterEach, describe, expect, test } from "bun:test";
import { streamChat } from "./stream";
import type { CrmWriteProposalView, DocumentExtractionView } from "./types";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const doc: DocumentExtractionView = {
  attachmentId: "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b",
  fileName: "passport.jpg",
  documentType: "passport",
  crmDocumentType: "Passport",
  country: "Nepal",
  holderName: "SITA SHARMA",
  fields: [{ key: "dateOfBirth", label: "Date of birth", value: "2001-04-12", confidence: "high", source: "mrz" }],
  warnings: [],
};

const proposal = { proposalId: "p1", requestId: "r1", tool: "crm_update_contact", target: { entity: "contact", id: "c1", label: "Sita Sharma" }, changes: [], status: "pending", expiresAt: "2099-01-01T00:00:00.000Z" } as CrmWriteProposalView;

/** Serve these NDJSON lines, split mid-line so the parser's buffering is exercised too; record the request body. */
function serve(lines: unknown[]): { body: () => Record<string, unknown> } {
  let sent: Record<string, unknown> = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent = JSON.parse(String(init.body));
    const text = lines.map((l) => JSON.stringify(l)).join("\n") + "\n";
    const mid = Math.floor(text.length / 2);
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode(text.slice(0, mid)));
        c.enqueue(enc.encode(text.slice(mid)));
        c.close();
      },
    });
    return new Response(stream, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  }) as typeof fetch;
  return { body: () => sent };
}

describe("streamChat: document intake", () => {
  test("document_extraction reaches onDocument, before the proposal, in order", async () => {
    serve([
      { event: "meta", data: {} },
      { event: "document_extraction", data: doc },
      { event: "crm_write_proposal", data: proposal },
      { event: "token", data: { chunk: "Read." } },
      { event: "done", data: { sessionId: "s1", requestId: "r1", traceId: null, answer: "Read.", refused: false, intent: null, sources: [], disclaimer: null, latencyMs: 10 } },
    ]);
    const order: string[] = [];
    const docs: DocumentExtractionView[] = [];
    await streamChat({
      message: "Read the attached documents.",
      onToken: () => order.push("token"),
      onDocument: (d) => {
        docs.push(d);
        order.push("document");
      },
      onCrmWriteProposal: () => order.push("proposal"),
    });
    expect(docs).toEqual([doc]);
    expect(order).toEqual(["document", "proposal", "token"]);
  });

  test("sends attachment ids, and omits the field when there are none", async () => {
    const done = { event: "done", data: { sessionId: "s1", requestId: "r1", traceId: null, answer: "", refused: false, intent: null, sources: [], disclaimer: null, latencyMs: 1 } };
    let s = serve([done]);
    await streamChat({ message: "hi", attachments: [doc.attachmentId], onToken: () => {} });
    expect(s.body().attachments).toEqual([doc.attachmentId]);
    s = serve([done]);
    await streamChat({ message: "hi", attachments: [], onToken: () => {} });
    expect("attachments" in s.body()).toBe(false);
  });
});
