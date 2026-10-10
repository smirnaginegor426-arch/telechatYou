import { useEffect } from "react";
import { trpc } from "@/providers/trpc";

/** sends a heartbeat every 25s so contacts see the user online */
export function useHeartbeat(enabled: boolean) {
  const hb = trpc.profile.heartbeat.useMutation();
  useEffect(() => {
    if (!enabled) return;
    hb.mutate();
    const t = setInterval(() => hb.mutate(), 25_000);
    const onVis = () => {
      if (document.visibilityState === "visible") hb.mutate();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
