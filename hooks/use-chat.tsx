"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { EdgeApiError, decideCrmWrite as apiDecideCrmWrite, getSession } from "@/lib/edge/api";
import { streamChat, StreamChatError } from "@/lib/edge/stream";
import { appendThought, applyToolEvent } from "@/lib/edge/reasoning";
import { expireAll, upsertProposal } from "@/lib/edge/crm-writes";
import { DEFAULT_ATTACHMENT_MESSAGE, upsertDocument } from "@/lib/edge/attachments";
import { fromHistory } from "@/lib/edge/history";
import type { AttachmentView, ChatMessage, CrmWriteEdits, SessionHistory } from "@/lib/edge/types";
import { track } from "@/lib/analytics";
import { useSessions } from "./use-sessions";

export type ThreadStatus = "idle" | "loading" | "streaming";

export interface SendOptions {
  /** Answer the newest question again in place of its stored answer. */
  regenerate?: boolean;
  /** Student documents already uploaded for this turn; sent as their ids, shown on the question. */
  attachments?: AttachmentView[];
}

export type ActiveSession = SessionHistory["session"];

interface ChatContextValue {
  /** Conversation currently shown; null while composing a brand-new chat. */
  activeSessionId: string | null;
  /** The shown conversation's own record (title, guide…), once loaded; null for a new chat. */
  activeSession: ActiveSession | null;
  /** Replace the shown conversation's record after a change made elsewhere (e.g. the journey moved). */
  setActiveSession: (session: ActiveSession) => void;
  /** Show a conversation that was just created (empty), without reloading it, and move the URL to it. */
  adoptSession: (session: ActiveSession) => void;
  messages: ChatMessage[];
  status: ThreadStatus;
  loadError: string | null;
  /** Text another part of the UI wants inserted into the composer (e.g. "Ask Edge about this"). */
  draft: string | null;
  setDraft: (text: string | null) => void;
  /** Show a conversation (or the empty new-chat state when null). Called by the route pages. */
  openSession: (id: string | null) => void;
  send: (text: string, options?: SendOptions) => Promise<void>;
  stop: () => void;
  /** Re-ask the last user message, replacing the answer it produced. Behind both the
   *  error state's "Try again" and Regenerate on the last answer. */
  retryLast: () => Promise<void>;
  /** Approve or reject a CRM write proposal card shown on `messageId`; `edits` are values changed on the card (approve only). */
  decideCrmWrite: (messageId: string, proposalId: string, decision: "approve" | "reject", edits?: CrmWriteEdits) => Promise<void>;
  /** DeepThink: the next questions are reasoned harder (slower, shows more working). Remembered per browser. */
  deepThink: boolean;
  setDeepThink: (on: boolean) => void;
}

const DEEP_THINK_KEY = "edge:deepThink";

const ChatContext = createContext<ChatContextValue | null>(null);

