import { describe, expect, test } from "bun:test";
import { detectCallout, leadingText } from "./callouts";

describe("detectCallout", () => {
  test("recognises the three fixed phrases, with or without emphasis", () => {
    expect(detectCallout("Not in the knowledge base: 2026 tuition for the Monash MIT.")).toEqual({ kind: "gap", label: "Not in the knowledge base", body: "2026 tuition for the Monash MIT." });
    expect(detectCallout("**Not in the knowledge base:** the July intake")).toMatchObject({ kind: "gap", body: "the July intake" });
    expect(detectCallout("General note, unsourced: most Group of Eight universities require 6.5.")).toMatchObject({ kind: "note" });
    expect(detectCallout("Based on: [1][3]")).toEqual({ kind: "basis", label: "Based on", body: "[1][3]" });
  });

  test("is case-insensitive and tolerates a still-streaming body", () => {
    expect(detectCallout("not in the knowledge base:")).toMatchObject({ kind: "gap", body: "" });
  });

  test("ignores ordinary prose that starts with the same words", () => {
    expect(detectCallout("Based on your notes, the student prefers Melbourne.")).toBeNull();
    expect(detectCallout("The knowledge base lists three scholarships.")).toBeNull();
    expect(detectCallout("")).toBeNull();
  });
});

describe("leadingText", () => {
  test("reads strings, arrays and element children in order", () => {
    const strong = { props: { children: "Not in the knowledge base:" } };
    expect(leadingText([strong, " fees for 2026"])).toBe("Not in the knowledge base: fees for 2026");
    expect(leadingText("plain")).toBe("plain");
    expect(leadingText(null)).toBe("");
  });

  test("stops at the limit", () => {
    expect(leadingText("x".repeat(200), 10)).toHaveLength(10);
  });
});
