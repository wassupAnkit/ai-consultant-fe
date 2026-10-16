"use client";

import { useEffect } from "react";
import { useChat } from "@/hooks/use-chat";
import { ChatThread } from "./chat-thread";

/**
 * Bridges the route segment to the workspace state: /chat shows the new-chat
 * state, /chat/[sessionId] loads that conversation. Rendered by both pages so
 * the thread itself never depends on the URL.
 */
export function ThreadRoute({ sessionId }: { sessionId: string | null }) {
  const { openSession } = useChat();
  useEffect(() => {
    openSession(sessionId);
  }, [sessionId, openSession]);
  return <ChatThread />;
}
