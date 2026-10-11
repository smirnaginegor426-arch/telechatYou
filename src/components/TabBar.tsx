import { NavLink, useLocation } from "react-router";
import { motion } from "framer-motion";
import { MessageCircle, Users, UserRound, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { to: "/", label: "Чаты", icon: MessageCircle },
  { to: "/contacts", label: "Люди", icon: Users },
  { to: "/profile", label: "Профиль", icon: UserRound },
  { to: "/settings", label: "Настройки", icon: Settings2 },
];

export function TabBar({ unreadTotal = 0 }: { unreadTotal?: number }) {
  const location = useLocation();
 const isChatScreen = /^\/chat\/\d+(?:\/info)?\/?$/.test(
  location.pathname,
);

const hidden =
  isChatScreen || location.pathname.startsWith("/setup");
  if (hidden) return null;

  return (
    <nav className="absolute bottom-0 left-0 right-0 z-30 safe-bottom">
      <div className="mx-4 mb-3 rounded-[26px] tcy-header-blur border tcy-line tcy-shadow-soft">
        <div className="grid grid-cols-4 h-[64px]">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active =
              to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
            return (
              <NavLink
                key={to}
                to={to}
                className="relative flex flex-col items-center justify-center gap-0.5"
              >
                <span className="relative">
                  <Icon
                    size={22}
                    strokeWidth={active ? 2.4 : 1.8}
                    style={{ color: active ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
                    className="transition-all duration-200"
                  />
                  {to === "/" && unreadTotal > 0 && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full tcy-gradient-accent text-[10px] font-bold flex items-center justify-center"
                      style={{ color: "var(--tcy-on-accent)" }}
                    >
                      {unreadTotal > 99 ? "99+" : unreadTotal}
                    </motion.span>
                  )}
                </span>
                <span
                  className={cn("text-[10.5px] font-semibold transition-colors")}
                  style={{ color: active ? "var(--tcy-accent)" : "var(--tcy-faint)" }}
                >
                  {label}
                </span>
                {active && (
                  <motion.span
                    layoutId="tab-glow"
                    className="absolute -bottom-[1px] w-8 h-[3px] rounded-full tcy-gradient-accent"
                    transition={{ type: "spring", stiffness: 500, damping: 36 }}
                  />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
