"use client";

import { toast } from "sonner";
import { useEffect, useRef, useState, type ClipboardEvent, type DragEvent, type KeyboardEvent, type ReactNode } from "react";
import { ArrowUp, Atom, Paperclip, Square } from "lucide-react";
import { useChat } from "@/hooks/use-chat";
import { useGuide } from "@/hooks/use-guide";
import { AttachedStudent, MentionMenu, useStudentMention } from "@/components/guided/student-mention";
import { useChatShortcuts, useShortcutLabels } from "@/hooks/use-chat-shortcuts";
import { useComposerAttachments } from "@/hooks/use-composer-attachments";
import { MAX_MESSAGE_CHARS } from "@/lib/constants";
import { ATTACHMENT_ACCEPT, DEFAULT_ATTACHMENT_MESSAGE, MAX_ATTACHMENTS } from "@/lib/edge/attachments";
import { ComposerAttachmentChip } from "./attachment-chip";
import { useWorkspaceFeatures } from "./chat-workspace";
import { cn } from "@/lib/utils";

/** Tallest the input grows before it scrolls. */
const MAX_HEIGHT = 220;

/**
 * The message box. `hero` is the empty state's version — centred under the greeting, the
 * first thing to focus; `docked` floats over the foot of a conversation with a fade behind
 * it, so the thread scrolls under it rather than stopping short.
 */
