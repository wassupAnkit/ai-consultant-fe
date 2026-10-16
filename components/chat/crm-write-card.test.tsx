import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { CrmWriteProposalView } from "@/lib/edge/types";
import { ChangesTable, CrmWriteCard } from "./crm-write-card";

const base: CrmWriteProposalView = {
  proposalId: "p1",
  requestId: "r1",
  tool: "crm_update_contact",
  target: { entity: "contact", id: "c1", label: "Sita Sharma" },
  changes: [
    { field: "passportNo", label: "Passport number", before: null, after: "PA0000001" },
    { field: "dateOfBirth", label: "Date of birth", before: null, after: "2001-04-12" },
  ],
  status: "pending",
  expiresAt: "2099-01-01T00:00:00.000Z",
};

const render = (view: CrmWriteProposalView) => renderToStaticMarkup(<CrmWriteCard view={view} onDecide={() => {}} />);

describe("CrmWriteCard", () => {
  test("a pending contact update offers Edit next to Approve and Reject", () => {
    const html = render(base);
    expect(html).toContain(">Approve<");
    expect(html).toContain(">Reject<");
    expect(html).toContain(">Edit<");
  });

  test("no Edit on tools whose changes aren't arguments, or once decided", () => {
    expect(render({ ...base, tool: "crm_create_note", target: { entity: "note", id: null, label: "Sita Sharma" } })).not.toContain(">Edit<");
    expect(render({ ...base, status: "applied" })).not.toContain(">Edit<");
  });

  test("a document attachment is titled Attach file", () => {
    const html = render({
      ...base,
      tool: "crm_attach_contact_document",
      target: { entity: "document", id: "c1", label: "Sita Sharma", parentLabel: "Passport" },
      changes: [{ field: "document", label: "Passport", before: null, after: "passport.jpg" }],
    });
    expect(html).toContain("Attach file");
    expect(html).toContain("Sita Sharma · Passport");
    expect(html).not.toContain(">Edit<");
  });

  test("edited values are listed after the decision", () => {
    const html = render({ ...base, status: "applied", edited: [{ field: "passportNo", from: "PA0000001", to: "PA0000002" }] });
    expect(html).toContain("You changed Passport number from PA0000001 to PA0000002");
    expect(html).toContain("Applied");
  });
});

describe("ChangesTable in edit mode", () => {
  test("each after value is an input holding its draft, with a date error when malformed", () => {
    const html = renderToStaticMarkup(<ChangesTable changes={base.changes} valueOnly={false} drafts={{ passportNo: "PA0000002", dateOfBirth: "12/04/2001" }} onDraft={() => {}} />);
    expect(html.match(/<input/g)?.length).toBe(2);
    expect(html).toContain('value="PA0000002"');
    expect(html).toContain('aria-label="New Passport number"');
    expect(html).toContain("Use YYYY-MM-DD");
  });

  test("without drafts it is the read-only before → after table", () => {
    const html = renderToStaticMarkup(<ChangesTable changes={base.changes} valueOnly={false} />);
    expect(html).not.toContain("<input");
    expect(html).toContain("PA0000001");
  });
});
