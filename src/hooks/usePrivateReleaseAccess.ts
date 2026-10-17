import { trpc } from "@/providers/trpc";

/**
 * Access to the unreleased version is determined by the authenticated account
 * on the server. This is separate from the retired plush-interface toggle.
 */
export function usePrivateReleaseAccess(options: { enabled?: boolean } = {}) {
  const queryEnabled = options.enabled ?? true;
  const access = trpc.experimentalAccess.useQuery(undefined, {
    enabled: queryEnabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  return {
    enabled: access.data?.enabled === true,
    isLoading: queryEnabled && access.isLoading,
  };
}
