import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Route, Routes, useLocation } from "react-router";
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
import Search from "@/pages/Search";
import NewChat from "@/pages/NewChat";
import Login from "@/pages/Login";
import PasswordRecovery from "@/pages/PasswordRecovery";
import NotFound from "@/pages/NotFound";

function Splash() {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6">
      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
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

/** Public auth pages that live outside the signed-in gate. */
const PUBLIC_AUTH_PATHS = ["/login", "/recover"];

function AuthedApp() {
  const location = useLocation();
  useHeartbeat(true);
  const settingsQuery = trpc.settings.get.useQuery();
  const animations = settingsQuery.data?.animations ?? true;
  useEffect(() => {
    document.documentElement.dataset.anim = animations ? "on" : "off";
  }, [animations]);
  const chats = trpc.chats.list.useQuery(undefined, {
    refetchInterval: 8000,
    refetchIntervalInBackground: false,
  });
  const unreadTotal = (chats.data ?? []).reduce(
    (sum, c) => sum + (c.membership.muted || c.membership.archived ? 0 : c.unread),
    0,
  );

  return (
    <div className="relative h-full">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={location.pathname.startsWith("/chat/") ? location.pathname : location.pathname.split("/")[1] || "/"}
          initial={{ opacity: 0, x: 24, scale: 0.99 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -16, scale: 0.995 }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
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

  if (isLoading || (isAuthenticated && me.isLoading)) return <Splash />;
  if (!isAuthenticated) return <Welcome />;
  if (me.data && !me.data.profile) return <Setup />;
  return <AuthedApp />;
}

export default function App() {
  const location = useLocation();
  return (
    <div className="tcy-app-shell">
      <div className="tcy-aurora" />
      <div className="relative z-10 h-full">
        {PUBLIC_AUTH_PATHS.includes(location.pathname) ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/recover" element={<PasswordRecovery />} />
          </Routes>
        ) : (
          <Gate />
        )}
      </div>
    </div>
  );
}
