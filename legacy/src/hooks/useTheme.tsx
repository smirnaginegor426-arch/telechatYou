import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme } from "@/lib/accents";
import { trpc } from "@/providers/trpc";

type ThemeCtx = {
  theme: "dark" | "light";
  accent: string;
  setTheme: (t: "dark" | "light") => void;
  setAccent: (a: string) => void;
};

const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  accent: "mint",
  setTheme: () => {},
  setAccent: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<"dark" | "light">(
    () => (localStorage.getItem("tcy-theme") as "dark" | "light") || "dark",
  );
  const [accent, setAccentState] = useState(
    () => localStorage.getItem("tcy-accent") || "mint",
  );

  useEffect(() => {
    applyTheme(theme, accent);
    localStorage.setItem("tcy-theme", theme);
    localStorage.setItem("tcy-accent", accent);
  }, [theme, accent]);

  // sync from server settings once available
  const settingsQuery = trpc.settings.get.useQuery(undefined, {
    staleTime: 60_000,
    retry: false,
  });
  const syncedRef = useState(false);
  useEffect(() => {
    if (settingsQuery.data && !syncedRef[0]) {
      syncedRef[1](true);
      setThemeState(settingsQuery.data.theme);
      setAccentState(settingsQuery.data.accent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.data]);

  const setTheme = (t: "dark" | "light") => setThemeState(t);
  const setAccent = (a: string) => setAccentState(a);

  return <Ctx.Provider value={{ theme, accent, setTheme, setAccent }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}
