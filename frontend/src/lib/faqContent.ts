import type { FaqItem, SiteContent } from "../api/client";

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    q_en: "Do I need previous riding experience?",
    q_ar: "هل أحتاج إلى خبرة سابقة؟",
    a_en: "No. Our team gives a safety briefing and recommends routes based on your comfort level.",
    a_ar: "لا. يقدم فريقنا شرحاً للسلامة ويقترح المسار المناسب لمستوى راحتك."
  },
  {
    q_en: "Can tourists book online?",
    q_ar: "هل يمكن للسياح الحجز عبر الإنترنت؟",
    a_en: "Yes. Guests can book online and pay by Visa card.",
    a_ar: "نعم. يمكن للضيوف الحجز عبر الإنترنت والدفع ببطاقة فيزا."
  },
  {
    q_en: "Is safety equipment included?",
    q_ar: "هل معدات السلامة مشمولة؟",
    a_en: "Yes. Helmets and basic safety gear are included with every ride.",
    a_ar: "نعم. الخوذات ومعدات السلامة الأساسية مشمولة مع كل رحلة."
  }
];

export function resolveFaqTitle(content: SiteContent | null | undefined, isAr: boolean, fallback: string) {
  if (!content) return fallback;
  const value = (isAr ? content.faq_title_ar : content.faq_title_en)?.trim();
  return value || fallback;
}

export function resolveFaqItems(
  content: SiteContent | null | undefined,
  isAr: boolean,
  fallback: Array<{ q: string; a: string }>
) {
  const items = content?.faq_items?.length ? content.faq_items : DEFAULT_FAQ_ITEMS;
  return items.map((item) => ({
    q: (isAr ? item.q_ar : item.q_en).trim() || item.q_en,
    a: (isAr ? item.a_ar : item.a_en).trim() || item.a_en
  }));
}