import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, RouteExperience } from "../api/client";
import { RealMapRoutePreview } from "../components/RealMapRoute";
import { PageShell } from "../components/Layout";

export default function ExperiencesPage() {
  const { t, i18n } = useTranslation();
  const [routes, setRoutes] = useState<RouteExperience[]>([]);

  useEffect(() => {
    api.getRoutes().then(setRoutes);
  }, []);

  return (
    <PageShell>
      <main className="bg-forest-950 px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-5xl font-black">{t("routes.title")}</h1>
          <p className="mt-4 max-w-2xl text-white/65">{t("routes.subtitle")}</p>
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {routes.map((route) => (
              <article key={route.id} className="soft-card overflow-hidden rounded-[2rem]">
                <img src={route.image_url} alt={route.name_en} className="h-56 w-full object-cover" />
                <div className="p-6">
                  <h2 className="text-2xl font-black">{i18n.language === "ar" ? route.name_ar : route.name_en}</h2>
                  <p className="mt-3 text-white/65">{i18n.language === "ar" ? route.description_ar : route.description_en}</p>
                  <p className="mt-5 font-bold text-forest-400">
                    {route.duration_minutes} min · {route.price} {t("booking.omr")}
                  </p>
                  <div className="mt-5">
                    <RealMapRoutePreview
                      route={route}
                      className="h-48"
                      title={i18n.language === "ar" ? route.name_ar : route.name_en}
                    />
                  </div>
                  <Link to="/booking" className="mt-6 inline-block rounded-full bg-forest-500 px-5 py-3 font-bold text-white">
                    {t("routes.book")}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>
    </PageShell>
  );
}
