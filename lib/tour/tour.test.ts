import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { GUIDE_SLIDES, TOURS, TOUR_VERSION, slidesFor, stepsFor, type TourId } from "./content";
import { MAX_PROMPTS, arrivalAction, markSeen, notePromptLater, readProgress } from "./progress";

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe("arrivalAction", () => {
  const p = (seenVersion: number, prompts = 0, promptedVersion = 0) => ({ seenVersion, prompts, promptedVersion });
  test("first visit → offer the guide; older version → offer what's new; current → nothing", () => {
    expect(arrivalAction(p(0))).toBe("welcome");
    expect(arrivalAction(p(1), 2, 1)).toBe("whats-new");
    expect(arrivalAction(p(2), 2, 1)).toBeNull();
    // Someone who already saw the features the what's-new tour introduces is not offered it again.
    expect(arrivalAction(p(2), 3, 1)).toBeNull();
  });
  test("\"Ask me later\" stops after MAX_PROMPTS for this version, and starts over for a new one", () => {
    expect(arrivalAction(p(0, MAX_PROMPTS - 1, 2), 2)).toBe("welcome");
    expect(arrivalAction(p(0, MAX_PROMPTS, 2), 2)).toBeNull();
    expect(arrivalAction(p(0, MAX_PROMPTS, 2), 3)).toBe("welcome");
  });
});

describe("progress storage", () => {
  test("round-trips per user, counts later-prompts, and never throws", () => {
    const s = memory();
    expect(readProgress("a@x.com", s)).toEqual({ seenVersion: 0, prompts: 0, promptedVersion: 0 });
    notePromptLater("a@x.com", 2, s);
    notePromptLater("a@x.com", 2, s);
    expect(readProgress("a@x.com", s)).toEqual({ seenVersion: 0, prompts: 2, promptedVersion: 2 });
    notePromptLater("a@x.com", 3, s);
    expect(readProgress("a@x.com", s)).toMatchObject({ prompts: 1, promptedVersion: 3 });
    markSeen("a@x.com", 2, s);
    expect(readProgress("a@x.com", s).seenVersion).toBe(2);
    expect(readProgress("b@x.com", s).seenVersion).toBe(0);
    s.m.set("edge.tour.v1:c@x.com", "{not json");
    expect(readProgress("c@x.com", s).seenVersion).toBe(0);
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readProgress("a@x.com", broken).seenVersion).toBe(0);
    expect(() => markSeen("a@x.com", 2, broken)).not.toThrow();
    expect(() => notePromptLater("a@x.com", 2, broken)).not.toThrow();
  });
});

describe("content", () => {
  test("a switched-off feature is never advertised", () => {
    expect(slidesFor({ documentUpload: false }).some((s) => s.id === "documents")).toBe(false);
    expect(slidesFor({ documentUpload: true }).some((s) => s.id === "documents")).toBe(true);
    for (const id of Object.keys(TOURS) as TourId[]) {
      expect(stepsFor(id, { documentUpload: false }).some((s) => s.target === "attach")).toBe(false);
    }
  });

  test("slides are unique, short enough to read, and have three points", () => {
    expect(new Set(GUIDE_SLIDES.map((s) => s.id)).size).toBe(GUIDE_SLIDES.length);
    for (const s of GUIDE_SLIDES) {
      expect(s.points).toHaveLength(3);
      expect(s.body.length).toBeLessThan(320);
      expect(s.title.length).toBeLessThan(60);
    }
    expect(TOUR_VERSION).toBeGreaterThan(0);
  });

  test("every tour target exists as a data-tour attribute in the UI", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) walk(p);
        else if (p.endsWith(".tsx") && !p.endsWith(".test.tsx")) files.push(p);
      }
    };
    walk(join(import.meta.dir, "../../components"));
    const source = files.map((f) => readFileSync(f, "utf8")).join("\n");
    const targets = new Set(Object.values(TOURS).flatMap((t) => t.steps.map((s) => s.target)));
    for (const t of targets) expect(source.includes(`data-tour="${t}"`)).toBe(true);
  });
});
