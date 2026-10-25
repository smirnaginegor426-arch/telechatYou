import { useEffect } from "react";
import { AnimatePresence, motion, type TargetAndTransition } from "framer-motion";
import { Route, Routes, useLocation, useNavigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import { useHeartbeat } from "@/hooks/useHeartbeat";
import { trpc } from "@/providers/trpc";
import { TabBar } from "@/components/TabBar";
import { IncomingCallNotice } from "@/components/IncomingCallNotice";
import { AccountCollectionsSync } from "@/components/AccountCollectionsSync";
import { CustomLanguageBridge } from "@/components/CustomLanguageBridge";
import { Logo } from "@/components/Logo";
import { ConnectionLoader } from "@/components/ConnectionLoader";
import { useDeviceMode } from "@/hooks/useDeviceMode";
import { useTesterMode } from "@/hooks/useTesterMode";
import { useExperimentalUI } from "@/hooks/useExperimentalUI";
import { hideBootSplash } from "@/lib/boot-splash";

import Welcome from "@/pages/Welcome";
import WelcomeLegacy from "@/pages/WelcomeLegacy";
import Setup from "@/pages/Setup";
import SetupLegacy from "@/pages/SetupLegacy";
import RegisterWizard from "@/pages/RegisterWizard";
import RegisterWizardLegacy from "@/pages/RegisterWizardLegacy";
import Chats from "@/pages/Chats";
import ChatView from "@/pages/ChatView";
import ChatInfo from "@/pages/ChatInfo";
import RenameChat from "@/pages/RenameChat";
import Contacts from "@/pages/Contacts";
import Profile from "@/pages/Profile";
import UserView from "@/pages/UserView";
import Settings, { SettingsSectionScreen } from "@/pages/Settings";
import NavigationIslandSettings from "@/pages/NavigationIslandSettings";
import AccountSecurityPassword from "@/pages/AccountSecurityPassword";
import EmailBinding from "@/pages/EmailBinding";
import Halloween from "@/pages/Halloween";
import AccentSettings from "@/pages/Accent";
import FontSettings from "@/pages/FontSettings";
import Wallpapers from "@/pages/Wallpapers";
import StickerPackCreate from "@/pages/StickerPackCreate";
import ChatFolders from "@/pages/ChatFolders";
import CustomLanguage from "@/pages/CustomLanguage";
import SystemUpdate from "@/pages/SystemUpdate";
import EncryptedChats from "@/pages/EncryptedChats";
import Admin from "@/pages/Admin";
import Search from "@/pages/Search";
import NewChat from "@/pages/NewChat";
import CreateCommunity from "@/pages/CreateCommunity";
import JoinInvite from "@/pages/JoinInvite";
import ChannelsPage from "@/pages/Channels";
import Login from "@/pages/Login";
import Recover from "@/pages/Recover";
import AccountsPage from "@/pages/Accounts";
import NotFound from "@/pages/NotFound";
import Maintenance from "@/pages/Maintenance";

// true — технические работы для обычных пользователей.
// Администраторы смогут пользоваться мессенджером.
const MAINTENANCE_MODE = false;

function Splash() {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--tcy-bg)" }}
    >
      <ConnectionLoader />
    </div>
  );
}

