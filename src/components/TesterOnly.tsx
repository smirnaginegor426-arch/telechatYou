import type { ReactNode } from "react";
import { useTesterMode } from "@/hooks/useTesterMode";

/**
 * Wrap experimental interface features in <TesterOnly> so non-test accounts
 * continue to see the stable version.
 */
export function TesterOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { enabled } = useTesterMode();
  return enabled ? <>{children}</> : <>{fallback}</>;
}
