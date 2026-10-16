"use client";

import { useRouter } from "next/navigation";
import { CalendarDays, FileSpreadsheet, HardDrive, Laptop, Link2, Loader2, LogOut, Mail, Moon, RotateCcw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIntegrations, type IntegrationsState } from "@/hooks/use-integrations";
import { flush, track } from "@/lib/analytics";
import { signOut } from "@/lib/auth/client";
import { initialsOf } from "@/lib/format";
import { ACTION_LABEL, integrationAction, integrationRows, integrationStatusText, SERVICE_LABEL } from "@/lib/edge/integrations";
import type { IntegrationService, IntegrationStatus, IntegrationView } from "@/lib/edge/types";
import { cn } from "@/lib/utils";
import { useWorkspaceUser } from "./chat-workspace";

/** Account menu: who is signed in, the appearance setting, connected Google accounts, sign out. */
export function UserMenu() {
  const router = useRouter();
  const user = useWorkspaceUser();
  const { theme, setTheme } = useTheme();
  const integrations = useIntegrations();
  const name = user?.name ?? "Signed in";
  const email = user?.email ?? "";

  const logout = async () => {
    track("sign_out", {});
    flush(true);
    await signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <DropdownMenu onOpenChange={(open) => open && integrations.refresh()}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu" data-tour="account">
          <Avatar picture={user?.picture ?? null} name={user?.name ?? null} email={user?.email ?? null} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center gap-3 py-2">
          <Avatar picture={user?.picture ?? null} name={user?.name ?? null} email={user?.email ?? null} className="h-9 w-9 text-sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{name}</span>
            <span className="block truncate text-xs font-normal text-muted-foreground">{email}</span>
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Appearance</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light" className="gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" /> Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark" className="gap-2">
            <Moon className="h-4 w-4 text-muted-foreground" /> Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system" className="gap-2">
            <Laptop className="h-4 w-4 text-muted-foreground" /> System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <ConnectedAccounts state={integrations} />
        <DropdownMenuItem onClick={logout} className="gap-2">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const SERVICE_ICON: Record<IntegrationService, typeof Mail> = { gmail: Mail, drive: HardDrive, calendar: CalendarDays, docs: FileSpreadsheet };

const STATUS_TONE: Record<IntegrationStatus, string> = {
  connected: "text-muted-foreground",
  not_connected: "text-muted-foreground",
  reauth_required: "text-warning-foreground",
  error: "text-destructive",
};

/**
 * Gmail and Drive, one row each: the row is its own action (Connect / Reconnect / Disconnect),
 * so it stays one keyboard stop like every other item here. Selecting a row keeps the menu open,
 * so a disconnect shows its new status in place. Hidden entirely where the deployment has no
 * Google connection.
 */
function ConnectedAccounts({ state }: { state: IntegrationsState }) {
  if (state.enabled === false) return null;
  const known = state.enabled === true;
  const rows = integrationRows(state.integrations);
  const noneConnected = known && rows.every((r) => r.status === "not_connected");
  return (
    <>
      <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Connected accounts</DropdownMenuLabel>
      {!known && state.error ? (
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            state.refresh();
          }}
          className="gap-2 text-muted-foreground"
        >
          <RotateCcw className="h-4 w-4" /> {state.error} Retry
        </DropdownMenuItem>
      ) : (
        rows.map((view) => <AccountRow key={view.service} view={view} known={known} state={state} />)
      )}
      {noneConnected && (
        <DropdownMenuItem
          disabled={state.pending !== null}
          onSelect={(e) => {
            e.preventDefault();
            void state.connect(["gmail", "drive"]);
          }}
          className="gap-2.5"
        >
          {state.pending === "both" ? <Loader2 className="animate-spin text-muted-foreground" /> : <Link2 className="text-muted-foreground" />}
          <span className="flex-1">Connect both</span>
        </DropdownMenuItem>
      )}
      <DropdownMenuSeparator />
    </>
  );
}

function AccountRow({ view, known, state }: { view: IntegrationView; known: boolean; state: IntegrationsState }) {
  // A service the backend lists before this build knows it still renders, with a generic icon.
  const Icon = SERVICE_ICON[view.service] ?? Link2;
  const action = integrationAction(view.status);
  const busy = state.pending === view.service || state.pending === "both";
  const status = known ? integrationStatusText(view) : "Checking…";
  return (
    <DropdownMenuItem
      disabled={!known || state.pending !== null}
      onSelect={(e) => {
        e.preventDefault();
        if (action === "disconnect") void state.disconnect(view.service);
        else void state.connect([view.service]);
      }}
      aria-label={`${SERVICE_LABEL[view.service]}: ${status}. ${ACTION_LABEL[action]}`}
      className="gap-2.5"
    >
      <Icon className="text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block leading-tight">{SERVICE_LABEL[view.service]}</span>
        <span title={status} className={cn("block truncate text-[11px] leading-tight", STATUS_TONE[view.status])}>
          {status}
        </span>
      </span>
      {busy ? (
        <Loader2 className="animate-spin text-muted-foreground" />
      ) : (
        known && <span className={cn("shrink-0 text-xs font-medium", action === "disconnect" ? "text-muted-foreground" : "text-primary-strong")}>{ACTION_LABEL[action]}</span>
      )}
    </DropdownMenuItem>
  );
}

export function Avatar({ picture, name, email, className = "h-8 w-8 text-xs" }: { picture: string | null; name: string | null; email: string | null; className?: string }) {
  if (picture) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={picture} alt="" referrerPolicy="no-referrer" className={cn("rounded-full object-cover", className)} />;
  }
  return <span className={cn("inline-flex items-center justify-center rounded-full bg-primary-tint font-semibold text-primary-strong", className)}>{initialsOf(name, email)}</span>;
}