let counter = 0;
const uid = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export function ChatProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const sessions = useSessions();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSessionState] = useState<ActiveSession | null>(null);
  const activeSessionRef = useRef<ActiveSession | null>(null);
  activeSessionRef.current = activeSession;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ThreadStatus>("idle");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [deepThink, setDeepThinkState] = useState(false);
  const deepThinkRef = useRef(false);
  deepThinkRef.current = deepThink;

  // A preference, not a record: storage may be blocked, and then the toggle just starts off.
  useEffect(() => {
    try {
      setDeepThinkState(window.localStorage.getItem(DEEP_THINK_KEY) === "1");
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setDeepThink = useCallback((on: boolean) => {
    setDeepThinkState(on);
    try {
      window.localStorage.setItem(DEEP_THINK_KEY, on ? "1" : "0");
    } catch {
      /* storage unavailable */
    }
  }, []);

  const activeRef = useRef<string | null>(null);
  const streamAbort = useRef<AbortController | null>(null);
  const loadAbort = useRef<AbortController | null>(null);
  const statusRef = useRef<ThreadStatus>("idle");
  statusRef.current = status;

  const stop = useCallback(() => {
    streamAbort.current?.abort();
    streamAbort.current = null;
  }, []);

  const openSession = useCallback(
    (id: string | null) => {
      if (id === activeRef.current) return;
      stop();
      loadAbort.current?.abort();
      activeRef.current = id;
      setActiveSessionId(id);
      setActiveSessionState(null);
      setLoadError(null);
      if (!id) {
        setMessages([]);
        setStatus("idle");
        return;
      }
      const controller = new AbortController();
      loadAbort.current = controller;
      setMessages([]);
      setStatus("loading");
      getSession(id, controller.signal)
        .then((history) => {
          if (controller.signal.aborted) return;
          setMessages(history.messages.map(fromHistory));
          setActiveSessionState(history.session);
          setStatus("idle");
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setStatus("idle");
          if (err instanceof EdgeApiError && err.status === 404) {
            toast.error("That conversation is no longer available.");
            activeRef.current = null;
            setActiveSessionId(null);
            router.replace("/chat");
            return;
          }
          setLoadError(err instanceof Error ? err.message : "Could not load the conversation");
        });
    },
    [router, stop],
  );

  const setActiveSession = useCallback((session: ActiveSession) => {
    // Only the conversation still on screen; a late reply for one the reader left is dropped.
    if (session.id === activeRef.current) setActiveSessionState(session);
  }, []);

  const adoptSession = useCallback(
    (session: ActiveSession) => {
      loadAbort.current?.abort();
      // Set before navigating, so the route's openSession sees it as already open and keeps it.
      activeRef.current = session.id;
      setActiveSessionId(session.id);
      setActiveSessionState(session);
      setMessages([]);
      setLoadError(null);
      setStatus("idle");
      router.replace(`/chat/${session.id}`);
    },
    [router],
  );

  const patch = useCallback((id: string, update: Partial<ChatMessage> | ((m: ChatMessage) => Partial<ChatMessage>)) => {
    setMessages((list) => list.map((m) => (m.id === id ? { ...m, ...(typeof update === "function" ? update(m) : update) } : m)));
  }, []);

  const send = useCallback(
    async (raw: string, options: SendOptions = {}) => {
      const attachments = options.attachments?.length ? options.attachments : undefined;
      // The message stays required: files with no text ask Edge to read them.
      const text = raw.trim() || (attachments ? DEFAULT_ATTACHMENT_MESSAGE : "");
      if (!text || statusRef.current === "streaming") return;
      const sessionId = activeRef.current ?? undefined;
      const now = new Date().toISOString();
      const userId = uid();
      const assistantId = uid();
      const deep = deepThinkRef.current;
      // A new turn expires the previous turn's still-pending CRM write cards: the backend
      // refuses a decision on them from here, so the reader must not be shown Approve/Reject
      // on a card that can no longer go anywhere.
      setMessages((ms) => ms.map((m) => (m.crmWrites ? { ...m, crmWrites: expireAll(m.crmWrites, new Date()) } : m)));
      // A guided turn is asked at the session's current step; the thread marks where the step changed.
      const guideStep = activeSessionRef.current?.guide?.currentStep ?? null;
      setMessages((list) => [
        ...list,
        { id: userId, role: "user", content: text, status: "done", createdAt: now, guideStep, ...(attachments ? { attachments } : {}) },
        { id: assistantId, role: "assistant", content: "", status: "streaming", createdAt: now, sources: [], reasoning: [], thoughts: [], stage: null, deepThink: deep, followUps: [], crmWrites: [], documents: [], guideStep },
      ]);
      setStatus("streaming");
      const controller = new AbortController();
      streamAbort.current = controller;
      let streamed = "";
      // `done` ends the answer; the title and the follow-up chips arrive after it while the
      // composer is already usable again. Everything after this point must leave a finished
      // message alone — a late abort (Escape after the answer) is not a stopped answer.
      let finished = false;

      try {
        await streamChat({
          message: text,
          sessionId,
          newSession: !sessionId,
          deepThink: deep,
          regenerate: options.regenerate && Boolean(sessionId),
          attachments: attachments?.map((a) => a.id),
          signal: controller.signal,
          onToken: (chunk) => {
            streamed += chunk;
            patch(assistantId, { content: streamed });
          },
          onIntent: (intent) => {
            patch(assistantId, { intent });
          },
          onThinking: (chunk) => {
            // Updater form, unlike `onToken`'s local accumulator: thinking chunks interleave
            // with tool events that also patch this message, so appending to the message's
            // own latest value is what stops two in-flight patches clobbering each other.
            // Placed after however many lookups have started, so research-round thoughts land
            // between the rounds' lookups and the answer's own after all of them.
            patch(assistantId, (m) => ({ thoughts: appendThought(m.thoughts ?? [], m.reasoning?.length ?? 0, m.stage, chunk) }));
          },
          onStage: (stage) => {
            patch(assistantId, { stage });
          },
          onTool: (event) => {
            patch(assistantId, (m) => ({ reasoning: applyToolEvent(m.reasoning ?? [], event) }));
          },
          onDocument: (doc) => {
            patch(assistantId, (m) => ({ documents: upsertDocument(m.documents, doc) }));
          },
          onCrmWriteProposal: (view) => {
            patch(assistantId, (m) => ({ crmWrites: upsertProposal(m.crmWrites, view) }));
          },
          onDone: (done) => {
            finished = true;
            patch(assistantId, {
              content: done.answer || streamed,
              status: "done",
              sources: done.sources ?? [],
              research: done.research ?? null,
              intent: done.intent,
              disclaimer: done.disclaimer,
              refused: done.refused,
              requestId: done.requestId,
              traceId: done.traceId,
              latencyMs: done.latencyMs,
              stage: null,
            });
            if (!activeRef.current) {
              activeRef.current = done.sessionId;
              setActiveSessionId(done.sessionId);
              router.replace(`/chat/${done.sessionId}`);
            }
            // The thread is usable again from here; the stream keeps draining for the extras.
            setStatus("idle");
            // The backend stores the turn after replying: refresh once for the new entry and
            // its message count. The title comes by its own `session` event, not by polling.
            void sessions.refresh();
          },
          onSession: (s) => {
            sessions.applyTitle(s.sessionId, s.title);
            track("session_title_auto", { sessionId: s.sessionId, chars: s.title.length });
          },
          onSuggestions: (s) => {
            patch(assistantId, (m) => (m.status === "done" ? { followUps: s.items } : {}));
          },
          onGuide: (g) => {
            // Edge's suggestion to move on, for the conversation still on screen only.
            if (g.sessionId === activeRef.current) setActiveSessionState((cur) => (cur && cur.id === g.sessionId ? { ...cur, guide: g.guide } : cur));
          },
          onError: (error) => {
            if (!finished) patch(assistantId, { status: "error", error: error.message });
          },
        });
        // Stream ended without a `done` event (e.g. upstream closed early).
        setMessages((list) => list.map((m) => (m.id === assistantId && m.status === "streaming" ? { ...m, status: m.content ? "stopped" : "error", error: m.content ? undefined : "The answer ended unexpectedly." } : m)));
      } catch (err) {
        if (finished) {
          /* the answer was complete; only the extras were cut short */
        } else if (controller.signal.aborted) {
          patch(assistantId, (m) => ({ status: m.content ? "stopped" : "error", error: m.content ? undefined : "Stopped before any answer arrived." }));
        } else {
          const message = err instanceof StreamChatError || err instanceof Error ? err.message : "Something went wrong";
          patch(assistantId, { status: "error", error: message });
          if (err instanceof StreamChatError && err.status === 401) toast.error("Your session has expired. Please sign in again.");
        }
      } finally {
        if (streamAbort.current === controller) streamAbort.current = null;
        setStatus("idle");
      }
    },
    [patch, router, sessions],
  );

  const retryLast = useCallback(async () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    // Drop the answer being replaced and the user turn; `send` re-adds both, and the backend
    // removes its stored copy of the pair so history holds one answer to the question.
    setMessages((list) => {
      const idx = list.findIndex((m) => m.id === lastUser.id);
      return idx >= 0 ? list.slice(0, idx) : list;
    });
    await send(lastUser.content, { regenerate: true, attachments: lastUser.attachments });
  }, [messages, send]);

  // Optimistic: the card flips to "applying" immediately, then to whatever the backend
  // decided. A network failure (not a decided 409 -- `decideCrmWrite` in lib/edge/api.ts
  // resolves those) restores "pending" so the counsellor can simply try again.
  const decideCrmWrite = useCallback(async (messageId: string, proposalId: string, decision: "approve" | "reject", edits?: CrmWriteEdits) => {
    const setStatus = (status: "applying" | "pending") =>
      patch(messageId, (m) => ({ crmWrites: (m.crmWrites ?? []).map((v) => (v.proposalId === proposalId ? { ...v, status } : v)) }));
    setStatus("applying");
    try {
      const view = await apiDecideCrmWrite(proposalId, decision, edits);
      patch(messageId, (m) => ({ crmWrites: upsertProposal(m.crmWrites, view) }));
    } catch {
      setStatus("pending");
      toast.error("Could not send your decision. Please try again.");
    }
  }, [patch]);

  useEffect(() => () => stop(), [stop]);

  const value = useMemo<ChatContextValue>(
    () => ({ activeSessionId, activeSession, setActiveSession, adoptSession, messages, status, loadError, draft, setDraft, openSession, send, stop, retryLast, decideCrmWrite, deepThink, setDeepThink }),
    [activeSessionId, activeSession, setActiveSession, adoptSession, messages, status, loadError, draft, openSession, send, stop, retryLast, decideCrmWrite, deepThink, setDeepThink],
  );
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
