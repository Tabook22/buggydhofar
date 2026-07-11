import { MessageCircle, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  formatContactPhoneDisplay,
  phoneTelUri,
  resolveContactPhone,
  whatsAppUri
} from "../lib/contactInfo";
import { useSiteContent } from "../lib/siteContentContext";
import { useSiteTheme } from "../lib/themeContext";

type ContactActionsProps = {
  layout?: "row" | "stack";
  whatsappMessage?: string;
};

export function ContactActions({ layout = "row", whatsappMessage }: ContactActionsProps) {
  const { t } = useTranslation();
  const content = useSiteContent();
  const { theme } = useSiteTheme();
  const isLight = theme === "light";
  const phone = resolveContactPhone(content);
  const displayPhone = phone ? formatContactPhoneDisplay(phone) : "";
  const telHref = phoneTelUri(phone);
  const waHref = whatsAppUri(phone, whatsappMessage || t("contact.whatsappPrefill"));

  if (!phone) return null;

  const buttonClass = isLight
    ? "inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold text-gray-900 shadow-sm transition hover:border-forest-400 hover:text-forest-800"
    : "inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-sm font-bold text-white transition hover:border-forest-400/50 hover:bg-white/15";

  const whatsappClass = isLight
    ? "inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
    : "inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3 text-sm font-bold text-emerald-200 transition hover:bg-emerald-500/25";

  return (
    <div className={layout === "stack" ? "flex flex-col gap-3" : "flex flex-wrap gap-3"}>
      <a href={waHref} target="_blank" rel="noopener noreferrer" className={whatsappClass}>
        <MessageCircle size={18} aria-hidden />
        {t("contact.whatsapp")}
      </a>
      <a href={telHref} className={buttonClass}>
        <Phone size={18} aria-hidden />
        {t("contact.call", { phone: displayPhone })}
      </a>
    </div>
  );
}