"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const DEFAULT_STORAGE_KEY = "ide-theme";

/**
 * Inline script that applies the persisted (or system) theme before first
 * paint to avoid a light/dark flash. Render once inside <head>.
 */
export function ThemeScript({
  storageKey = DEFAULT_STORAGE_KEY,
}: {
  storageKey?: string;
}) {
  const script = `(function(){try{var k=${JSON.stringify(
    storageKey,
  )};var s=localStorage.getItem(k);var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=s?s==="dark":m;document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

export function ThemeProvider({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>("light");

  // Sync state from whatever ThemeScript already applied to <html>.
  useEffect(() => {
    const isDark = document.documentElement.classList.contains("dark");
    setThemeState(isDark ? "dark" : "light");
  }, []);

  const setTheme = useCallback(
    (next: Theme) => {
      setThemeState(next);
      document.documentElement.classList.toggle("dark", next === "dark");
      try {
        localStorage.setItem(storageKey, next);
      } catch {
        // ignore storage failures (private mode, etc.)
      }
    },
    [storageKey],
  );

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}
