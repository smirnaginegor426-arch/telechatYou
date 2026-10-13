import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme } from "@/lib/accents";
import { trpc } from "@/providers/trpc";

type Theme = "dark" | "light";
type ThemeCtx = {
  theme: Theme;
  accent: "mono" | "halloween";
  setTheme: (theme: Theme) => void;
  setAccent: (_accent: string) => void;
};

const noop = () => {};
const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  accent: "mono",
  setTheme: noop,
  setAccent: noop,
});

function readLocalTheme(): Theme {
  try {
    return localStorage.getItem("tcy-theme") === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const savedSettings = trpc.settings.get.useQuery(undefined, {
    enabled: !!me.data?.profile,
    retry: false,
    staleTime: 60_000,
  });
  const update = trpc.settings.update.useMutation({
    onSuccess: (settings) => utils.settings.get.setData(undefined, settings),
  });
  const [theme, setThemeState] = useState<Theme>(readLocalTheme);

  useEffect(() => {
    if (savedSettings.data?.theme) setThemeState(savedSettings.data.theme);
  }, [savedSettings.data?.theme]);

  // Enable the private palette only inside the Android app's WebView and only for tester.
  const isAndroidApp = (() => {
    try {
      if (new URLSearchParams(window.location.search).get("tcyAndroidApp") === "1") {
        sessionStorage.setItem("tcy-android-app", "1");
      }
      return sessionStorage.getItem("tcy-android-app") === "1";
    } catch {
      return new URLSearchParams(window.location.search).get("tcyAndroidApp") === "1";
    }
  })();
  const isHalloweenUser = isAndroidApp && Number(me.data?.user.id) === 848013;
  const activeAccent = isHalloweenUser ? "halloween" : "mono";

  useEffect(() => {
    applyTheme(theme, activeAccent);
    try {
      localStorage.setItem("tcy-theme", theme);
      localStorage.setItem("tcy-accent", activeAccent);
    } catch {
      // The selected theme still applies for this session when storage is unavailable.
    }
  }, [theme, activeAccent]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    update.mutate({ theme: nextTheme });
  }, [update.mutate]);

  return (
    <Ctx.Provider
      value={{
        theme,
        accent: activeAccent,
        setTheme,
        setAccent: noop,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}
