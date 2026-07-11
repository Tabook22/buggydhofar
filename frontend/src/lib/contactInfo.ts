import type { SiteContent } from "../api/client";

const ENV_PHONE = (import.meta.env.VITE_CONTACT_PHONE as string | undefined) || "";

export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Prefer admin transfer mobile number, then VITE_CONTACT_PHONE. */
export function resolveContactPhone(content: SiteContent | null | undefined): string {
  const fromCms = content?.transfer_mobile_number?.trim();
  if (fromCms) return fromCms;
  if (ENV_PHONE.trim()) return ENV_PHONE.trim();
  return "";
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