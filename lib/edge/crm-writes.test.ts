import { describe, expect, test } from "bun:test";
import { canEditProposal, draftsFrom, editedLines, editError, editsFromDrafts, expireAll, formatValue, isDecidable, statusLabel, upsertProposal } from "./crm-writes";
import type { CrmWriteProposalView } from "./types";

function view(overrides: Partial<CrmWriteProposalView> = {}): CrmWriteProposalView {
  return {
    proposalId: "p1",
    requestId: "r1",
    tool: "crm_update_contact",
    target: { entity: "contact", id: "c1", label: "Aashish Dhakal" },
    changes: [{ field: "phone", label: "Phone", before: "0400 000 000", after: "0401 111 222" }],
    status: "pending",
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
    ...overrides,
  };
}

describe("upsertProposal", () => {
  test("appends two different ids in order", () => {
    let list = upsertProposal(undefined, view({ proposalId: "a" }));
    list = upsertProposal(list, view({ proposalId: "b" }));
    expect(list.map((v) => v.proposalId)).toEqual(["a", "b"]);
  });

  test("replaces an existing id in place", () => {
    let list = upsertProposal(undefined, view({ proposalId: "a" }));
    list = upsertProposal(list, view({ proposalId: "b" }));
    list = upsertProposal(list, view({ proposalId: "a", status: "applied" }));
    expect(list.map((v) => v.proposalId)).toEqual(["a", "b"]);
    expect(list[0]!.status).toBe("applied");
  });
});

describe("isDecidable", () => {
  test("false at expiresAt itself", () => {
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");
    expect(isDecidable(view({ expiresAt: expiresAt.toISOString() }), expiresAt)).toBe(false);
  });

  test("false for applied", () => {
    expect(isDecidable(view({ status: "applied" }), new Date())).toBe(false);
  });

  test("true for pending before expiry", () => {
    expect(isDecidable(view({ status: "pending" }), new Date())).toBe(true);
  });
});

describe("expireAll", () => {
  test("leaves applied alone and turns pending into expired", () => {
    const result = expireAll([view({ proposalId: "a", status: "pending" }), view({ proposalId: "b", status: "applied" })], new Date());
    expect(result?.map((v) => v.status)).toEqual(["expired", "applied"]);
  });

  test("passes undefined through unchanged", () => {
    expect(expireAll(undefined, new Date())).toBeUndefined();
  });
});

describe("statusLabel", () => {
  test("returns exact copy for every terminal status", () => {
    expect(statusLabel(view({ status: "pending" }))).toBe("Waiting for your approval");
    expect(statusLabel(view({ status: "applying" }))).toBe("Applying…");
    expect(statusLabel(view({ status: "applied" }))).toBe("Applied");
    expect(statusLabel(view({ status: "rejected" }))).toBe("Rejected");
    expect(statusLabel(view({ status: "expired" }))).toBe("Expired, not applied");
    expect(statusLabel(view({ status: "stale" }))).toBe("Not applied: the record changed");
  });

  test("includes the error text for failed", () => {
    expect(statusLabel(view({ status: "failed", error: "network error" }))).toBe("Failed: network error");
  });
});

describe("formatValue", () => {
  test("null becomes (empty)", () => {
    expect(formatValue(null)).toBe("(empty)");
  });

  test("booleans become Yes/No", () => {
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(false)).toBe("No");
  });

  test("numbers and strings pass through as strings", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue("Sydney")).toBe("Sydney");
  });
});

describe("editable approval", () => {
  const contact = () =>
    view({
      changes: [
        { field: "passportNo", label: "Passport number", before: null, after: "PA0000001" },
        { field: "dateOfBirth", label: "Date of birth", before: "2001-04-21", after: "2001-04-12" },
        { field: "gender", label: "Gender", before: null, after: "Female" },
      ],
    });

  test("only pending crm_update_contact cards are editable", () => {
    const now = new Date();
    expect(canEditProposal(contact(), now)).toBe(true);
    expect(canEditProposal(view({ tool: "crm_create_note" }), now)).toBe(false);
    expect(canEditProposal(view({ tool: "crm_attach_contact_document" }), now)).toBe(false);
    expect(canEditProposal(contact(), new Date(Date.now() + 120_000))).toBe(false);
    expect(canEditProposal({ ...contact(), status: "applied" }, now)).toBe(false);
  });

  test("drafts start as the proposed values, null as empty", () => {
    expect(draftsFrom([...contact().changes, { field: "x", label: "X", before: null, after: null }, { field: "y", label: "Y", before: null, after: true }])).toEqual({
      passportNo: "PA0000001",
      dateOfBirth: "2001-04-12",
      gender: "Female",
      x: "",
      y: "Yes",
    });
  });

  test("edits hold only what changed; untouched drafts send nothing", () => {
    const changes = contact().changes;
    expect(editsFromDrafts(changes, draftsFrom(changes))).toEqual({});
    expect(editsFromDrafts(changes, { ...draftsFrom(changes), passportNo: " PA0000002 ", gender: "" })).toEqual({ passportNo: "PA0000002", gender: null });
  });

  test("numbers and yes/no keep their type", () => {
    const changes = [
      { field: "n", label: "N", before: 1, after: 2 },
      { field: "b", label: "B", before: false, after: true },
    ];
    expect(editsFromDrafts(changes, { n: "3", b: "no" })).toEqual({ n: 3, b: false });
    expect(editsFromDrafts(changes, { n: "2", b: "Yes" })).toEqual({});
  });

  test("dates must stay YYYY-MM-DD", () => {
    const dob = contact().changes[1]!;
    expect(editError(dob, "2001-04-13")).toBeNull();
    expect(editError(dob, "")).toBe("Can't be empty (reject the card to keep the CRM value)");
    expect(editError(dob, "12/04/2001")).toBe("Use YYYY-MM-DD");
  });

  test("edited rows read as sentences after the decision", () => {
    const decided = { ...contact(), status: "applied" as const, edited: [{ field: "passportNo", from: "PA0000001", to: "PA0000002" }, { field: "gender", from: "Female", to: null }] };
    expect(editedLines(decided)).toEqual(["You changed Passport number from PA0000001 to PA0000002", "You changed Gender from Female to (empty)"]);
    expect(editedLines(contact())).toEqual([]);
  });
});
