import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeName = "dark" | "light";

type ThemeValue = { theme: ThemeName; setTheme: (t: ThemeName) => void; toggle: () => void };

const ThemeContext = createContext<ThemeValue | null>(null);

function apply(theme: ThemeName) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("bloxspark-theme") as ThemeName | null;
    const next = stored === "light" || stored === "dark" ? stored : "dark";
    setThemeState(next);
    apply(next);
  }, []);

  const setTheme = useCallback((t: ThemeName) => {
    setThemeState(t);
    window.localStorage.setItem("bloxspark-theme", t);
    apply(t);
  }, []);

  const toggle = useCallback(
    () => setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark"),
    [setTheme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
