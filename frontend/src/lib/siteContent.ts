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

export function pickSiteTextEn(
  content: SiteContent | null | undefined,
  field: string,
  fallback: string
): string {
  return pickSiteText(content, field, false, fallback);
}

export function pickSiteTextAr(
  content: SiteContent | null | undefined,
  field: string,
  fallback: string
): string {
  return pickSiteText(content, field, true, fallback);
}

export type HowStepItem = { title: string; text: string };

export function buildHowSteps(
  content: SiteContent | null | undefined,
  isAr: boolean,
  fallbackItems: HowStepItem[]
): HowStepItem[] {
  const steps = [1, 2, 3, 4] as const;
  return steps.map((step, index) => ({
    title: pickSiteText(content, `how_step${step}_title`, isAr, fallbackItems[index]?.title || ""),
    text: pickSiteText(content, `how_step${step}_text`, isAr, fallbackItems[index]?.text || "")
  }));
}