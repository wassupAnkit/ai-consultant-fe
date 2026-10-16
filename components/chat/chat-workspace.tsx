"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { BookOpen, Menu, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ChatProvider, useChat } from "@/hooks/use-chat";
import { SessionsProvider } from "@/hooks/use-sessions";
import { GuideProvider } from "@/hooks/use-guide";
import { JourneyPill } from "@/components/guided/journey-pill";
import { SourcesPanelProvider, useSourcesPanel } from "@/hooks/use-sources-panel";
import { useSourcesDocked } from "@/hooks/use-media-query";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { BRAND } from "@/lib/constants";
import { readIntegrationParams } from "@/lib/edge/integrations";
import { SessionSidebar } from "./session-sidebar";
import { UserMenu } from "./user-menu";
import { SourcesPanel } from "@/components/sources/sources-panel";
import { useState } from "react";
import { ExpertLockup, ExpertMark } from "@/components/brand/expert-logo";
import { HelpButton } from "@/components/tour/help-button";
import { DocumentViewerProvider } from "./document-viewer";
import { TourProvider } from "@/components/tour/tour-provider";

export interface WorkspaceUser {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
}

const WorkspaceUserContext = createContext<WorkspaceUser | null>(null);
export function useWorkspaceUser(): WorkspaceUser | null {
  return useContext(WorkspaceUserContext);
}

/** Per-deployment switches, decided on the server (app/chat/layout.tsx). */
export interface WorkspaceFeatures {
  /** Attach passports and IDs in the composer; off until the backend has STUDENT_DOCS_ENABLED. */
  documentUpload: boolean;
}
const WorkspaceFeaturesContext = createContext<WorkspaceFeatures>({ documentUpload: false });
export function useWorkspaceFeatures(): WorkspaceFeatures {
  return useContext(WorkspaceFeaturesContext);
}

/**
 * Three-pane counsellor workspace: conversations · thread · sources. State
 * lives in providers here so navigating between /chat and /chat/[id] never
 * drops an in-flight answer. Only ever rendered for a signed-in Google user
 * (see app/chat/layout.tsx) — there is no anonymous variant.
 */
