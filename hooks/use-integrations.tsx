"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { track } from "@/lib/analytics";
import { EdgeApiError, connectGoogle, disconnectGoogle, listIntegrations } from "@/lib/edge/api";
import { SERVICE_LABEL } from "@/lib/edge/integrations";
import type { IntegrationService, IntegrationView } from "@/lib/edge/types";

export interface IntegrationsState {
  /** null until the first answer; false hides the whole section (this deployment has no Google connection). */
  enabled: boolean | null;
  integrations: IntegrationView[];
  loading: boolean;
  error: string | null;
  /** The service a Connect/Disconnect is in flight for; "both" for Connect both. */
  pending: IntegrationService | "both" | null;
  refresh: () => void;
  connect: (services: IntegrationService[]) => Promise<void>;
  disconnect: (service: IntegrationService) => Promise<void>;
}

/**
 * The consultant's Gmail and Drive connections, for the account menu. Loads once on mount and
 * again whenever `refresh` is called (the menu calls it each time it opens), keeping the last
 * answer on screen meanwhile so the rows never flicker. Connect sends the browser to Google's
 * consent screen; `/api/integrations/google/callback` brings it back here with `?connected=`.
 */
export function useIntegrations(): IntegrationsState {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<IntegrationService | "both" | null>(null);
  const inflight = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    inflight.current?.abort();
    const ctrl = new AbortController();
    inflight.current = ctrl;
    setLoading(true);
    listIntegrations(ctrl.signal)
      .then((body) => {
        setEnabled(body.enabled);
        setIntegrations(body.integrations ?? []);
        setError(null);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        // A backend without the integrations routes yet answers 404: same as switched off.
        if (err instanceof EdgeApiError && err.status === 404) {
          setEnabled(false);
          return;
        }
        setError("Couldn't load connected accounts.");
      })
      .finally(() => {
        if (inflight.current === ctrl) {
          inflight.current = null;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    refresh();
    return () => inflight.current?.abort();
  }, [refresh]);

  const connect = useCallback(async (services: IntegrationService[]) => {
    setPending(services.length > 1 ? "both" : services[0]!);
    track("integration_connect", { services: services.join(",") });
    try {
      const url = await connectGoogle(services, window.location.pathname);
      // Leaves the page; `pending` stays set so the row reads as busy until it does.
      window.location.assign(url);
    } catch (err) {
      setPending(null);
      if (err instanceof EdgeApiError && err.status === 503) {
        setEnabled(false);
        toast.error("Google connections aren't available right now.");
        return;
      }
      toast.error(err instanceof EdgeApiError ? err.message : "Couldn't reach Google. Try again.");
    }
  }, []);

  const disconnect = useCallback(async (service: IntegrationService) => {
    setPending(service);
    track("integration_disconnect", { service });
    try {
      const result = await disconnectGoogle(service);
      setIntegrations(result.integrations);
      if (result.revoked === false) toast.warning(`${SERVICE_LABEL[service]} disconnected from Edge, but Google didn't confirm. Remove Edge under Google Account › Security › Third-party access.`);
      else toast.success(`${SERVICE_LABEL[service]} disconnected.`);
    } catch (err) {
      toast.error(err instanceof EdgeApiError ? err.message : `Couldn't disconnect ${SERVICE_LABEL[service]}. Try again.`);
    } finally {
      setPending(null);
    }
  }, []);

  return { enabled, integrations, loading, error, pending, refresh, connect, disconnect };
}
