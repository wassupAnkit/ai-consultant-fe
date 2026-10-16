import type { ChatMessage } from "@/lib/edge/types";
import { MessageAttachments } from "./attachment-chip";

/**
 * The consultant's turn: a soft tinted card on the right, in the same reading size as the
 * answer. Not a saturated bubble — the answer is the thing to read, the question is context.
 * Files sent with it sit underneath as thumbnails that open in the in-app viewer.
 */
export function UserMessage({ message }: { message: ChatMessage }) {
  const attachments = message.attachments ?? [];
  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary-tint px-4 py-2.5 text-body text-foreground sm:max-w-[78%]">{message.content}</div>
      {attachments.length > 0 && (
        <div className="flex max-w-[85%] flex-wrap justify-end gap-2 sm:max-w-[78%]" aria-label="Attached files">
          <MessageAttachments attachments={attachments} />
        </div>
      )}
    </div>
  );
}
