import { SiteContent } from "../api/client";

export function pickSiteText(
  content: SiteContent | null | undefined,
  field: string,
  isAr: boolean,
  fallback: string
): string {
  if (!content) return fallback;
  const key = `${field}_${isAr ? "ar" : "en"}` as keyof SiteContent;
  const value = content[key];
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}