import { describe, expect, test } from "bun:test";
import type { CrmWriteChange, CrmWriteProposalView } from "./types";
import { calendarFields, fileFields, isCalendarProposal, isGoogleFileProposal, parseTsv, proposalLink, proposalStatusLabel, whenLabel } from "./workspace-proposals";

const c = (label: string, after: string): CrmWriteChange => ({ field: label.toLowerCase(), label, before: null, after });

describe("calendar proposals", () => {
  test("reads the backend's labels, including who gets an invite", () => {
    const f = calendarFields([c("Title", "Visa check-in"), c("Starts", "Fri 2 Oct 2026, 15:00"), c("Ends", "Fri 2 Oct 2026, 15:30"), c("Time zone", "Your calendar's time zone"), c("Invites emailed to", "priya@x.test, sam@y.test"), c("Google Meet", "Yes")]);
    expect(f).toMatchObject({ title: "Visa check-in", invites: ["priya@x.test", "sam@y.test"], meet: true, timeZone: "Your calendar's time zone" });
    expect(calendarFields([c("Title", "Focus")]).invites).toEqual([]);
  });

  test("a same-day event reads as one range", () => {
    expect(whenLabel("Fri 2 Oct 2026, 15:00", "Fri 2 Oct 2026, 15:30")).toBe("Fri 2 Oct 2026, 15:00 – 15:30");
    expect(whenLabel("Fri 2 Oct 2026 (all day)", "Sat 3 Oct 2026 (all day)")).toBe("Fri 2 Oct 2026 (all day) – Sat 3 Oct 2026 (all day)");
  });
});

describe("Doc and Sheet proposals", () => {
  const view = (changes: CrmWriteChange[], entity: string) => ({ changes, target: { entity, id: null, label: "Options" } }) as unknown as Pick<CrmWriteProposalView, "changes" | "target">;

  test("a Sheet preview parses from TSV, header first", () => {
    const f = fileFields(view([c("Type", "Google Sheet"), c("Title", "Options"), c("Rows", "2 rows × 2 columns"), c("Preview", "Course\tFee\nMIT\t48000")], "googleSheet"));
    expect(f).toMatchObject({ kind: "sheet", title: "Options", rowsLabel: "2 rows × 2 columns", rows: [["Course", "Fee"], ["MIT", "48000"]] });
  });

  test("a Doc keeps its content", () => {
    expect(fileFields(view([c("Type", "Google Doc"), c("Title", "GTE"), c("Content", "# A\n- b")], "googleDoc"))).toMatchObject({ kind: "doc", content: "# A\n- b" });
  });

  test("parseTsv caps the rows", () => {
    expect(parseTsv(Array.from({ length: 50 }, (_, i) => `r${i}`).join("\n"))).toHaveLength(20);
    expect(parseTsv(undefined)).toEqual([]);
  });
});

describe("routing, status and links", () => {
  test("providers and entities route to the right card", () => {
    expect(isCalendarProposal({ provider: "calendar", target: { entity: "calendarEvent", id: null, label: "x" } })).toBe(true);
    expect(isGoogleFileProposal({ provider: "docs", target: { entity: "googleSheet", id: null, label: "x" } })).toBe(true);
    expect(isCalendarProposal({ provider: "crm", target: { entity: "contact", id: null, label: "x" } })).toBe(false);
  });

  test("only an applied https link on Google's own hosts is opened", () => {
    expect(proposalLink({ status: "applied", result: { link: "https://calendar.google.com/calendar/event?eid=1" } })).toBe("https://calendar.google.com/calendar/event?eid=1");
    expect(proposalLink({ status: "applied", result: { link: "https://evil.test/x" } })).toBeNull();
    expect(proposalLink({ status: "applied", result: { link: "javascript:alert(1)" } })).toBeNull();
    expect(proposalLink({ status: "pending", result: { link: "https://docs.google.com/document/d/1/edit" } })).toBeNull();
  });

  test("status wording", () => {
    expect(proposalStatusLabel({ status: "applied", provider: "calendar", error: undefined })).toBe("Added to your calendar");
    expect(proposalStatusLabel({ status: "failed", provider: "docs", error: "Docs & Sheets is no longer connected" })).toBe("Not created: Docs & Sheets is no longer connected");
  });
});
