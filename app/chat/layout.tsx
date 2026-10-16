import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatWorkspace, type WorkspaceUser } from "@/components/chat/chat-workspace";
import { getCaller } from "@/lib/auth/server";
import { env } from "@/config/env";

export const metadata: Metadata = { title: "Edge — Knowledge assistant" };
export const dynamic = "force-dynamic";

/**
 * Protected shell for the counsellor workspace. Google sign-in only — the
 * middleware already redirects unauthenticated requests, this is defence in
 * depth so the workspace itself never renders without a verified caller.
 */
export default async function ChatLayout({ children }: { children: React.ReactNode }) {
  const caller = await getCaller();
  if (!caller?.user) redirect("/?redirectedFrom=/chat");

  const user: WorkspaceUser = {
    id: caller.user.id,
    email: caller.user.email,
    name: caller.user.name,
    picture: caller.user.picture,
  };

  return (
    <ChatWorkspace user={user} features={{ documentUpload: env.DOCUMENT_UPLOAD_ENABLED }}>
      {children}
    </ChatWorkspace>
  );
}
