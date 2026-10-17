/**
 * The experimental plush/child-oriented interface has been retired.
 * Keep this compatibility hook returning a disabled state for existing
 * components until their old conditional branches are cleaned up.
 */
export function useTesterMode(_options: { enabled?: boolean } = {}) {
  return { isTester: false, enabled: false, isLoading: false };
}
