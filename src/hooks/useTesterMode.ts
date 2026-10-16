import { trpc } from "@/providers/trpc";

/**
 * Gate experimental UI using a permission returned by the server from the
 * currently authenticated account. Do not gate experiments using URL params.
 */
export function useTesterMode(options: { enabled?: boolean } = {}) {
  const shouldQuery = options.enabled ?? true;
  const access = trpc.experimentalAccess.useQuery(undefined, {
    enabled: shouldQuery,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const enabled = access.data?.enabled === true;

  return { isTester: enabled, enabled, isLoading: shouldQuery && access.isLoading };
}
