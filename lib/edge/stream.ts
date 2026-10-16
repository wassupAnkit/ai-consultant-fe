import { clientMetadata, track } from "@/lib/analytics";
import type { CrmWriteProposalView, DocumentExtractionView, EdgeDone, EdgeError, EdgeGuideEvent, EdgeIntent, EdgeSessionEvent, EdgeStage, EdgeSuggestionsEvent, EdgeToolEvent } from "./types";

/**
 * Streams one chat turn through `POST /api/chat`, which proxies the Edge
 * backend's `/v1/chat/stream?format=ndjson`. Each line is
 * `{"event":"meta"|"intent"|"status"|"tool"|"thinking"|"token"|"document_extraction"|"crm_write_proposal"|"done"|"session"|"suggestions"|"error","data":{...}}`.
 * `done` ends the answer; `session` (a title for a new conversation) and `suggestions`
 * (follow-up chips) may follow it while the consultant is already reading.
 */
export interface StreamChatOptions {
  message: string;
  /** Continue this conversation. Omit together with `newSession` to let the backend continue the latest one. */
  sessionId?: string;
  /** Start a fresh conversation even if the user has an active one. */
  newSession?: boolean;
  /** DeepThink: ask the backend to reason harder on this turn. */
  deepThink?: boolean;
  /** Answer the newest question again: the backend drops its stored last turn first. Needs `sessionId`. */
  regenerate?: boolean;
  /** Ids of student documents uploaded for this turn (`/api/chat/attachments`), at most 5. */
  attachments?: string[];
  signal?: AbortSignal;
  onToken: (chunk: string) => void;
  onIntent?: (intent: EdgeIntent) => void;
  /** Phase changes: classifying → researching → answering. */
  onStage?: (stage: EdgeStage) => void;
  /** One lookup starting or finishing, with its label and duration. */
  onTool?: (event: EdgeToolEvent) => void;
  /**
   * The model's own reasoning, streamed in incremental fragments to be concatenated in
   * order exactly like `onToken`. It interleaves with `status`/`tool`/`token` rather than
   * arriving as a block: research rounds think between their lookups, the answer after
   * them. The backend stores it too, and history replays it as `thoughts`.
   */
  onThinking?: (chunk: string) => void;
  /** What Edge read from one attached document: one event per file, before any CRM proposal. */
  onDocument?: (doc: DocumentExtractionView) => void;
  /** A CRM write became a stored proposal: one event per proposal, streamed before `done`. */
  onCrmWriteProposal?: (view: CrmWriteProposalView) => void;
  onDone?: (done: EdgeDone) => void;
  /** After `done`, first turn only: the backend named the conversation. */
  onSession?: (session: EdgeSessionEvent) => void;
  /** After `done`: follow-up questions for this answer. */
  onSuggestions?: (suggestions: EdgeSuggestionsEvent) => void;
  /** Guided sessions: Edge stored a suggestion to move on; `guide` is the journey as it now stands. */
  onGuide?: (event: EdgeGuideEvent) => void;
  onError?: (error: EdgeError) => void;
}

export class StreamChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status?: number,
    /** Seconds the backend asked us to wait, parsed from `Retry-After` on a 429. */
    public readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "StreamChatError";
  }
}

/** Codes this module raises itself instead of relaying one from the backend. */
export const OFFLINE_ERROR = "offline";
export const NETWORK_ERROR = "network_error";
export const RATE_LIMITED_ERROR = "rate_limited";

/**
 * A dropped connection is the counsellor's to fix; a 502 is ours. Collapsing both into
 * "something went wrong" sends people chasing an outage that is really their hotel wifi,
 * so the two are worded apart, and again by whether the answer had started arriving.
 */
const CONNECTION_MESSAGES = {
  offline: {
    send: "You're offline, so this message wasn't sent. Check your connection — Edge will work again as soon as you're back.",
    stream: "You went offline before the answer finished. Check your connection and ask again.",
  },
  network: {
    send: "Couldn't reach Edge — the request didn't get through. Check your connection and try again.",
    stream: "The connection to Edge dropped before the answer finished. Ask again to retry.",
  },
} as const;

