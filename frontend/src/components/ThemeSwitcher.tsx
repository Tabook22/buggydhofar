import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSiteTheme } from "../lib/themeContext";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, toggleSiteTheme } = useSiteTheme();
  const { t } = useTranslation();
  const isDark = theme === "dark";
  const label = isDark ? t("theme.switchToLight") : t("theme.switchToDark");

  return (
    <button
      type="button"
      onClick={toggleSiteTheme}
      aria-label={label}
      title={label}
      className="theme-switcher inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition"
    >
      {isDark ? <Sun size={16} className="shrink-0" /> : <Moon size={16} className="shrink-0" />}
      {!compact && <span>{isDark ? t("theme.light") : t("theme.dark")}</span>}
    </button>
  );
}