import { useEffect, useState } from "react";

export type DeviceMode = "mobile" | "desktop";

/**
 * Prefer a spacious desktop layout only when both viewport width and pointer
 * capabilities indicate a laptop/desktop. It reacts to resizes, dock/undock,
 * and changes between touch and mouse environments without a reload.
 */
export function useDeviceMode(): DeviceMode {
  const [mode, setMode] = useState<DeviceMode>(() => {
    if (typeof window === "undefined") return "mobile";
    return window.matchMedia("(min-width: 900px) and (any-pointer: fine)").matches
      ? "desktop"
      : "mobile";
  });

  useEffect(() => {
    const query = window.matchMedia("(min-width: 900px) and (any-pointer: fine)");
    const update = () => setMode(query.matches ? "desktop" : "mobile");
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mode;
}
