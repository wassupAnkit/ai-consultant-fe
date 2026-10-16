import type { EdgeStage, EdgeToolEvent, ReasoningStep, ThoughtSegment } from "./types";

/** What the reader is told while each phase is in progress. */
export const STAGE_LABEL: Record<EdgeStage, string> = {
  classifying: "Working out what you're asking",
  researching: "Looking things up",
  answering: "Writing the answer",
};

/**
 * Folds the stream's `tool` events into an ordered list of rows.
 *
 * Tools run in parallel, so a turn's start and end events interleave. An `end` therefore
 * closes the most recent still-running row *for that tool*, which keeps two concurrent
 * lookups on their own rows and lets the same tool appear twice in one turn without the
 * second end overwriting the first row.
 */
export function applyToolEvent(steps: ReasoningStep[], event: EdgeToolEvent): ReasoningStep[] {
  if (event.status === "start") {
    return [...steps, { key: `${event.tool}:${steps.length}`, label: event.label, state: "running" }];
  }

  const index = steps.reduce<number | null>(
    (found, step, i) => (step.state === "running" && step.key.startsWith(`${event.tool}:`) ? i : found),
    null,
  );
  // An end with no matching start (a reconnect, say) must not invent a row.
  if (index === null) return steps;

  const next = [...steps];
  next[index] = { ...next[index]!, label: event.label, state: event.ok === false ? "failed" : "done", ms: event.ms };
  return next;
}

/**
 * Appends one streamed `thinking` chunk. It extends the last paragraph while nothing has
 * happened since; a lookup starting (`at` moved) or a new phase (researching → answering)
 * opens a new one, so the panel reads think, search, think rather than one run-on block.
 */
export function appendThought(thoughts: ThoughtSegment[], at: number, stage: EdgeStage | null | undefined, chunk: string): ThoughtSegment[] {
  if (!chunk) return thoughts;
  const last = thoughts.at(-1);
  if (last && last.at === at && (last.stage ?? null) === (stage ?? null)) {
    return [...thoughts.slice(0, -1), { ...last, text: last.text + chunk }];
  }
  return [...thoughts, { at, text: chunk.replace(/^\s+/, ""), stage: stage ?? null }];
}

/** What a run of lookups did, as deepseek.com words it: "Searched the web", "Read 3 pages". */
const GROUP_VERB: Record<string, (n: number) => string> = {
  web_search: (n) => (n === 1 ? "Searched the web" : `Searched the web ${n} times`),
  fetch_page: (n) => `Read ${n} page${n === 1 ? "" : "s"}`,
  search_knowledge_base: (n) => (n === 1 ? "Searched the knowledge base" : `Searched the knowledge base ${n} times`),
  search_programs: (n) => (n === 1 ? "Checked program records" : `Checked program records ${n} times`),
};
const crmVerb = (n: number) => `Checked ${n} CRM record${n === 1 ? "" : "s"}`;

export type TimelineItem =
  | { kind: "thought"; key: string; text: string }
  | { kind: "lookups"; key: string; title: string; steps: ReasoningStep[] };

const toolOf = (step: ReasoningStep) => step.key.slice(0, step.key.lastIndexOf(":"));
const verbFor = (tool: string) => GROUP_VERB[tool] ?? (tool.startsWith("crm_") ? crmVerb : (n: number) => `${n} lookup${n === 1 ? "" : "s"}`);

/**
 * Interleaves thoughts with lookups in the order they happened. Consecutive lookups share
 * one group (one research round runs its tools together), titled by what they were
 * ("Searched the web · Read 2 pages"), with each call listed under it.
 */
export function buildTimeline(steps: ReasoningStep[], thoughts: ThoughtSegment[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  const pushThoughts = (at: number) =>
    thoughts.forEach((t, i) => {
      if (t.at === at && t.text.trim()) items.push({ kind: "thought", key: `t${i}`, text: t.text.trim() });
    });
  let group: ReasoningStep[] = [];
  const flush = () => {
    if (!group.length) return;
    const counts = new Map<string, number>();
    for (const s of group) {
      const tool = toolOf(s);
      const bucket = tool.startsWith("crm_") ? "crm" : tool;
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }
    const title = [...counts].map(([tool, n]) => (tool === "crm" ? crmVerb(n) : verbFor(tool)(n))).join(" · ");
    items.push({ kind: "lookups", key: `g${group[0]!.key}`, title, steps: group });
    group = [];
  };
  for (let i = 0; i <= steps.length; i++) {
    // Thoughts written after i lookups close the group before them.
    if (thoughts.some((t) => t.at === i && t.text.trim())) {
      flush();
      pushThoughts(i);
    }
    if (i < steps.length) group.push(steps[i]!);
  }
  flush();
  // Anything placed past the last lookup the client knows of (history rows that lost steps).
  thoughts.forEach((t, i) => {
    if (t.at > steps.length && t.text.trim()) items.push({ kind: "thought", key: `t${i}`, text: t.text.trim() });
  });
  return items;
}
