/**
 * The experimental plush/child-oriented interface has been retired.
 * Keep this compatibility hook returning a disabled state for existing
 * components until their old conditional branches are cleaned up.
 *
 * The active private-experimental interface gate (calm chat, new wallpapers,
 * tabbed settings) lives in useExperimentalUI — it must stay separate so the
 * retired plush theme never activates again.
 */
export function useTesterMode(_options: { enabled?: boolean } = {}) {
  return { isTester: false, enabled: false, isLoading: false };
}
