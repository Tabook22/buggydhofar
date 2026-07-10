import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSiteTheme } from "../lib/themeContext";

export function ThemeSwitcher({ compact = false }: { compact?: boolean }) {
  const { theme, toggleSiteTheme } = useSiteTheme();
  const { t } = useTranslation();
  const isLight = theme === "light";
  const label = isLight ? t("theme.switchToDark") : t("theme.switchToLight");

  return (
    <button
      type="button"
      onClick={toggleSiteTheme}
      aria-label={label}
      title={label}
      className="theme-switcher inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition"
    >
      {isLight ? <Moon size={16} className="shrink-0" /> : <Sun size={16} className="shrink-0" />}
      {!compact && <span>{isLight ? t("theme.dark") : t("theme.light")}</span>}
    </button>
  );
}