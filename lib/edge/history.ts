import type { ChatMessage, HistoryMessage } from "./types";

/** One stored turn from `GET /v1/sessions/:id` as the thread renders it. */
export function fromHistory(m: HistoryMessage, i: number): ChatMessage {
  const human = m.role === "human";
  return {
    id: `h-${i}-${m.createdAt}`,
    role: human ? "user" : "assistant",
    content: m.content,
    // A stopped turn shows as stopped again, so the reader knows the text ends early.
    status: m.stopped ? "stopped" : "done",
    createdAt: m.createdAt,
    sources: m.sources ?? [],
    refused: m.refused,
    disclaimer: m.disclaimer,
    requestId: m.requestId,
    traceId: m.traceId,
    // Replay the lookups so a reopened thread keeps the trace that explains each answer.
    // Turns answered before the backend stored it have none -- an empty list renders as no
    // trace at all, which is what those answers showed anyway.
    reasoning: m.reasoning ?? [],
    thoughts: m.thoughts ?? [],
    deepThink: m.deepThink,
    latencyMs: m.latencyMs,
    followUps: m.followUps ?? [],
    crmWrites: m.crmWrites ?? [],
    guideStep: m.guideStep ?? null,
    // Document intake: files on the question, what Edge read from them on the answer.
    ...(human ? { attachments: m.attachments ?? [] } : { documents: m.documents ?? [] }),
    // The stored classification when the backend kept it; older turns only have the topic,
    // and for those the confidence is unknown rather than invented.
    intent: m.intentDetail ?? (m.intent ? { primary: m.intent, secondary: [], confidence: "medium", inScope: true, destinations: [], flags: [], language: "en" } : null),
  };
}
