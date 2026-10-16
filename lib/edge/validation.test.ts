import { describe, expect, test } from "bun:test";
import { MAX_EDIT_KEYS, parseAttachmentIds, parseDecisionBody } from "./validation";

const ID = "6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a4b";
const ids = (n: number) => Array.from({ length: n }, (_, i) => `6f1d2c3b-4a5e-4f60-8a7b-9c0d1e2f3a${(10 + i).toString(16).padStart(2, "0")}`);

describe("parseAttachmentIds", () => {
  test("absent is fine and forwards nothing", () => {
    expect(parseAttachmentIds(undefined)).toEqual({ ok: true, value: undefined });
    expect(parseAttachmentIds([])).toEqual({ ok: true, value: undefined });
  });

  test("up to five uuids pass, duplicates collapse", () => {
    expect(parseAttachmentIds(ids(5))).toEqual({ ok: true, value: ids(5) });
    expect(parseAttachmentIds([ID, ID])).toEqual({ ok: true, value: [ID] });
  });

  test("refuses six, non-uuids and non-arrays", () => {
    expect(parseAttachmentIds(ids(6)).ok).toBe(false);
    expect(parseAttachmentIds(["passport.jpg"]).ok).toBe(false);
    expect(parseAttachmentIds(ID).ok).toBe(false);
    expect(parseAttachmentIds([42]).ok).toBe(false);
  });
});

describe("parseDecisionBody", () => {
  test("plain approve and reject pass unchanged", () => {
    expect(parseDecisionBody({ decision: "approve" })).toEqual({ ok: true, value: { decision: "approve" } });
    expect(parseDecisionBody({ decision: "reject" })).toEqual({ ok: true, value: { decision: "reject" } });
  });

  test("approve with flat edits forwards them", () => {
    const edits = { passportNo: "PA1234567", dateOfBirth: "2001-04-12", gender: null, age: 25, consent: true };
    expect(parseDecisionBody({ decision: "approve", edits })).toEqual({ ok: true, value: { decision: "approve", edits } });
  });

  test("empty edits are dropped", () => {
    expect(parseDecisionBody({ decision: "approve", edits: {} })).toEqual({ ok: true, value: { decision: "approve" } });
  });

  test("refuses a bad decision or a non-object body", () => {
    expect(parseDecisionBody({ decision: "maybe" }).ok).toBe(false);
    expect(parseDecisionBody([]).ok).toBe(false);
    expect(parseDecisionBody(null).ok).toBe(false);
  });

  test("refuses edits with reject", () => {
    expect(parseDecisionBody({ decision: "reject", edits: { firstName: "Sita" } })).toEqual({ ok: false, message: "edits are only allowed with approve" });
  });

  test("refuses nested values, arrays and non-finite numbers", () => {
    expect(parseDecisionBody({ decision: "approve", edits: { firstName: { first: "Sita" } } }).ok).toBe(false);
    expect(parseDecisionBody({ decision: "approve", edits: { firstName: ["Sita"] } }).ok).toBe(false);
    expect(parseDecisionBody({ decision: "approve", edits: ["Sita"] }).ok).toBe(false);
    expect(parseDecisionBody({ decision: "approve", edits: { age: Number.NaN } }).ok).toBe(false);
  });

  test(`refuses more than ${MAX_EDIT_KEYS} keys`, () => {
    const many = Object.fromEntries(Array.from({ length: MAX_EDIT_KEYS + 1 }, (_, i) => [`f${i}`, "x"]));
    expect(parseDecisionBody({ decision: "approve", edits: many }).ok).toBe(false);
    const max = Object.fromEntries(Array.from({ length: MAX_EDIT_KEYS }, (_, i) => [`f${i}`, "x"]));
    expect(parseDecisionBody({ decision: "approve", edits: max }).ok).toBe(true);
  });
});