export function Composer({ variant = "docked" }: { variant?: "hero" | "docked" }) {
  const { send, stop, status, draft, setDraft, deepThink, setDeepThink, activeSessionId } = useChat();
  const [value, setValue] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  // Student documents (passport, national ID): each uploads as soon as it is added.
  const files = useComposerAttachments(activeSessionId);
  const { documentUpload } = useWorkspaceFeatures();
  const [dragging, setDragging] = useState(false);
  const streaming = status === "streaming";
  const disabled = status === "loading";
  const keys = useShortcutLabels();
  const hero = variant === "hero";
  const g = useGuide();
  const { guide, current, student, pendingStudent } = g;
  const studentFirst = (student?.student?.name ?? pendingStudent?.name)?.split(/\s+/)[0];
  const [caret, setCaret] = useState(0);
  // `@` attaches a CRM student, only in a chat that is not already about one.
  const mention = useStudentMention({
    value,
    caret,
    enabled: !guide && !pendingStudent,
    onPick: (s, next) => {
      g.attachStudent(s);
      setValue(next.value);
      requestAnimationFrame(() => {
        const el = textarea.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(next.caret, next.caret);
        setCaret(next.caret);
      });
    },
  });

  // Mounted here because the composer is on every chat route and already holds both the
  // textarea ref and `stop`, which the workspace-wide shortcuts need.
  useChatShortcuts({ composer: textarea, stop, streaming });

  // The empty state exists to be typed into.
  useEffect(() => {
    if (hero) textarea.current?.focus();
  }, [hero]);

  // Text pushed from elsewhere (a starter prompt, "Ask Edge about this" in the sources panel).
  useEffect(() => {
    if (draft === null) return;
    setValue((v) => (v.trim() ? `${v.trimEnd()}\n${draft}` : draft));
    setDraft(null);
    requestAnimationFrame(() => {
      const el = textarea.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  }, [draft, setDraft]);

  // Grow with the text up to MAX_HEIGHT, then scroll — and only then show a scrollbar, so a
  // one-line question never sprouts the browser's scroll arrows.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT ? "auto" : "hidden";
  }, [value]);

  const submit = async () => {
    const typed = value.trim();
    if (files.uploading || (!typed && !files.ready) || streaming || disabled || g.busy || typed.length > MAX_MESSAGE_CHARS) return;
    if (files.failed.length) {
      toast.error(`Not uploaded: ${files.failed.join(", ")}. Remove it or add it again before sending.`);
      return;
    }
    // An attached student turns this chat into their guided session first; if that fails the
    // text stays in the box so nothing typed is lost.
    if (pendingStudent && !(await g.commitStudent())) return;
    const attachments = files.take();
    setValue("");
    // The message stays required: files with nothing typed ask Edge to read them.
    void send(typed || DEFAULT_ATTACHMENT_MESSAGE, { attachments });
  };

  // Only a drag that carries files lights the box up; dragged text still drops into the input.
  const carriesFiles = (e: DragEvent) => documentUpload && Array.from(e.dataTransfer.types).includes("Files");
  const onDragOver = (e: DragEvent<HTMLFormElement>) => {
    if (!carriesFiles(e) || disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e: DragEvent<HTMLFormElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  };
  const onDrop = (e: DragEvent<HTMLFormElement>) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    setDragging(false);
    if (!disabled) files.add(e.dataTransfer.files);
  };
  // A pasted screenshot or copied image file attaches; a paste that also carries text (a
  // rich-text copy from Word with an inline picture) stays a text paste.
  const onPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const images = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (!documentUpload || !images.length || e.clipboardData.getData("text/plain")) return;
    e.preventDefault();
    files.add(images);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.onKeyDown(e)) return;
    // Backspace at the very start drops an attached student, like removing a tag.
    if (e.key === "Backspace" && pendingStudent && e.currentTarget.selectionStart === 0 && e.currentTarget.selectionEnd === 0) {
      g.detachStudent();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  const over = value.length > MAX_MESSAGE_CHARS;
  const showCount = value.length > MAX_MESSAGE_CHARS * 0.85;
  const canSend = (Boolean(value.trim()) || files.ready > 0) && !files.uploading && !disabled && !over;
  const full = files.items.length >= MAX_ATTACHMENTS;

  return (
    <div className={cn(hero ? "w-full" : "bg-gradient-to-t from-background via-background/95 to-background/0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-6 sm:px-6")}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        data-tour="composer"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        // Clicking anywhere in the card that isn't a control puts the caret in the input.
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            e.preventDefault();
            textarea.current?.focus();
          }
        }}
        className={cn(
          "relative mx-auto w-full max-w-[46rem] cursor-text rounded-2xl border border-border bg-card px-4 pb-2.5 pt-3.5 shadow-md transition-[border-color,box-shadow]",
          "focus-within:border-primary/60 focus-within:ring-[3px] focus-within:ring-primary/15",
          over && "border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
          dragging && "border-primary ring-[3px] ring-primary/25",
        )}
      >
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary-tint/90 text-sm font-medium text-primary-strong" aria-hidden>
            Drop a passport or ID (PDF or image, up to 10 MB)
          </div>
        )}
        <MentionMenu mention={mention} />
        {files.items.length > 0 && (
          <div className="mb-2.5 flex flex-wrap gap-1.5" aria-label="Attached files">
            {files.items.map((item) => (
              <ComposerAttachmentChip key={item.key} item={item} onRemove={() => files.remove(item.key)} />
            ))}
          </div>
        )}
        <label htmlFor="edge-composer" className="sr-only">
          Message Edge
        </label>
        <textarea
          id="edge-composer"
          data-tour="mention"
          ref={textarea}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setCaret(e.target.selectionStart ?? e.target.value.length);
          }}
          onSelect={(e) => setCaret(e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          aria-controls={mention.open ? "student-mention-menu" : undefined}
          aria-autocomplete="list"
          rows={1}
          disabled={disabled}
          placeholder={
            guide && current
              ? `Ask about ${studentFirst ?? "the student"} · ${current.label}…`
              : pendingStudent
                ? `What do you want to work on with ${studentFirst}?`
                : hero
                  ? "Ask anything, or type @ to work through a student's journey…"
                  : "Reply to Edge, or @ a student…"
          }
          // `border-0 p-0 focus:ring-0 shadow-none` undo the @tailwindcss/forms defaults, which
          // drew a second hard-edged box inside the card.
          className={cn(
            "block w-full resize-none border-0 bg-transparent p-0 text-body text-foreground shadow-none outline-none placeholder:text-muted-foreground/70 focus:border-0 focus:outline-none focus:ring-0 disabled:opacity-60",
            hero && "min-h-[3.25rem]",
          )}
          style={{ maxHeight: MAX_HEIGHT }}
        />

        <div className="mt-2.5 flex items-center gap-2">
          {/* DeepThink: the next questions are reasoned harder, slower, with the working shown
              above the answer. Sticky per browser; applies from the next send. */}
          <button
            type="button"
            data-tour="deepthink"
            onClick={() => setDeepThink(!deepThink)}
            aria-pressed={deepThink}
            title={deepThink ? "DeepThink is on: slower, reasons harder and shows its working" : "Turn on DeepThink for harder questions (slower)"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
              deepThink ? "border-primary bg-primary text-primary-foreground shadow-cta hover:bg-primary-strong" : "border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            <Atom className="h-3.5 w-3.5" />
            DeepThink
          </button>
          {/* Student documents: a passport or citizenship/national ID for Edge to read. */}
          {documentUpload && (
            <>
              <button
                type="button"
                data-tour="attach"
                onClick={() => fileInput.current?.click()}
                disabled={disabled || full}
                aria-label="Attach files"
                title={full ? `Up to ${MAX_ATTACHMENTS} files per message` : "Attach a passport or ID (PDF or image, up to 10 MB)"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:border-primary/50 hover:text-foreground focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <input
                ref={fileInput}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                tabIndex={-1}
                onChange={(e) => {
                  if (e.target.files) files.add(e.target.files);
                  // Reset so picking the same file again (after removing it) fires change.
                  e.target.value = "";
                }}
              />
            </>
          )}
          {deepThink && !pendingStudent && <span className="hidden text-[11px] text-muted-foreground sm:inline">Slower, reasons harder</span>}
          {pendingStudent && <AttachedStudent student={pendingStudent} onRemove={g.detachStudent} />}

          <div className="ml-auto flex items-center gap-2">
            {showCount && (
              <span className={cn("text-[11px] tabular-nums text-muted-foreground", over && "font-medium text-destructive")}>
                {value.length.toLocaleString()} / {MAX_MESSAGE_CHARS.toLocaleString()}
              </span>
            )}
            {streaming ? (
              <button
                type="button"
                onClick={stop}
                aria-label="Stop generating"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-destructive/40 bg-destructive/10 text-destructive transition hover:bg-destructive/20 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-destructive/30"
              >
                <Square className="h-3.5 w-3.5 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                aria-label={files.uploading ? "Send (waiting for uploads)" : "Send"}
                title={files.uploading ? "Waiting for the files to finish uploading" : undefined}
                disabled={!canSend}
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full transition focus:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                  canSend ? "bg-primary text-primary-foreground shadow-cta hover:bg-primary-strong" : "cursor-not-allowed bg-muted text-muted-foreground",
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </form>
      <p className="mx-auto mt-2 flex w-full max-w-[46rem] flex-wrap items-center justify-center gap-x-1.5 px-1 text-center text-[11px] text-muted-foreground/80">
        <span>Check the cited sources before advising a student.</span>
        {/* Shortcuts matter on a keyboard only; on a phone this line would just crowd the input. */}
        <span className="hidden md:inline">
          · <Key>Enter</Key> send · <Key>Shift</Key>+<Key>Enter</Key> new line · <Key>{keys.mod}</Key>+<Key>K</Key> search · <Key>{keys.mod}</Key>+<Key>{keys.shift}</Key>+<Key>O</Key> new chat
          {streaming && (
            <>
              {" "}
              · <Key>Esc</Key> stop
            </>
          )}
        </span>
      </p>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return <kbd className="font-sans font-medium text-muted-foreground">{children}</kbd>;
}
