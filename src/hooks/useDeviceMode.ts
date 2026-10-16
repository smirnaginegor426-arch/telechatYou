import { useEffect, useState } from "react";

export type DeviceMode = "mobile" | "desktop";

/**
 * Use the desktop workspace only when the primary input is a mouse/trackpad
 * and the viewport is wide enough. Checking the primary pointer (rather than
 * any-pointer) keeps touch phones in the mobile layout even if a fine pointer
 * is also reported by a browser or connected accessory.
 */
export function useDeviceMode(): DeviceMode {
  const [mode, setMode] = useState<DeviceMode>(() => {
    if (typeof window === "undefined") return "mobile";
    return window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)").matches
      ? "desktop"
      : "mobile";
  });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px) and (hover: hover) and (pointer: fine)");
    const update = () => setMode(query.matches ? "desktop" : "mobile");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mode;
}
