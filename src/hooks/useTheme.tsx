import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { applyTheme, ACCENTS, type AccentId } from "@/lib/accents";
import { applyFontWeight, getSavedFontWeight } from "@/lib/font-weight";
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
  const matteTransitionTimer = useRef<number | null>(null);
  const matteFadeTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (matteTransitionTimer.current !== null) window.clearTimeout(matteTransitionTimer.current);
      if (matteFadeTimer.current !== null) window.clearTimeout(matteFadeTimer.current);
      delete document.documentElement.dataset.themeTransition;
    };
  }, []);

  useEffect(() => {
    if (savedSettings.data?.theme) setThemeState(savedSettings.data.theme);
  }, [savedSettings.data?.theme]);

  useEffect(() => {
    applyFontWeight(getSavedFontWeight());
  }, []);

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
    const root = document.documentElement;

    if (matteTransitionTimer.current !== null) window.clearTimeout(matteTransitionTimer.current);
    if (matteFadeTimer.current !== null) window.clearTimeout(matteFadeTimer.current);
    matteTransitionTimer.current = null;
    matteFadeTimer.current = null;

    // On the way from light to dark, pass through a brief matte-grey glass
    // layer first so the dark theme appears softly instead of flashing abruptly.
    if (nextTheme === "dark" && theme === "light") {
      root.dataset.themeTransition = "matte";
      matteTransitionTimer.current = window.setTimeout(() => {
        setThemeState(nextTheme);
        if (me.data?.profile) update.mutate({ theme: nextTheme });
        matteTransitionTimer.current = null;

        matteFadeTimer.current = window.setTimeout(() => {
          delete root.dataset.themeTransition;
          matteFadeTimer.current = null;
        }, 420);
      }, 220);
      return;
    }

    delete root.dataset.themeTransition;
    setThemeState(nextTheme);
    // The welcome/registration screens are available before authentication.
    // Keep their theme choice locally and only sync settings for an existing profile.
    if (me.data?.profile) update.mutate({ theme: nextTheme });
  }, [theme, me.data?.profile, update.mutate]);

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
