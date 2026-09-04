import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { SiteContent } from "../api/client";
import { resolveMediaUrl } from "../lib/mediaUrl";

export function HomeAdvertisement({ content }: { content: SiteContent | null }) {
  const { t } = useTranslation();
  if (!content?.advertisement_active) return null;
  const imageUrl = resolveMediaUrl(content.advertisement_image_url);
  if (!imageUrl) return null;

  return (
    <section className="px-4 pb-4 pt-6 sm:px-6 lg:px-8" aria-label={t("home.advertisementTitle")}>
      <div className="mx-auto max-w-lg">
        <p className="mb-4 text-center text-sm font-bold uppercase tracking-wide text-forest-300">
          {t("home.advertisementBadge")}
        </p>
        <Link to="/booking" className="group block overflow-hidden rounded-[2rem] border border-white/10 bg-black/20 shadow-glow transition hover:border-forest-400/40">
          <img
            src={imageUrl}
            alt={t("home.advertisementAlt")}
            className="w-full object-cover transition duration-300 group-hover:scale-[1.01]"
          />
        </Link>
        <Link
          to="/booking"
          className="mt-5 block rounded-2xl bg-forest-500 px-6 py-4 text-center font-bold text-white transition hover:bg-forest-400"
        >
          {t("home.advertisementCta")}
        </Link>
      </div>
    </section>
  );
}
