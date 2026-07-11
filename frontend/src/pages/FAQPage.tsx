import { useTranslation } from "react-i18next";
import { PageShell } from "../components/Layout";
import { resolveFaqItems, resolveFaqTitle } from "../lib/faqContent";
import { useSiteContent } from "../lib/siteContentContext";
import { useSiteTheme } from "../lib/themeContext";

export default function FAQPage() {
  const { t, i18n } = useTranslation();
  const content = useSiteContent();
  const { theme } = useSiteTheme();
  const isAr = i18n.language.startsWith("ar");
  const isLight = theme === "light";
  const fallbackItems = t("faq.items", { returnObjects: true }) as Array<{ q: string; a: string }>;
  const title = resolveFaqTitle(content, isAr, t("faq.title"));
  const items = resolveFaqItems(content, isAr, Array.isArray(fallbackItems) ? fallbackItems : []);

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className={`text-5xl font-black ${isLight ? "text-gray-950" : "text-white"}`}>{title}</h1>
          <div className="mt-10 space-y-4">
            {items.map((item, index) => (
              <article
                key={`${item.q}-${index}`}
                className={isLight ? "rounded-3xl border border-gray-200 bg-white p-6 shadow-sm" : "soft-card rounded-3xl p-6"}
              >
                <h2 className={`text-xl font-black ${isLight ? "text-gray-950" : "text-white"}`}>{item.q}</h2>
                <p className={`mt-3 ${isLight ? "text-gray-700" : "text-white/65"}`}>{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </PageShell>
  );
}