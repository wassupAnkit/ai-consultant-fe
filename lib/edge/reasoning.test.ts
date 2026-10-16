import { describe, expect, test } from "bun:test";
import { appendThought, applyToolEvent, buildTimeline } from "./reasoning";
import type { ReasoningStep, ThoughtSegment } from "./types";

describe("applyToolEvent", () => {
  test("folds start/end pairs into rows, keeping parallel calls of one tool apart", () => {
    let steps: ReasoningStep[] = [];
    steps = applyToolEvent(steps, { tool: "search_knowledge_base", status: "start", label: "Searching knowledge base: fees" });
    steps = applyToolEvent(steps, { tool: "search_knowledge_base", status: "start", label: "Searching knowledge base: intakes" });
    steps = applyToolEvent(steps, { tool: "search_knowledge_base", status: "end", label: "Searching knowledge base: intakes", ms: 300, ok: true });
    expect(steps.map((s) => s.state)).toEqual(["running", "done"]);
    steps = applyToolEvent(steps, { tool: "search_knowledge_base", status: "end", label: "Searching knowledge base: fees", ms: 900, ok: false });
    expect(steps.map((s) => s.state)).toEqual(["failed", "done"]);
    expect(steps[0]!.ms).toBe(900);
  });

  test("an end without a start invents nothing", () => {
    expect(applyToolEvent([], { tool: "fetch_page", status: "end", label: "Reading page" })).toEqual([]);
  });
});

describe("appendThought", () => {
  test("extends the current paragraph until a lookup or a new phase interrupts", () => {
    let t: ThoughtSegment[] = [];
    t = appendThought(t, 0, "researching", "Fees ");
    t = appendThought(t, 0, "researching", "first.");
    t = appendThought(t, 2, "answering", " Then intakes.");
    expect(t).toEqual([
      { at: 0, text: "Fees first.", stage: "researching" },
      { at: 2, text: "Then intakes.", stage: "answering" },
    ]);
  });
});

describe("buildTimeline", () => {
  test("interleaves thoughts with grouped lookups in the order they happened", () => {
    const steps: ReasoningStep[] = [
      { key: "web_search:0", label: "Searching the web: ECU IELTS", state: "done", ms: 500 },
      { key: "fetch_page:1", label: "Reading page ecu.edu.au", state: "done", ms: 800 },
      { key: "fetch_page:2", label: "Reading page ecu.edu.au/nursing", state: "done", ms: 700 },
      { key: "crm_list_my_tasks:3", label: "Checking your tasks", state: "done", ms: 200 },
    ];
    const thoughts: ThoughtSegment[] = [
      { at: 0, text: "Need the official page." },
      { at: 3, text: "Now the caseload." },
      { at: 4, text: "Ready to write." },
    ];
    const items = buildTimeline(steps, thoughts);
    expect(items.map((i) => (i.kind === "thought" ? `T:${i.text}` : `L:${i.title}`))).toEqual([
      "T:Need the official page.",
      "L:Searched the web · Read 2 pages",
      "T:Now the caseload.",
      "L:Checked 1 CRM record",
      "T:Ready to write.",
    ]);
  });

  test("keeps thoughts placed past the known lookups", () => {
    const items = buildTimeline([], [{ at: 3, text: "orphaned" }]);
    expect(items).toEqual([{ kind: "thought", key: "t0", text: "orphaned" }]);
  });
});
