/**
 * Client-side activity tracking. Events are queued in memory and posted in
 * batches to `/api/events`, which forwards them to the Edge backend's
 * `POST /v1/events` (stored as `ui.<type>` in the activity log used for
 * fine-tuning data). Never throws, never blocks the UI.
 *
 *   track("copy_answer", { requestId, sessionId, chars: 120 });
 */
export type TrackProps = Record<string, unknown> & { sessionId?: string | null; requestId?: string | null };

interface QueuedEvent {
  type: string;
  at: string;
  sessionId?: string;
  requestId?: string;
  props?: Record<string, unknown>;
}

const ENDPOINT = "/api/events";
const FLUSH_MS = 3_000;
const BATCH = 20;
const MAX_BATCH = 50; // backend limit per request
const MAX_QUEUE = 200;
const TYPE_RE = /^[a-z][a-z0-9_]{1,48}$/;

const queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let installed = false;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

function install() {
  if (installed || !isBrowser()) return;
  installed = true;
  window.addEventListener("pagehide", () => flush(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
}

function schedule() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    flush();
  }, FLUSH_MS);
}

/** Record a UI event. `type` is snake_case (2-49 chars); everything else is free-form props. */
export function track(type: string, props: TrackProps = {}): void {
  if (!isBrowser()) return;
  if (!TYPE_RE.test(type)) {
    if (process.env.NODE_ENV !== "production") console.warn(`[analytics] invalid event type "${type}"`);
    return;
  }
  const { sessionId, requestId, ...rest } = props;
  queue.push({
    type,
    at: new Date().toISOString(),
    sessionId: typeof sessionId === "string" && sessionId ? sessionId : undefined,
    requestId: typeof requestId === "string" && requestId ? requestId : undefined,
    props: { path: window.location.pathname, ...rest },
  });
  if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
  install();
  if (queue.length >= BATCH) flush();
  else schedule();
}

/** Send everything queued. `beacon` uses sendBeacon so the page can unload immediately. */
export function flush(beacon = false): void {
  if (!isBrowser() || !queue.length) return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  while (queue.length) {
    const events = queue.splice(0, MAX_BATCH);
    const body = JSON.stringify({ events });
    if (beacon && typeof navigator.sendBeacon === "function") {
      try {
        if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }))) continue;
      } catch {
        /* fall through to fetch */
      }
    }
    fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {
      /* telemetry is best-effort */
    });
  }
}

/** Browser context attached to every chat turn (`metadata` in the chat request). */
export function clientMetadata(): Record<string, unknown> {
  if (!isBrowser()) return {};
  let tz: string | null = null;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    tz = null;
  }
  return {
    tz,
    locale: navigator.language,
    userAgent: navigator.userAgent.slice(0, 256),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    touch: navigator.maxTouchPoints > 0,
    path: window.location.pathname,
    referrer: document.referrer || null,
  };
}
