import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, CalendarCheck, Headphones, Menu, ShieldCheck, Trees, WalletCards, X } from "lucide-react";
import { useSiteContent } from "../lib/siteContentContext";
import { pickSiteText, pickSiteTextAr, pickSiteTextEn } from "../lib/siteContent";
import { useSiteTheme } from "../lib/themeContext";
import { ContactActions } from "./ContactActions";
import { ThemeSwitcher } from "./ThemeSwitcher";

const NAV_LINKS = [
  ["/", "nav.home"],
  ["/experiences", "nav.experiences"],
  ["/faq", "nav.faq"],
  ["/booking/lookup", "nav.lookup"],
  ["/contact", "nav.contact"]
] as const;

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { theme } = useSiteTheme();
  const isLight = theme === "light";
  const next = i18n.language === "ar" ? "en" : "ar";

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className={
        isLight
          ? "rounded-full border border-gray-300 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 transition hover:bg-gray-200"
          : "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
      }
    >
      {i18n.language === "ar" ? "English" : "AR"}
    </button>
  );
}

function NavLinks({
  onNavigate,
  className,
  linkClass,
  activeClass
}: {
  onNavigate?: () => void;
  className: string;
  linkClass: string;
  activeClass: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={className}>
      {NAV_LINKS.map(([to, labelKey]) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) => (isActive ? activeClass : linkClass)}
        >
          {t(labelKey)}
        </NavLink>
      ))}
    </div>
  );
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const content = useSiteContent();
  const { theme } = useSiteTheme();
  const isAr = i18n.language === "ar";
  const isLight = theme === "light";
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const siteNameEn = pickSiteTextEn(content, "site_name", t("brand"));
  const siteNameAr = pickSiteTextAr(content, "site_name", t("brandAr"));
  const bookLabel = pickSiteText(content, "nav_book", isAr, t("nav.book"));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const headerClass = isLight
    ? scrolled
      ? "border-b border-gray-200 bg-white/95 shadow-md backdrop-blur"
      : "border-b border-gray-200/80 bg-white/90 backdrop-blur"
    : scrolled
      ? "bg-forest-950/95 shadow-2xl backdrop-blur"
      : "bg-transparent";
  const brandClass = isLight ? "text-gray-950" : "text-white";
  const navClass = isLight ? "text-gray-800" : "text-white/80";
  const navActiveClass = isLight ? "text-forest-700" : "text-forest-400";
  const navHoverClass = isLight ? "hover:text-forest-700" : "hover:text-forest-400";
  const menuButtonClass = isLight
    ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-gray-900 lg:hidden"
    : "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white lg:hidden";

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition ${headerClass}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="leading-tight" onClick={() => setMenuOpen(false)}>
          <p className={`text-lg font-black ${brandClass}`}>{siteNameEn}</p>
          <p className={`text-xs ${isLight ? "text-forest-800" : "text-forest-400"}`}>{siteNameAr}</p>
        </Link>
        <NavLinks
          className={`hidden items-center gap-6 text-sm font-semibold lg:flex ${navClass}`}
          linkClass={`transition ${navHoverClass}`}
          activeClass={navActiveClass}
        />
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            className={menuButtonClass}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav-panel"
            aria-label={menuOpen ? t("nav.menuClose") : t("nav.menuOpen")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <ThemeSwitcher compact />
          <LanguageSwitcher />
          <Link
            to="/booking"
            onClick={() => setMenuOpen(false)}
            className="hidden rounded-full bg-forest-500 px-5 py-2 text-sm font-bold text-white shadow-glow transition hover:bg-forest-400 sm:inline-flex"
          >
            {bookLabel}
          </Link>
        </div>
      </nav>

      {menuOpen && (
        <div
          id="mobile-nav-panel"
          className={
            isLight
              ? "border-t border-gray-200 bg-white px-4 py-5 shadow-lg lg:hidden"
              : "border-t border-white/10 bg-forest-950/98 px-4 py-5 shadow-2xl backdrop-blur lg:hidden"
          }
        >
          <NavLinks
            onNavigate={() => setMenuOpen(false)}
            className={`flex flex-col gap-4 text-base font-semibold ${navClass}`}
            linkClass={`transition ${navHoverClass}`}
            activeClass={navActiveClass}
          />
          <div className="mt-5 flex flex-col gap-3">
            <Link
              to="/booking"
              onClick={() => setMenuOpen(false)}
              className="rounded-2xl bg-forest-500 px-5 py-3 text-center text-sm font-bold text-white shadow-glow transition hover:bg-forest-400"
            >
              {bookLabel}
            </Link>
            <ContactActions layout="stack" />
          </div>
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { t, i18n } = useTranslation();
  const content = useSiteContent();
  const { theme } = useSiteTheme();
  const isAr = i18n.language === "ar";
  const isLight = theme === "light";
  const siteName = pickSiteText(content, "site_name", isAr, isAr ? t("brandAr") : t("brand"));
  const footerText = pickSiteText(content, "footer_text", isAr, t("footer"));
  const adminLabel = pickSiteText(content, "footer_admin", isAr, t("nav.admin"));
  const linkClass = isLight
    ? "text-sm font-semibold text-gray-700 transition hover:text-forest-700"
    : "text-sm font-semibold text-white/75 transition hover:text-forest-400";

  return (
    <footer
      className={
        isLight
          ? "border-t border-gray-200 bg-gray-50 px-4 py-12 text-gray-800"
          : "bg-forest-950 px-4 py-12 text-white/70"
      }
    >
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-8 md:grid-cols-[1.2fr_1fr] md:items-start">
          <div>
            <p className={`text-lg font-bold ${isLight ? "text-gray-950" : "text-white"}`}>{siteName}</p>
            <p className="mt-2 max-w-md">{footerText}</p>
            <div className="mt-5">
              <ContactActions />
            </div>
            <a
              href="mailto:info@buggydhofar.com"
              className={`mt-4 inline-block text-sm font-semibold ${isLight ? "text-forest-800" : "text-forest-400"}`}
            >
              info@buggydhofar.com
            </a>
          </div>
          <div>
            <p className={`text-sm font-bold uppercase tracking-wide ${isLight ? "text-gray-900" : "text-white"}`}>
              {t("footerExplore")}
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {NAV_LINKS.map(([to, labelKey]) => (
                <Link key={to} to={to} className={linkClass}>
                  {t(labelKey)}
                </Link>
              ))}
              <Link to="/booking" className={linkClass}>
                {t("nav.book")}
              </Link>
            </div>
          </div>
        </div>
        <Link to="/admin" className={`mt-8 inline-block text-sm ${isLight ? "text-forest-800" : "text-forest-400"}`}>
          {adminLabel}
        </Link>
      </div>
    </footer>
  );
}

export function PageShell({ children }: { children: React.ReactNode }) {
  const { theme } = useSiteTheme();

  return (
    <div
      className="visitor-site min-h-screen bg-forest-950 text-white transition-colors duration-300"
      data-theme={theme}
    >
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}

export function FeatureIcon({ type, title, text }: { type: "view" | "safety" | "support" | "booking" | "vehicle" | "payment"; title: string; text?: string }) {
  const icons = {
    view: Trees,
    safety: ShieldCheck,
    support: Headphones,
    booking: CalendarCheck,
    vehicle: Bike,
    payment: WalletCards
  };
  const Icon = icons[type];

  return (
    <div className="soft-card rounded-3xl p-5 transition hover:-translate-y-1 hover:bg-white/10">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest-500/20 text-forest-400">
        <Icon size={24} />
      </div>
      <h3 className="font-bold text-white">{title}</h3>
      {text && <p className="mt-2 text-sm text-white/65">{text}</p>}
    </div>
  );
}

export function QRCodeCard() {
  const { t } = useTranslation();
  const bookingUrl = `${window.location.origin}/booking`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(bookingUrl)}`;

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="glass grid items-center gap-8 rounded-[2rem] p-8 md:grid-cols-[1fr_auto]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">QR Booking</p>
          <h2 className="mt-3 text-3xl font-black">{t("qr.title")}</h2>
          <p className="mt-3 max-w-2xl text-white/70">{t("qr.subtitle")}</p>
        </div>
        <div className="rounded-3xl bg-white p-4">
          <img src={qrUrl} alt={t("qr.title")} className="h-44 w-44" />
        </div>
      </div>
    </section>
  );
}