/**
 * Which guide a counsellor has seen, per signed-in user and per browser. Lives in localStorage:
 * a cleared or blocked store only means the guide is offered again, never an error.
 */
import { TOUR_VERSION, WHATS_NEW_SINCE } from "./content";

export interface TourProgress {
  /** The TOUR_VERSION last completed or declined; 0 = never. */
  seenVersion: number;
  /** How many times the "Would you like the guide?" prompt was put off ("Ask me later") for promptedVersion. */
  prompts: number;
  promptedVersion: number;
}

/** After this many "later"s the prompt stops; the Help button still opens the guide. */
export const MAX_PROMPTS = 3;

const key = (userId: string) => `edge.tour.v1:${userId}`;
const EMPTY: TourProgress = { seenVersion: 0, prompts: 0, promptedVersion: 0 };

const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export function readProgress(userId: string, storage: Pick<Storage, "getItem"> | undefined = safeStorage()): TourProgress {
  try {
    const raw = storage?.getItem(key(userId));
    if (!raw) return { ...EMPTY };
    const p = JSON.parse(raw) ?? {};
    return { seenVersion: int(p.seenVersion), prompts: int(p.prompts), promptedVersion: int(p.promptedVersion) };
  } catch {
    return { ...EMPTY };
  }
}

function write(userId: string, p: TourProgress, storage: Pick<Storage, "setItem"> | undefined) {
  try {
    storage?.setItem(key(userId), JSON.stringify(p));
  } catch {
    // Private mode or blocked storage: the guide is offered again next time, which is harmless.
  }
}

/** The guide (or its what's-new tour) was taken or declined for this version: stop offering it. */
export function markSeen(userId: string, version = TOUR_VERSION, storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeStorage()): void {
  write(userId, { ...readProgress(userId, storage), seenVersion: version }, storage);
}

/** "Ask me later": counts towards MAX_PROMPTS for this version. */
export function notePromptLater(userId: string, version = TOUR_VERSION, storage: Pick<Storage, "getItem" | "setItem"> | undefined = safeStorage()): void {
  const p = readProgress(userId, storage);
  const prompts = p.promptedVersion === version ? p.prompts + 1 : 1;
  write(userId, { ...p, prompts, promptedVersion: version }, storage);
}

/**
 * What to offer on arrival (always as a prompt the counsellor can decline):
 * - never seen the guide → "welcome";
 * - saw a version from before the newest features → "whats-new";
 * - up to date, or put off MAX_PROMPTS times for this version → nothing.
 */
export function arrivalAction(progress: TourProgress, version = TOUR_VERSION, whatsNewSince = WHATS_NEW_SINCE): "welcome" | "whats-new" | null {
  if (progress.seenVersion >= version) return null;
  if (progress.promptedVersion === version && progress.prompts >= MAX_PROMPTS) return null;
  if (progress.seenVersion <= 0) return "welcome";
  if (progress.seenVersion <= whatsNewSince) return "whats-new";
  return null;
}

function safeStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
