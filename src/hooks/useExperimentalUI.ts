import { trpc } from "@/providers/trpc";
import { isPrivateExperimentalUser } from "@/lib/testers";

/**
 * Private experimental interface gate.
 *
 * Only the private experimental account (see src/lib/testers.ts) receives the
 * experimental UI: the calm conversation refresh, the new wallpapers and the
 * tabbed settings. Everyone else keeps the stable, shipped look.
 *
 * Deliberately separate from useTesterMode — that hook drives the retired
 * plush/child interface and must stay disabled.
 */
export function useExperimentalUI(options: { enabled?: boolean } = {}) {
  const queryEnabled = options.enabled ?? true;
  const me = trpc.profile.me.useQuery(undefined, { enabled: queryEnabled });
  const enabled = isPrivateExperimentalUser(me.data?.profile?.username, me.data?.profile?.userId);
  return { enabled, isLoading: queryEnabled && me.isLoading };
}