export function ChatWorkspace({ user, features = { documentUpload: false }, children }: { user: WorkspaceUser; features?: WorkspaceFeatures; children: ReactNode }) {
  return (
    <WorkspaceUserContext.Provider value={user}>
      <WorkspaceFeaturesContext.Provider value={features}>
        <SessionsProvider>
          <ChatProvider>
            <GuideProvider>
              <SourcesPanelProvider>
                <TourProvider userId={user.id} features={features}>
                  <DocumentViewerProvider>
                    <Shell>{children}</Shell>
                  </DocumentViewerProvider>
                </TourProvider>
              </SourcesPanelProvider>
            </GuideProvider>
          </ChatProvider>
        </SessionsProvider>
      </WorkspaceFeaturesContext.Provider>
    </WorkspaceUserContext.Provider>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const sources = useSourcesPanel();
  // Clicking a citation always sets the panel open, which is right on narrow screens where
  // it is a drawer. Where it is already docked in its own column, opening the drawer put an
  // open modal over the page: content hidden by `xl:hidden`, overlay and focus trap not.
  const docked = useSourcesDocked();
  const online = useOnlineStatus();
  useBackOnlineToast(online);
  useIntegrationResultToast();
  const { messages } = useChat();
  const citedCount = useMemo(() => {
    const target = sources.selectedMessageId ? messages.find((m) => m.id === sources.selectedMessageId) : [...messages].reverse().find((m) => m.role === "assistant" && (m.sources?.length ?? 0) > 0);
    return target?.sources?.length ?? 0;
  }, [messages, sources.selectedMessageId]);

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-3 sm:px-4">
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open conversations" data-tour="conversations" onClick={() => setSidebarOpen(true)}>
          <Menu />
        </Button>
        {/* One logo: the company lockup (navy on light, white on dark), then the product name. */}
        <Link href="/chat" aria-label={`${BRAND.name} by ${BRAND.company}, new chat`} className="flex items-center gap-3 rounded-md py-1 pr-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <ExpertLockup className="h-7 w-auto text-secondary dark:text-white" title={BRAND.company} />
          <span className="flex flex-col border-l border-border pl-3 leading-tight">
            <span className="font-heading text-[17px] font-semibold tracking-tight text-heading">{BRAND.name}</span>
            <span className="hidden text-[11px] text-muted-foreground sm:block">{BRAND.tagline}</span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {!online && <OfflineIndicator />}
          <JourneyPill />
          <Button variant="outline" size="sm" className="xl:hidden" onClick={() => sources.setOpen(true)} aria-label="Open sources panel" data-tour="sources">
            <BookOpen />
            <span className="hidden sm:inline">Sources</span>
            {citedCount > 0 && <span className="rounded-full bg-primary-tint px-1.5 text-[10px] font-semibold tabular-nums text-primary-strong">{citedCount}</span>}
          </Button>
          <HelpButton />
          <UserMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[272px] shrink-0 border-r border-border/70 bg-sidebar lg:flex lg:flex-col" data-tour="conversations">
          <SessionSidebar />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col">{children}</main>
        <aside className="hidden w-[380px] shrink-0 border-l border-border/70 xl:flex xl:flex-col" data-tour="sources">
          <SourcesPanel />
        </aside>
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" title="Conversations" className="bg-sidebar lg:hidden" overlayClassName="lg:hidden">
          <SessionSidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>
      <Sheet open={sources.open && !docked} onOpenChange={sources.setOpen}>
        <SheetContent side="right" title="Sources" className="xl:hidden" overlayClassName="xl:hidden">
          <SourcesPanel />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * A quiet header chip rather than a banner: losing the network mid-conversation should
 * explain the error the user is about to hit, not reflow the thread they are reading.
 */
function OfflineIndicator() {
  return (
    <span
      role="status"
      title="You're offline. Edge will work again as soon as your connection is back."
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground"
    >
      <WifiOff className="h-3.5 w-3.5" />
      {/* Narrow headers keep only the icon, but the word has to stay for screen readers. */}
      <span className="sr-only sm:not-sr-only">Offline</span>
    </span>
  );
}

/** Says so once when the connection returns, since a failed answer stays on screen until retried. */
function useBackOnlineToast(online: boolean) {
  const wasOffline = useRef(false);
  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
      return;
    }
    if (!wasOffline.current) return; // First mount, not a recovery.
    wasOffline.current = false;
    toast.success("You're back online.");
  }, [online]);
}

/**
 * Google's consent screen sends the consultant back through `/api/integrations/google/callback`
 * with `?connected=gmail,drive` or `?integrationError=<code>`. Say how it went once, then drop
 * the parameters without a reload so a refresh or a shared link never repeats it. Read from
 * `window.location` rather than `useSearchParams`, which would need a Suspense boundary here.
 */
function useIntegrationResultToast() {
  const router = useRouter();
  useEffect(() => {
    const { found, toast: result, rest } = readIntegrationParams(window.location.search);
    if (!found) return;
    // A fixed id: React's dev double-mount must not show it twice.
    if (result?.kind === "success") toast.success(result.message, { id: "integration-result" });
    else if (result) toast.error(result.message, { id: "integration-result" });
    router.replace(`${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`, { scroll: false });
  }, [router]);
}

/** Edge's avatar: the Expert Education book mark on a white tile, which keeps its blues legible in dark mode too. */
export function EdgeMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center justify-center rounded-lg bg-white shadow-sm ring-1 ring-border dark:ring-white/10 ${className}`} aria-hidden>
      <ExpertMark className="h-[72%] w-[72%]" />
    </span>
  );
}
