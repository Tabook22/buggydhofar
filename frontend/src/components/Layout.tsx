import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Bike, CalendarCheck, Headphones, ShieldCheck, Trees, WalletCards } from "lucide-react";
import { useSiteContent } from "../lib/siteContentContext";
import { pickSiteText, pickSiteTextAr, pickSiteTextEn } from "../lib/siteContent";
import { useSiteTheme } from "../lib/themeContext";
import { ThemeSwitcher } from "./ThemeSwitcher";

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const next = i18n.language === "ar" ? "en" : "ar";

  return (
    <button
      onClick={() => i18n.changeLanguage(next)}
      className="rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
    >
      {i18n.language === "ar" ? "English" : "AR"}
    </button>
  );
}

export function Navbar() {
  const { t, i18n } = useTranslation();
  const content = useSiteContent();
  const isAr = i18n.language === "ar";
  const [scrolled, setScrolled] = useState(false);
  const siteNameEn = pickSiteTextEn(content, "site_name", t("brand"));
  const siteNameAr = pickSiteTextAr(content, "site_name", t("brandAr"));
  const bookLabel = pickSiteText(content, "nav_book", isAr, t("nav.book"));
  const links = [
    ["/", t("nav.home")],
    ["/booking/lookup", t("nav.lookup")],
    ["/contact", t("nav.contact")]
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`fixed inset-x-0 top-0 z-50 transition ${scrolled ? "bg-forest-950/95 shadow-2xl backdrop-blur" : "bg-transparent"}`}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="leading-tight">
          <p className="text-lg font-black text-white">{siteNameEn}</p>
          <p className="text-xs text-forest-400">{siteNameAr}</p>
        </Link>
        <div className="hidden items-center gap-6 text-sm font-semibold text-white/80 lg:flex">
          {links.map(([to, label]) =>
            to.includes("#") ? (
              <a key={to} href={to} className="transition hover:text-forest-400">
                {label}
              </a>
            ) : (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? "text-forest-400" : "transition hover:text-forest-400")}>
                {label}
              </NavLink>
            )
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeSwitcher compact />
          <LanguageSwitcher />
          <Link to="/booking" className="rounded-full bg-forest-500 px-5 py-2 text-sm font-bold text-white shadow-glow transition hover:bg-forest-400">
            {bookLabel}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export function Footer() {
  const { t, i18n } = useTranslation();
  const content = useSiteContent();
  const isAr = i18n.language === "ar";
  const siteName = pickSiteText(content, "site_name", isAr, isAr ? t("brandAr") : t("brand"));
  const footerText = pickSiteText(content, "footer_text", isAr, t("footer"));
  const adminLabel = pickSiteText(content, "footer_admin", isAr, t("nav.admin"));

  return (
    <footer className="bg-forest-950 px-4 py-10 text-center text-white/70">
      <p className="text-lg font-bold text-white">{siteName}</p>
      <p className="mt-2">{footerText}</p>
      <Link to="/admin" className="mt-4 inline-block text-sm text-forest-400">
        {adminLabel}
      </Link>
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
