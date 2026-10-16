import { redirect } from "next/navigation";
import { ThreadRoute } from "@/components/chat/thread-route";
import { isUuid } from "@/lib/edge/server";

/** An existing conversation, identified by the backend session UUID. */
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  if (!isUuid(sessionId)) redirect("/chat");
  return <ThreadRoute sessionId={sessionId} />;
}
