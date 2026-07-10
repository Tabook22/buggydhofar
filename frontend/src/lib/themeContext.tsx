import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type SiteTheme = "light" | "dark";

const STORAGE_KEY = "buggy-site-theme";

export function readStoredSiteTheme(): SiteTheme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Ignore storage errors
  }
  return "light";
}

type ThemeContextValue = {
  theme: SiteTheme;
  setSiteTheme: (theme: SiteTheme) => void;
  toggleSiteTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<SiteTheme>(readStoredSiteTheme);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setSiteTheme: setTheme,
      toggleSiteTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useSiteTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useSiteTheme must be used within ThemeProvider");
  }
  return context;
}