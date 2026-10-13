import { createContext, useContext, useEffect, type ReactNode } from "react";
import { applyTheme } from "@/lib/accents";

type ThemeCtx = {
  theme: "dark";
  accent: "mono";
  setTheme: (_theme: "dark" | "light") => void;
  setAccent: (_accent: string) => void;
};

const noop = () => {};
const Ctx = createContext<ThemeCtx>({
  theme: "dark",
  accent: "mono",
  setTheme: noop,
  setAccent: noop,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme("dark", "mono");
    try {
      localStorage.setItem("tcy-theme", "dark");
      localStorage.setItem("tcy-accent", "mono");
    } catch {
      // The app theme remains black even when storage is unavailable.
    }
  }, []);

  return (
    <Ctx.Provider
      value={{
        theme: "dark",
        accent: "mono",
        setTheme: noop,
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
