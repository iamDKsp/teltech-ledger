import { useEffect } from "react";
import { API } from "../lib/api";

/** Poll only a revision counter, then refresh consumers if a webhook committed. */
export function WebhookSync() {
  useEffect(() => {
    let stopped = false;
    let busy = false;
    let revision: number | null = null;
    const controller = new AbortController();
    const check = async () => {
      if (stopped || busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const result = await API.get<{ revision: number }>("/integrations/webhooks/revision", { signal: controller.signal });
        if (stopped) return;
        // First read also closes the gap between page fetch and monitor startup.
        if (revision === null ? result.revision > 0 : result.revision !== revision) {
          window.dispatchEvent(new CustomEvent("teltech:finance-synced"));
          window.dispatchEvent(new CustomEvent("teltech:client-saved"));
        }
        revision = result.revision;
      } catch { /* Network interruption will be retried on the next tick. */ }
      finally { busy = false; }
    };
    void check();
    const interval = window.setInterval(() => void check(), 10_000);
    const onVisible = () => void check();
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
