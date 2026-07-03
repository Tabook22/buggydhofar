import { useTranslation } from "react-i18next";
import { PageShell } from "../components/Layout";

export default function FAQPage() {
  const { t } = useTranslation();
  const items = t("faq.items", { returnObjects: true }) as Array<{ q: string; a: string }>;

  return (
    <PageShell>
      <main className="bg-forest-950 px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-5xl font-black">{t("faq.title")}</h1>
          <div className="mt-10 space-y-4">
            {items.map((item) => (
              <article key={item.q} className="soft-card rounded-3xl p-6">
                <h2 className="text-xl font-black">{item.q}</h2>
                <p className="mt-3 text-white/65">{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </main>
    </PageShell>
  );
}
