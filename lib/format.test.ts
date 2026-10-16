import { describe, expect, test } from "bun:test";
import { dayGroup, formatLatency, initialsOf, relativeTime } from "./format";

describe("format", () => {
  const now = new Date("2026-09-28T10:00:00Z");

  test("relativeTime reads naturally", () => {
    expect(relativeTime(new Date(now.getTime() - 10_000), now)).toBe("just now");
    expect(relativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe("5 min ago");
    expect(relativeTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe("3 h ago");
    expect(relativeTime(new Date(now.getTime() - 2 * 86_400_000), now)).toBe("2 d ago");
  });

  test("dayGroup buckets by local day", () => {
    expect(dayGroup(now, now)).toBe("Today");
    expect(dayGroup(new Date(now.getTime() - 26 * 3_600_000), now)).toBe("Yesterday");
    expect(dayGroup(new Date(now.getTime() - 5 * 86_400_000), now)).toBe("Earlier");
  });

  test("initials and latency", () => {
    expect(initialsOf("Aashish Dhakal", null)).toBe("AD");
    expect(initialsOf(null, "priya.sharma@example.com")).toBe("PS");
    expect(formatLatency(820)).toBe("820 ms");
    expect(formatLatency(4_210)).toBe("4.2 s");
    expect(formatLatency(undefined)).toBeNull();
  });
});
