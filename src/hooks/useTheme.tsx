import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme, ACCENTS, type AccentId } from "@/lib/accents";
import { trpc } from "@/providers/trpc";

type Theme = "dark" | "light";
type ThemeCtx = {
  theme: Theme;
  accent: AccentId;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: AccentId) => void;
};

const noop = () => {};
const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  accent: "purple",
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

function readLocalAccent(): AccentId {
  try {
    const saved = localStorage.getItem("tcy-accent");
    // Migrate palette names used by older builds to their closest replacement.
    if (saved === "halloween") return "orange";
    if (saved === "mono") return "purple";
    return ACCENTS.find((item) => item.id === saved)?.id ?? "purple";
  } catch {
    return "purple";
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
  const [accent, setAccentState] = useState<AccentId>(readLocalAccent);

  useEffect(() => {
    if (savedSettings.data?.theme) setThemeState(savedSettings.data.theme);
  }, [savedSettings.data?.theme]);

  useEffect(() => {
    applyTheme(theme, accent);
    try {
      localStorage.setItem("tcy-theme", theme);
      localStorage.setItem("tcy-accent", accent);
    } catch {
      // Appearance remains active for the current session if storage is unavailable.
    }
  }, [theme, accent]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
    update.mutate({ theme: nextTheme });
  }, [update.mutate]);

  const setAccent = useCallback((nextAccent: AccentId) => {
    setAccentState(nextAccent);
  }, []);

  return (
    <Ctx.Provider
      value={{
        theme,
        accent,
        setTheme,
        setAccent,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useTheme() {
  return useContext(Ctx);
}
