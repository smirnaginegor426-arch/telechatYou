import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { MessageCircle, Users, UserRound, Settings2, Sparkles } from "lucide-react";
import { useTesterMode } from "@/hooks/useTesterMode";
import { cn } from "@/lib/utils";
import { useDeviceMode } from "@/hooks/useDeviceMode";
import {
  getNavigationIslandPreferences,
  subscribeNavigationIslandPreferences,
  type NavigationTabId,
} from "@/lib/navigation-island-preferences";

const tabs = [
  { to: "/", label: "Чаты", icon: MessageCircle, plushEmoji: "💌" },
  { to: "/contacts", label: "Люди", plushLabel: "Друзья", icon: Users, plushEmoji: "🐰" },
  { to: "/profile", label: "Профиль", icon: UserRound, plushEmoji: "🐱" },
  { to: "/settings", label: "Настройки", icon: Settings2, plushEmoji: "🌈" },
];

type Gesture = {
  pointerId: number;
  startX: number;
  startY: number;
  originTo: string;
  targetTo: string | null;
  dragging: boolean;
};

export function TabBar({ unreadTotal = 0 }: { unreadTotal?: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const deviceMode = useDeviceMode();
  const { enabled: isPrivateTester } = useTesterMode();
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [islandPreferences, setIslandPreferences] = useState(getNavigationIslandPreferences);
  const orderedTabs = [...tabs].sort(
    (a, b) =>
      islandPreferences.order.indexOf(a.to as NavigationTabId) -
      islandPreferences.order.indexOf(b.to as NavigationTabId),
  );

  useEffect(() => subscribeNavigationIslandPreferences(setIslandPreferences), []);
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const hiddenOnMobile =
    /^\/chat\/(?:\d+|telechatyou)(?:\/info)?\/?$/.test(location.pathname) ||
    location.pathname.startsWith("/setup") ||
    location.pathname.startsWith("/email-binding") ||
    location.pathname.startsWith("/folders") ||
    location.pathname.startsWith("/settings/") ||
    location.pathname.startsWith("/invite") ||
    location.pathname.startsWith("/stickers");
  const hidden = location.pathname.startsWith("/create") || (deviceMode !== "desktop" && hiddenOnMobile);
  const activeTo =
    location.pathname === "/"
      ? "/"
      : tabs.find((tab) => tab.to !== "/" && location.pathname.startsWith(tab.to))?.to ?? "/";

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Keep the moving indicator in place until the navigation animation commits.
  useEffect(() => {
    setDragTarget(null);
  }, [location.pathname]);

  useEffect(() => {
    const getTabAtPoint = (x: number, y: number) => {
      const to = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-tab-to]")?.dataset.tabTo;
      return to && tabs.some((tab) => tab.to === to) ? to : null;
    };

    const onMove = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      // Moving before the long press engages cancels the hold to avoid accidental drags.
      if (!gesture.dragging) {
        if (
          Math.hypot(event.clientX - gesture.startX, event.clientY - gesture.startY) > 12 &&
          longPressTimer.current !== null
        ) {
          window.clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        return;
      }

      event.preventDefault();
      const next = getTabAtPoint(event.clientX, event.clientY);
      if (next !== gesture.targetTo) {
        gesture.targetTo = next;
        setDragTarget(next);
      }
    };

    const onUp = (event: PointerEvent) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;

      clearLongPress();
      gestureRef.current = null;

      if (!gesture.dragging) {
        setDragTarget(null);
        return;
      }

      event.preventDefault();
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);

      const target = getTabAtPoint(event.clientX, event.clientY);
      if (target && target !== activeTo) {
        // Do not remove the shared layout indicator yet: let it travel to the
        // destination, then release it when the route changes.
        setDragTarget(target);
        navigate(target);
      } else {
        setDragTarget(null);
      }
    };

    const onCancel = (event: PointerEvent) => {
      if (gestureRef.current?.pointerId !== event.pointerId) return;
      clearLongPress();
      gestureRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      clearLongPress();
    };
  }, [activeTo, navigate]);

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, to: string) => {
    if (!event.isPrimary || event.button !== 0) return;
    clearLongPress();
    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originTo: to,
      targetTo: to,
      dragging: false,
    };
    longPressTimer.current = window.setTimeout(() => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.pointerId !== event.pointerId) return;
      gesture.dragging = true;
      setDragTarget(gesture.targetTo);
      if ("vibrate" in navigator) navigator.vibrate?.(12);
    }, 260);
  };

  if (hidden) return null;

  return (
    <nav
      aria-label="Основная навигация"
      className="tcy-main-nav absolute bottom-0 left-0 right-0 z-30 safe-bottom tcy-no-select"
    >
      <div
        className="tcy-island mx-auto mb-2 rounded-full border tcy-line tcy-header-blur"
        style={{
          width: `min(${islandPreferences.width}px, calc(100vw - 56px))`,
          transform: activeTo === "/settings" ? "rotate(180deg)" : "rotate(0deg)",
          transformOrigin: "center center",
          transition: "width 250ms ease, transform 420ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="grid grid-cols-4 h-[54px]">
          {orderedTabs.map(({ to, label, plushLabel, icon: Icon, plushEmoji }) => {
            const active = activeTo === to;
            const highlighted = dragTarget ? dragTarget === to : active;
            const displayLabel = isPrivateTester ? (plushLabel ?? label) : label;
            return (
              <button
                key={to}
                type="button"
                data-tab-to={to}
                aria-label={displayLabel}
                aria-current={active ? "page" : undefined}
                onPointerDown={(event) => onPointerDown(event, to)}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  navigate(to);
                }}
                className={cn(
                  "relative h-full min-w-0 flex flex-col items-center justify-center gap-0 rounded-full p-0 outline-none touch-none transition-[color,transform] duration-300 ease-out",
                  highlighted && "tcy-tab-highlight",
                  dragTarget === to && "scale-[1.015]",
                )}
                style={{ color: highlighted ? "var(--tcy-selected-accent)" : "var(--tcy-faint)" }}
              >
                {highlighted && (
                  <motion.span
                    layoutId="tcy-tab-orb"
                    className="absolute inset-0 rounded-full tcy-tab-orb pointer-events-none"
                    transition={
                      isPrivateTester
                        ? { type: "tween", duration: 0.42, ease: [0.22, 1, 0.36, 1] }
                        : { type: "spring", stiffness: 155, damping: 28, mass: 1.05 }
                    }
                  />
                )}
                <span className="tcy-tab-icon-wrap relative z-[1] flex h-10 items-center justify-center pointer-events-none">
                  <motion.span
                    animate={{ scale: highlighted ? (isPrivateTester ? 1.12 : 1.04) : 1, y: highlighted ? -1 : 0, rotate: isPrivateTester && highlighted ? [0, -3, 3, 0] : 0 }}
                    transition={{ type: "spring", stiffness: 210, damping: 28, mass: 0.95 }}
                    className={isPrivateTester ? "tcy-tab-emoji" : "inline-flex items-center justify-center"}
                    aria-hidden="true"
                  >
                    {isPrivateTester ? plushEmoji : <Icon size={23} strokeWidth={highlighted ? 2.35 : 1.8} />}
                  </motion.span>
                  {to === "/" && unreadTotal > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-3 min-w-[17px] h-[17px] px-1 rounded-full tcy-gradient-accent text-[10px] font-bold flex items-center justify-center"
                      style={{ color: "var(--tcy-selected-on-accent)" }}
                    >
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </motion.span>
                  )}
                  {highlighted && (
                    <motion.span
                      className="absolute -right-2 -top-0.5 tcy-tab-spark"
                      initial={{ opacity: 0, scale: 0.4, rotate: -35 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <Sparkles size={10} />
                    </motion.span>
                  )}
                </span>
                <AnimatePresence initial={false}>
                  {highlighted && (
                    <motion.span
                      key={to + "-label"}
                      initial={{ opacity: 0, y: 5, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 12 }}
                      exit={{ opacity: 0, y: 4, height: 0 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      className="relative z-[1] overflow-hidden whitespace-nowrap text-[9px] font-bold leading-[12px] pointer-events-none"
                    >
                      {displayLabel}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
