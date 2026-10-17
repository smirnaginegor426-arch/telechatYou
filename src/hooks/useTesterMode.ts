import { trpc } from "@/providers/trpc";

/**
 * Preview access is decided by the server from the signed-in account.
 * Never grant preview access based on query parameters or local storage.
 */
export function useTesterMode(options: { enabled?: boolean } = {}) {
  const queryEnabled = options.enabled ?? true;
  const access = trpc.experimentalAccess.useQuery(undefined, {
    enabled: queryEnabled,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  const enabled = access.data?.enabled === true;
  return {
    isTester: enabled,
    enabled,
    isLoading: queryEnabled && access.isLoading,
  };
}