function AuthedApp() {
  const location = useLocation();
  const navigate = useNavigate();
  const deviceMode = useDeviceMode();
  const isDesktop = deviceMode === "desktop";
  const { enabled: experimentalUI } = useExperimentalUI();


  const desktopHome = isDesktop && location.pathname === "/";
  const desktopChat = isDesktop && /^\/chat\/\d+\/?$/.test(location.pathname);
  const desktopInbox = desktopHome || desktopChat;

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

  // Each screen enters from its own corner.
  const path = location.pathname;
  const slideMotion = path.startsWith("/email-binding")
    ? { origin: "100% 100%", x: 26, y: 22, exitX: 18, exitY: 16 }
    : path.startsWith("/contacts")
      ? { origin: "100% 0%", x: 26, y: -22, exitX: 18, exitY: -14 }
    : path.startsWith("/profile") || path.startsWith("/user/")
      ? { origin: "100% 100%", x: 26, y: 22, exitX: 18, exitY: 16 }
      : ["/settings", "/halloween", "/accent", "/font", "/wallpapers", "/stickers", "/language", "/system-update", "/rename-chat", "/encrypted"].some((route) => path.startsWith(route))
        ? { origin: "0% 100%", x: -26, y: 22, exitX: -18, exitY: 16 }
        : path.startsWith("/chat/")
          ? { origin: "0% 0%", x: -26, y: -22, exitX: -18, exitY: -14 }
          : path.startsWith("/search") || path.startsWith("/new") || path.startsWith("/create") || path.startsWith("/channels")
            ? { origin: "100% 50%", x: 28, y: 0, exitX: 20, exitY: 0 }
            : { origin: "0% 0%", x: -26, y: -22, exitX: -18, exitY: -14 };

  // Private experimental look: the incoming screen pivots around the corner it
  // comes from (a circular swing) and its corners round out as it settles into
  // place. Everyone else keeps the plain diagonal slide.
  const routeMotion: {
    initial: TargetAndTransition;
    animate: TargetAndTransition;
    exit: TargetAndTransition;
    origin: string;
  } = experimentalUI
    ? {
        initial: { opacity: 0, rotate: slideMotion.x >= 0 ? 7 : -7, scale: 0.9, borderRadius: "30px" },
        animate: { opacity: 1, rotate: 0, scale: 1, borderRadius: "0px" },
        exit: { opacity: 0, rotate: slideMotion.x >= 0 ? -5 : 5, scale: 0.94, borderRadius: "26px" },
        origin: slideMotion.origin,
      }
    : {
        initial: { opacity: 0, x: slideMotion.x, y: slideMotion.y, scale: 0.88 },
        animate: { opacity: 1, x: 0, y: 0, scale: 1 },
        exit: { opacity: 0, scale: 0.94, x: slideMotion.exitX, y: slideMotion.exitY },
        origin: slideMotion.origin,
      };

  return (
    <div className={`relative h-full tcy-authed-layout ${desktopHome ? "tcy-authed-layout--desktop-home" : desktopChat ? "tcy-authed-layout--desktop-chat" : ""}`}>
      <AccountCollectionsSync />
      <IncomingCallNotice />
      {desktopInbox && (
        <aside className="tcy-desktop-chat-sidebar">
          <Chats desktopPanel />
        </aside>
      )}
      {desktopHome && (
        <section className="tcy-desktop-welcome-pane">
          <div className="tcy-desktop-welcome-content">
            <Logo size={76} />
            <h1 className="mt-6 text-[24px] font-black tcy-text">Выберите чат</h1>
            <p className="mt-2 max-w-[300px] text-center text-[14px] leading-relaxed tcy-dim">
              Ваши сообщения, звонки и избранное будут под рукой
            </p>
          </div>
        </section>
      )}
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={
            location.pathname.startsWith("/chat/")
              ? location.pathname
              : location.pathname.split("/")[1] || "/"
          }
          initial={routeMotion.initial}
          animate={routeMotion.animate}
          exit={routeMotion.exit}
          transition={{
            type: "spring",
            stiffness: experimentalUI ? 210 : 240,
            damping: experimentalUI ? 28 : 29,
            mass: experimentalUI ? 0.9 : 0.86,
          }}
          style={{ transformOrigin: routeMotion.origin }}
          className="tcy-route-animated absolute inset-0"
        >
          <Routes location={location}>
            <Route path="/" element={desktopHome ? <div className="h-full" /> : <Chats />} />
            <Route path="/chat/:id" element={<ChatView />} />
            <Route path="/chat/:id/info" element={<ChatInfo />} />
            <Route path="/rename-chat/:chatId" element={<RenameChat />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/:username" element={<UserView />} />
            <Route path="/user/:id" element={<UserView />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/security/create-password" element={<AccountSecurityPassword />} />
            <Route path="/settings/navigation-island" element={<NavigationIslandSettings />} />
            <Route path="/settings/security/create-password/:format" element={<AccountSecurityPassword />} />
            <Route path="/settings/e2ee" element={<EncryptedChats />} />
            <Route path="/settings/:section" element={<SettingsSectionScreen />} />
            <Route path="/email-binding" element={<EmailBinding />} />
            <Route path="/halloween" element={<Halloween />} />
            <Route path="/accent" element={<AccentSettings />} />
            <Route path="/font" element={<FontSettings />} />
            <Route path="/wallpapers" element={<Wallpapers />} />
            <Route path="/stickers/new" element={<StickerPackCreate />} />
            <Route path="/folders/new" element={<ChatFolders />} />
            <Route path="/folders/:folderId" element={<ChatFolders />} />
            <Route path="/language" element={<CustomLanguage />} />
            <Route path="/system-update" element={<SystemUpdate />} />
            <Route path="/encrypted" element={<EncryptedChats />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/search" element={<Search />} />
            <Route path="/new" element={<NewChat />} />
            <Route path="/create" element={<CreateCommunity />} />
            <Route path="/invite/:token" element={<JoinInvite />} />
            <Route path="/channels" element={<ChannelsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </motion.div>
      </AnimatePresence>

      <TabBar unreadTotal={unreadTotal} />
    </div>
  );
}

function Gate({ plush }: { plush: boolean }) {
  const { isAuthenticated, isLoading } = useAuth();

  // Fired in the same tick as auth.me, so tRPC batches both into a single
  // request: the splash used to wait two network round trips in a row.
  const me = trpc.profile.me.useQuery(undefined, {
    retry: false,
    staleTime: 30_000,
  });

  // Once authentication is known, render the messenger shell immediately.
  // Chats shows its inline connection animation while profile/chat data resolves.
  if (isLoading) {
    return <Splash />;
  }

  if (!isAuthenticated) {
    return plush ? <Welcome /> : <WelcomeLegacy />;
  }

  if (me.data && !me.data.profile) {
    return plush ? <Setup /> : <SetupLegacy />;
  }

  return <AuthedApp />;
}

export default function App() {
  const location = useLocation();
  const { isAuthenticated, isLoading } = useAuth();

  const { enabled: isPrivateTester } = useTesterMode({ enabled: isAuthenticated });

  // React has committed its first frame: hand the screen over from the static
  // boot splash in index.html, which the browser painted without waiting for
  // this bundle to download.
  useEffect(hideBootSplash, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isPrivateTester) {
      root.dataset.tcyPlush = "true";
    } else {
      delete root.dataset.tcyPlush;
    }
  }, [isPrivateTester]);

  // Marks the document so the private experimental look (calm bubbles, new
  // wallpapers, tabbed settings) applies only to the configured tester
  // account. Everyone else falls back to the stable styles in index.css.
  const { enabled: experimentalUI } = useExperimentalUI({ enabled: isAuthenticated });

  useEffect(() => {
    const root = document.documentElement;
    if (experimentalUI) {
      root.dataset.tcyExperimental = "true";
    } else {
      delete root.dataset.tcyExperimental;
    }
  }, [experimentalUI]);


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
      <CustomLanguageBridge />

      <div className="relative z-10 h-full">
        {location.pathname === "/register" ? (
          isPrivateTester ? <RegisterWizard /> : <RegisterWizardLegacy />
        ) : location.pathname === "/recover" ? (
          <Recover />
        ) : location.pathname === "/accounts" ? (
          <AccountsPage />
        ) : location.pathname === "/login" && (
          !isAuthenticated || new URLSearchParams(location.search).get("addAccount") === "1"
        ) ? (
          <Routes>
            <Route path="/login" element={<Login />} />
          </Routes>
        ) : (
          <Gate plush={isPrivateTester} />
        )}
      </div>
    </div>
  );
}
