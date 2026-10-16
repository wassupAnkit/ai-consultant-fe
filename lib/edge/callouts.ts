/**
 * The answer prompt asks the model to put three kinds of caveat in their own paragraph, each
 * opening with a fixed phrase. The renderer turns those paragraphs into callouts so a
 * consultant cannot miss "Not in the knowledge base:" inside a wall of text.
 */
export type CalloutKind = "gap" | "note" | "basis";

export interface Callout {
  kind: CalloutKind;
  /** The opening phrase, without its colon, for the callout's label. */
  label: string;
  /** The text after the phrase (may be empty while it is still streaming). */
  body: string;
}

const PREFIXES: { kind: CalloutKind; phrase: string }[] = [
  { kind: "gap", phrase: "Not in the knowledge base" },
  { kind: "note", phrase: "General note, unsourced" },
  { kind: "basis", phrase: "Based on" },
];

/** Leading markdown emphasis or quotes the model sometimes wraps the phrase in. */
const LEAD = /^[\s*_"'“”]+/;

/** Recognise a paragraph that opens with one of the fixed phrases (case-insensitive, emphasis tolerated). */
export function detectCallout(text: string): Callout | null {
  const cleaned = text.replace(LEAD, "");
  for (const { kind, phrase } of PREFIXES) {
    if (cleaned.length < phrase.length || cleaned.slice(0, phrase.length).toLowerCase() !== phrase.toLowerCase()) continue;
    const rest = cleaned.slice(phrase.length).replace(/^[*_]+/, "");
    // "Based on: [1][2]" always has the colon; "Not in the knowledge base:" too. Without one it
    // is ordinary prose that happens to start with those words ("Based on your notes, …").
    if (!rest.startsWith(":")) continue;
    return { kind, label: phrase, body: rest.slice(1).replace(/^[*_]+/, "").trim() };
  }
  return null;
}

/**
 * The text a paragraph starts with, read off React children: strings, arrays, and elements
 * (a `<strong>` wrapping the phrase is common) — enough of it to test for a callout phrase.
 */
export function leadingText(node: unknown, limit = 64): string {
  let out = "";
  const walk = (n: unknown): void => {
    if (out.length >= limit || n === null || n === undefined || typeof n === "boolean") return;
    if (typeof n === "string" || typeof n === "number") {
      out += String(n);
      return;
    }
    if (Array.isArray(n)) {
      for (const child of n) walk(child);
      return;
    }
    if (typeof n === "object" && "props" in (n as object)) walk((n as { props?: { children?: unknown } }).props?.children);
  };
  walk(node);
  return out.slice(0, limit);
}
