import { ThreadRoute } from "@/components/chat/thread-route";

/** New conversation: empty state with starter prompts. */
export default function NewChatPage() {
  return <ThreadRoute sessionId={null} />;
}
