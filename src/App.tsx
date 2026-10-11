import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { trpc } from "@/providers/trpc";
import { TabBar } from "@/components/TabBar";
import { Logo } from "@/components/Logo";

import Welcome from "@/pages/Welcome";
import Setup from "@/pages/Setup";
import Chats from "@/pages/Chats";
import ChatView from "@/pages/ChatView";
import ChatInfo from "@/pages/ChatInfo";
import Contacts from "@/pages/Contacts";
import Profile from "@/pages/Profile";
import UserView from "@/pages/UserView";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import Search from "@/pages/Search";
import NewChat from "@/pages/NewChat";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Maintenance from "@/pages/Maintenance";

// true — технические работы для обычных пользователей.
// Администраторы смогут пользоваться мессенджером.
const MAINTENANCE_MODE = true;

function Splash() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Logo size={76} />
      </motion.div>

      <div className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="tcy-typing-dot w-2 h-2 rounded-full tcy-accent-bg"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function AuthedApp() {
  const location = useLocation();
  const navigate = useNavigate();

const adminMe = trpc.profile.me.useQuery(undefined, {
  retry: false,
  staleTime: 30_000,
});

useEffect(() => {
  function handleKeyDown(event: KeyboardEvent) {
    const isYoKey =
      event.key.toLowerCase() === "ё" ||
      event.code === "Backquote";

    if (!isYoKey || event.repeat) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const target = event.target;

    if (
      target instanceof HTMLElement &&
      target.closest(
        'input, textarea, select, [contenteditable="true"]',
      )
    ) {
      return;
    }

    if (adminMe.data?.user.role !== "admin") return;

    event.preventDefault();
    navigate("/admin");
  }

  window.addEventListener("keydown", handleKeyDown);

  return () => {
    window.removeEventListener("keydown", handleKeyDown);
  };
}, [adminMe.data?.user.role, navigate]);

  useHeartbeat(true);

  const chats = trpc.chats.list.useQuery(undefined, {
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });

  const unreadTotal = (chats.data ?? []).reduce(
    (sum, c) =>
      sum + (c.membership.muted || c.membership.archived ? 0 : c.unread),
    0,
  );

  return (
    <div className="relative h-full">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={
            location.pathname.startsWith("/chat/")
              ? location.pathname
              : location.pathname.split("/")[1] || "/"
          }
          initial={{ opacity: 0, x: 24, scale: 0.99 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -16, scale: 0.995 }}
          transition={{
            type: "spring",
            stiffness: 380,
            damping: 38,
          }}
          className="absolute inset-0"
        >
          <Routes location={location}>
            <Route path="/" element={<Chats />} />
            <Route path="/chat/:id" element={<ChatView />} />
            <Route path="/chat/:id/info" element={<ChatInfo />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/user/:id" element={<UserView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/search" element={<Search />} />
            <Route path="/new" element={<NewChat />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <TabBar unreadTotal={unreadTotal} />
    </div>
  );
}

function Gate() {
  const { isAuthenticated, isLoading } = useAuth();

  const me = trpc.profile.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  if (isLoading || (isAuthenticated && me.isLoading)) {
    return <Splash />;
  }

  if (!isAuthenticated) {
    return <Welcome />;
  }

  if (me.data && !me.data.profile) {
    return <Setup />;
  }

  return <AuthedApp />;
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const maintenanceUser = trpc.profile.me.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
    staleTime: 30_000,
  });

  if (MAINTENANCE_MODE) {
    if (isLoading || (isAuthenticated && maintenanceUser.isLoading)) {
      return <Splash />;
    }

    if (
      !isAuthenticated ||
      maintenanceUser.data?.user.role !== "admin"
    ) {
      return <Maintenance />;
    }
  }

  return (
    <div className="tcy-app-shell">
      <div className="tcy-aurora" />

      <div className="relative z-10 h-full">
        {location.pathname === "/login" && !isAuthenticated ? (
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        ) : (
          <Gate />
        )}
      </div>
    </div>
  );
}
