import type { SiteContent } from "../api/client";

const ENV_PHONE = (import.meta.env.VITE_CONTACT_PHONE as string | undefined) || "";

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Call number: dedicated contact phone, then transfer mobile, then env. */
export function resolveContactPhone(content: SiteContent | null | undefined): string {
  const dedicated = content?.contact_phone?.trim();
  if (dedicated) return dedicated;
  const fromTransfer = content?.transfer_mobile_number?.trim();
  if (fromTransfer) return fromTransfer;
  if (ENV_PHONE.trim()) return ENV_PHONE.trim();
  return "";
}

/** WhatsApp number: dedicated WhatsApp, then call number. */
export function resolveWhatsAppPhone(content: SiteContent | null | undefined): string {
  const dedicated = content?.contact_whatsapp?.trim();
  if (dedicated) return dedicated;
  return resolveContactPhone(content);
}

export function formatContactPhoneDisplay(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return phone;
  if (digits.startsWith("968") && digits.length >= 11) {
    const local = digits.slice(3);
    return `+968 ${local.slice(0, 4)} ${local.slice(4)}`.trim();
  }
  return phone.startsWith("+") ? phone : `+${digits}`;
}

export function phoneTelUri(phone: string): string {
  const digits = normalizePhoneDigits(phone);
  return digits ? `tel:+${digits}` : "";
}

export function whatsAppUri(phone: string, message?: string): string {
  const digits = normalizePhoneDigits(phone);
  if (!digits) return "";
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}