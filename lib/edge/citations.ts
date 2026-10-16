/**
 * The backend answers cite knowledge-base excerpts inline as `[n]`. Turn those
 * markers into markdown links to `#cite-n` so the renderer can draw them as
 * chips, while leaving fenced/inline code and existing links untouched.
 */
export const CITE_PREFIX = "#cite-";

const CODE_SPLIT = /(```[\s\S]*?```|~~~[\s\S]*?~~~|`[^`\n]*`)/g;
// [n] or [n][m]…, not already a link ("[1](url)") and not a reference definition ("[1]: url").
const CITATION = /\[(\d{1,2})\](?!\(|:)/g;

export function linkifyCitations(markdown: string): string {
  if (!markdown.includes("[")) return markdown;
  return markdown
    .split(CODE_SPLIT)
    .map((part, i) => (i % 2 === 1 ? part : part.replace(CITATION, (_m, n: string) => `[${n}](${CITE_PREFIX}${n})`)))
    .join("");
}

/** Citation number from a `#cite-n` href, or null. */
export function citationNumber(href: string | undefined | null): number | null {
  if (!href || !href.startsWith(CITE_PREFIX)) return null;
  const n = Number(href.slice(CITE_PREFIX.length));
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Distinct citation numbers that appear in an answer, in first-use order. */
export function citedNumbers(markdown: string): number[] {
  const seen = new Set<number>();
  for (const part of markdown.split(CODE_SPLIT).filter((_p, i) => i % 2 === 0)) {
    for (const m of part.matchAll(CITATION)) seen.add(Number(m[1]));
  }
  return [...seen];
}

/**
 * CRM records are cited like web pages but are not pages: the backend gives them a
 * `crm://<tool>/<hash>` URI, which no browser can open. Callers use this to render them
 * as records rather than links -- otherwise a counsellor checking where a figure came
 * from gets a dead link and the raw tool name.
 */
export function isCrmSource(source: { url?: string; docType?: string | null } | undefined): boolean {
  return source?.docType === "crm_record" || Boolean(source?.url?.startsWith("crm://"));
}

type SourceLike = { url?: string; docType?: string | null; source?: string | null };

/**
 * A thread from the consultant's own Gmail, read live this turn. Like a CRM record its `url`
 * is an identifier (`gmail://…`) no browser can open; `webUrl` carries the mail.google.com link.
 */
export function isGmailSource(source: SourceLike | undefined): boolean {
  return source?.source === "gmail" || source?.docType === "email_thread" || Boolean(source?.url?.startsWith("gmail://"));
}

/** A file from the consultant's own Google Drive: `drive://…` identifier, `webUrl` for the Drive/Docs page. */
export function isDriveSource(source: SourceLike | undefined): boolean {
  return source?.source === "drive" || source?.docType === "drive_file" || Boolean(source?.url?.startsWith("drive://"));
}

/** An event from the consultant's own Google Calendar: `calendar://…` identifier, `webUrl` for calendar.google.com. */
export function isCalendarSource(source: SourceLike | undefined): boolean {
  return source?.source === "calendar" || source?.docType === "calendar_event" || Boolean(source?.url?.startsWith("calendar://"));
}

/** Evidence from the consultant's own Google account (Gmail, Drive or Calendar), which gets its own colour. */
export function isWorkspaceSource(source: SourceLike | undefined): boolean {
  return isGmailSource(source) || isDriveSource(source) || isCalendarSource(source);
}

const BROWSABLE = /^https?:\/\//i;

/**
 * The page a reader can actually open for a source, or null when there is none.
 *
 * A CRM record links through `webUrl` -- the page the backend resolved for it in the CRM
 * front end -- never through its own `crm://` identifier, and many records (a rolled-up
 * count, say) have no page at all. Everything goes through the http(s) test, so a dead
 * scheme can never reach an `href` or `window.open` whatever the backend sends.
 */
export function openableUrl(source: (SourceLike & { webUrl?: string | null }) | undefined): string | null {
  if (!source) return null;
  // Gmail threads and Drive files open the same way: through `webUrl`, never their own URI.
  const candidate = isCrmSource(source) || isWorkspaceSource(source) ? source.webUrl : source.url;
  return candidate && BROWSABLE.test(candidate) ? candidate : null;
}

/** Where a source came from, in words: a hostname for a page, "your CRM" / "your Gmail" / "your Drive" otherwise. */
export function originOf(source: SourceLike & { url: string }): string {
  if (isCrmSource(source)) return "your CRM";
  if (isGmailSource(source)) return "your Gmail";
  if (isDriveSource(source)) return "your Drive";
  if (isCalendarSource(source)) return "your Calendar";
  return hostOf(source.url);
}

/**
 * The kind of evidence, as a short label: a CRM record, a page fetched live this turn, a web
 * search hit, or one of the indexed classes (our site, a partner university, a staff upload,
 * a program record). Live and indexed matter differently to a consultant checking a fee.
 */
export function provenanceLabel(source: { url?: string; docType?: string | null; sourceKind?: string | null; source?: string | null; live?: boolean }): string {
  if (isCrmSource(source)) return "CRM record";
  if (isGmailSource(source)) return "From your Gmail";
  if (isDriveSource(source)) return "From your Drive";
  if (isCalendarSource(source)) return "From your Calendar";
  const origin = source.source ?? "";
  if (source.live || origin.startsWith("live:")) return "Live page";
  if (origin.startsWith("web:")) return "Web search";
  switch (source.sourceKind) {
    case "partner":
      return "Partner site";
    case "upload":
      return "Uploaded document";
    case "program":
      return "Program record";
    case "site":
      return "Expert Education";
  }
  if (origin.startsWith("partner:")) return "Partner site";
  if (origin.startsWith("upload:")) return "Uploaded document";
  if (origin === "experteducation.com" || (source.url ?? "").includes("experteducation.com")) return "Expert Education";
  return "Knowledge base";
}

export function hostOf(url: string): string {
  // `new URL("crm://crm_list_my_tasks/…").hostname` is the tool name, which is meaningless
  // to a reader, so answer in words instead.
  if (url.startsWith("crm://")) return "your CRM";
  // Same for Gmail and Drive identifiers: the "host" would be a message or file id.
  if (url.startsWith("gmail://")) return "your Gmail";
  if (url.startsWith("drive://")) return "your Drive";
  if (url.startsWith("calendar://")) return "your Calendar";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