/**
 * The browser's own connectivity verdict. It is trustworthy when false and optimistic when
 * true (a captive portal still reports "online"), so it is only ever used to *explain* a
 * request that already failed — never to refuse to make one.
 */
function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/** Report and build the error for a request that never produced a response. */
function connectionFailure(options: StreamChatOptions, phase: "send" | "stream"): StreamChatError {
  const kind = isOffline() ? "offline" : "network";
  const code = kind === "offline" ? OFFLINE_ERROR : NETWORK_ERROR;
  const message = CONNECTION_MESSAGES[kind][phase];
  options.onError?.({ code, message });
  track("chat_error", { sessionId: options.sessionId, code, phase });
  return new StreamChatError(code, message);
}

/** `Retry-After` is either a whole number of seconds or an HTTP-date (RFC 9110 §10.2.3). */
function parseRetryAfter(header: string | null): number | undefined {
  const value = header?.trim();
  if (!value) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const at = Date.parse(value);
  if (Number.isNaN(at)) return undefined;
  return Math.max(0, Math.round((at - Date.now()) / 1_000));
}

/** Deliberately rounded: the header is advisory, and "in about 30 seconds" reads calmer than "in 27". */
function humanWait(seconds: number): string {
  if (seconds <= 5) return "a few seconds";
  if (seconds < 60) return `${Math.round(seconds / 5) * 5} seconds`;
  if (seconds < 120) return "a minute";
  return `${Math.round(seconds / 60)} minutes`;
}

/**
 * What a counsellor sees on a 429. The backend's own text is operational ("rate limit
 * exceeded"), which reads like a fault; what matters here is that nothing is broken, and
 * roughly how long to wait. Nothing retries on its own — the wait is the user's to spend.
 */
export function rateLimitMessage(retryAfterSeconds?: number): string {
  const tail = retryAfterSeconds === undefined ? "wait a few seconds and try again" : `try again in about ${humanWait(retryAfterSeconds)}`;
  return `Edge is handling a lot of questions right now, so this one didn't get through. Nothing is broken — ${tail}.`;
}

