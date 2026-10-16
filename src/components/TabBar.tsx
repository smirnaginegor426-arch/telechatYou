import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router";
import { MessageCircle, Users, UserRound, Settings2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDeviceMode } from "@/hooks/useDeviceMode";

const tabs = [
  { to: "/", label: "Чаты", icon: MessageCircle },
  { to: "/contacts", label: "Друзья", icon: Users },
  { to: "/profile", label: "Профиль", icon: UserRound },
  { to: "/settings", label: "Настройки", icon: Settings2 },
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
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const longPressTimer = useRef<number | null>(null);
  const suppressClickRef = useRef(false);
  const hiddenOnMobile =
    /^\/chat\/(?:\d+|telechatyou)(?:\/info)?\/?$/.test(location.pathname) ||
    location.pathname.startsWith("/setup") ||
    location.pathname.startsWith("/folders") ||
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
      <div className="tcy-island mx-5 mb-2 rounded-[22px] border tcy-line tcy-header-blur">
        <div className="grid grid-cols-4 h-[56px]">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = activeTo === to;
            const highlighted = dragTarget ? dragTarget === to : active;
            return (
              <button
                key={to}
                type="button"
                data-tab-to={to}
                aria-label={label}
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
                  "relative h-full min-w-0 flex flex-col items-center justify-center gap-0 rounded-[21px] p-0 outline-none touch-none transition-[color,transform] duration-300",
                  highlighted && "tcy-tab-highlight",
                  dragTarget === to && "scale-[1.035]",
                )}
                style={{ color: highlighted ? "var(--tcy-selected-accent)" : "var(--tcy-faint)" }}
              >
                {highlighted && (
                  <motion.span
                    layoutId="tcy-tab-orb"
                    className="absolute inset-0 rounded-[20px] tcy-tab-orb pointer-events-none"
                    transition={{ type: "spring", stiffness: 220, damping: 27, mass: 0.85 }}
                  />
                )}
                <span className="tcy-tab-icon-wrap relative z-[1] flex h-10 items-center justify-center pointer-events-none">
                  <motion.span
                    animate={{ scale: highlighted ? 1.04 : 1, y: highlighted ? -1 : 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.8 }}
                  >
                    <Icon size={23} strokeWidth={highlighted ? 2.35 : 1.8} />
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
                      transition={{ type: "spring", stiffness: 320, damping: 25 }}
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
                      transition={{ duration: 0.24, ease: "easeOut" }}
                      className="relative z-[1] overflow-hidden whitespace-nowrap text-[9px] font-bold leading-[12px] pointer-events-none"
                    >
                      {label}
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