export async function streamChat(options: StreamChatOptions): Promise<EdgeDone | null> {
  const startedAt = performance.now();
  track("chat_send", { sessionId: options.sessionId, newSession: Boolean(options.newSession), deepThink: Boolean(options.deepThink), chars: options.message.length });
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // `metadata` (timezone, locale, device, page) is stored with the turn in the backend's activity log.
      body: JSON.stringify({ message: options.message, sessionId: options.sessionId, newSession: options.newSession, deepThink: options.deepThink, regenerate: options.regenerate || undefined, attachments: options.attachments?.length ? options.attachments : undefined, metadata: clientMetadata() }),
      signal: options.signal,
    });
  } catch (err) {
    // `fetch` rejects only on abort or transport failure — an HTTP error status resolves.
    if ((err as Error).name === "AbortError") throw err;
    throw connectionFailure(options, "send");
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    let code = `http_${response.status}`;
    try {
      const parsed = (await response.json()) as { error?: string | { code?: string; message?: string }; data?: { message?: string; code?: string } };
      if (typeof parsed.error === "string") detail = parsed.error;
      else if (parsed.error?.message) {
        detail = parsed.error.message;
        code = parsed.error.code ?? code;
      } else if (parsed.data?.message) {
        detail = parsed.data.message;
        code = parsed.data.code ?? code;
      }
    } catch {
      /* body was not JSON */
    }
    if (response.status === 429) {
      // `code` is still the generic `http_429` unless the backend named its own limiter.
      const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));
      const limitCode = code === "http_429" ? RATE_LIMITED_ERROR : code;
      const limitMessage = rateLimitMessage(retryAfterSeconds);
      options.onError?.({ code: limitCode, message: limitMessage });
      track("chat_error", { sessionId: options.sessionId, code: limitCode, status: 429, retryAfterSeconds: retryAfterSeconds ?? null });
      throw new StreamChatError(limitCode, limitMessage, 429, retryAfterSeconds);
    }
    options.onError?.({ code, message: detail });
    track("chat_error", { sessionId: options.sessionId, code, status: response.status });
    throw new StreamChatError(code, detail, response.status);
  }
  if (!response.body) return null;
  const requestId = response.headers.get("x-request-id") || undefined;
  let received = 0;
  let firstTokenMs: number | null = null;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done: EdgeDone | null = null;
  let streamError: EdgeError | null = null;

  const handle = (line: string) => {
    if (!line.trim()) return;
    let parsed: { event: string; data: unknown };
    try {
      parsed = JSON.parse(line) as { event: string; data: unknown };
    } catch {
      return;
    }
    switch (parsed.event) {
      case "token": {
        const chunk = (parsed.data as { chunk: string }).chunk ?? "";
        received += chunk.length;
        firstTokenMs ??= Math.round(performance.now() - startedAt);
        options.onToken(chunk);
        break;
      }
      // Deliberately outside the `token` accounting above: thinking is not part of the
      // answer, so counting it would inflate `answerChars` and make `firstTokenMs` report
      // the moment the model started thinking rather than the moment text appeared.
      case "thinking":
        options.onThinking?.((parsed.data as { chunk: string }).chunk ?? "");
        break;
      case "intent":
        options.onIntent?.(parsed.data as EdgeIntent);
        break;
      case "status":
        options.onStage?.((parsed.data as { stage: EdgeStage }).stage);
        break;
      case "tool":
        options.onTool?.(parsed.data as EdgeToolEvent);
        break;
      case "document_extraction":
        options.onDocument?.(parsed.data as DocumentExtractionView);
        break;
      case "crm_write_proposal":
        options.onCrmWriteProposal?.(parsed.data as CrmWriteProposalView);
        break;
      case "done":
        done = parsed.data as EdgeDone;
        options.onDone?.(done);
        break;
      case "session":
        options.onSession?.(parsed.data as EdgeSessionEvent);
        break;
      case "suggestions":
        options.onSuggestions?.(parsed.data as EdgeSuggestionsEvent);
        break;
      case "guide":
        options.onGuide?.(parsed.data as EdgeGuideEvent);
        break;
      case "error":
        streamError = parsed.data as EdgeError;
        options.onError?.(streamError);
        break;
      default:
        break; // meta, unknown
    }
  };

  try {
    while (true) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) handle(line);
    }
    if (buffer.trim()) handle(buffer);
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      // User pressed stop (or navigated away) mid-answer.
      track("chat_stop", { sessionId: options.sessionId, requestId, receivedChars: received, elapsedMs: Math.round(performance.now() - startedAt) });
      throw err;
    }
    // Anything else while reading is the socket dying mid-answer (wifi dropped, proxy timed
    // out), not a backend fault — the response status was already 200.
    throw connectionFailure(options, "stream");
  }

  // `done` / `streamError` are assigned inside the `handle` closure; TS cannot see that.
  const finished = done as EdgeDone | null;
  const failed = streamError as EdgeError | null;
  if (finished) {
    track("chat_done", {
      sessionId: finished.sessionId,
      requestId: finished.requestId,
      latencyMs: finished.latencyMs,
      clientMs: Math.round(performance.now() - startedAt),
      firstTokenMs,
      intent: finished.intent?.primary ?? null,
      inScope: finished.intent?.inScope ?? null,
      refused: finished.refused,
      sources: finished.sources?.length ?? 0,
      answerChars: finished.answer?.length ?? 0,
    });
  } else if (failed) {
    track("chat_error", { sessionId: options.sessionId, requestId, code: failed.code });
  }

  if (!finished && failed) throw new StreamChatError(failed.code, failed.message);
  return finished;
}
