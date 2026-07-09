import { lazy, Suspense, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { BadgeCheck, MapPin, Clock, Navigation } from "lucide-react";

import { AvailabilityBoard } from "../components/AvailabilityBoard";
import { HomeInstagramGallery } from "../components/HomeInstagramGallery";

import { api, RouteExperience, SiteContent, Vehicle } from "../api/client";

import { BookingSummaryCard, BookingWidget } from "../components/Booking";

import { FeatureIcon, PageShell } from "../components/Layout";

import { defaultBookingSelection, loadBookingDraft, saveBookingDraft } from "../lib/bookingDraft";
import { isVideoUrl, resolveMediaUrl } from "../lib/mediaUrl";
import { pickSiteText } from "../lib/siteContent";



const INSTAGRAM_URL = "https://www.instagram.com/gobuggydhofar/";
const INSTAGRAM_AVATAR_URL = "/social/gobuggydhofar-instagram.jpg";

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.622c-3.154 0-3.527.012-4.764.069-1.026.047-1.584.218-1.955.363-.492.192-.843.422-1.212.79-.368.369-.598.72-.79 1.212-.145.371-.316.929-.363 1.955-.057 1.237-.069 1.61-.069 4.764s.012 3.527.069 4.764c.047 1.026.218 1.584.363 1.955.192.492.422.843.79 1.212.369.368.72.598 1.212.79.371.145.929.316 1.955.363 1.237.057 1.61.069 4.764.069s3.527-.012 4.764-.069c1.026-.047 1.584-.218 1.955-.363.492-.192.843-.422 1.212-.79.368-.369.598-.72.79-1.212.145-.371.316-.929.363-1.955.057-1.237.069-1.61.069-4.764s-.012-3.527-.069-4.764c-.047-1.026-.218-1.584-.363-1.955-.192-.492-.422-.843-.79-1.212-.368-.368-.72-.598-1.212-.79-.371-.145-.929-.316-1.955-.363-1.237-.057-1.61-.069-4.764-.069zm0 3.351a4.864 4.864 0 1 1 0 9.728 4.864 4.864 0 0 1 0-9.728zm0 1.622a3.242 3.242 0 1 0 0 6.484 3.242 3.242 0 0 0 0-6.484zm5.338-3.205a1.136 1.136 0 1 1-2.272 0 1.136 1.136 0 0 1 2.272 0z" />
    </svg>
  );
}

const RealMapRoutePreview = lazy(() =>

  import("../components/RealMapRoute").then((module) => ({ default: module.RealMapRoutePreview }))

);



function routeLabels(route: RouteExperience) {

  const start =

    route.start_location?.trim() ||

    (route.start_lat && route.start_lng ? `${route.start_lat}, ${route.start_lng}` : "—");

  const end =

    route.end_location?.trim() ||

    (route.end_lat && route.end_lng ? `${route.end_lat}, ${route.end_lng}` : "—");

  return { start, end };

}



function readStringList(value: unknown): string[] {

  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

}



function readHowItems(value: unknown): Array<{ title: string; text: string }> {

  if (!Array.isArray(value)) return [];

  return value.filter(

    (item): item is { title: string; text: string } =>

      typeof item === "object" && item !== null && typeof item.title === "string" && typeof item.text === "string"

  );

}



export default function HomePage() {

  const { t, i18n } = useTranslation();

  const isAr = i18n.language === "ar";

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);

  const [routes, setRoutes] = useState<RouteExperience[]>([]);

  const [content, setContent] = useState<SiteContent | null>(null);

  const [selection, setSelection] = useState(() => loadBookingDraft() || defaultBookingSelection);

  const [loadError, setLoadError] = useState<string | null>(null);

  const [ready, setReady] = useState(false);



  const heroFeatures = readStringList(t("hero.features", { returnObjects: true }));

  const howItems = readHowItems(t("how.items", { returnObjects: true }));

  const visibleRoutes = routes.filter((route) => route.display_on_home);



  useEffect(() => {

    let active = true;

    setLoadError(null);



    Promise.all([api.getVehicles(), api.getRoutes(), api.getSiteContent()])

      .then(([vehicleData, routeData, contentData]) => {

        if (!active) return;

        setVehicles(vehicleData);

        setRoutes(routeData);

        setContent(contentData);

        setSelection((current) => ({

          ...current,

          vehicleId: current.vehicleId || vehicleData[0]?.id || 0,

          routeId: current.routeId || routeData[0]?.id || 0

        }));

      })

      .catch((error) => {

        if (!active) return;

        setLoadError(error instanceof Error ? error.message : "Could not load page data");

      })

      .finally(() => {

        if (active) setReady(true);

      });



    return () => {

      active = false;

    };

  }, []);

  useEffect(() => {
    saveBookingDraft(selection);
  }, [selection]);

  const heroBackgroundUrl = resolveMediaUrl(content?.hero_background_url);
  const heroSideImageUrl =
    resolveMediaUrl(content?.hero_side_image_url) ||
    "https://images.unsplash.com/photo-1612118756064-5403ff7747de?auto=format&fit=crop&w=1100&q=85";
  const heroUsesVideo =
    Boolean(heroBackgroundUrl) &&
    (content?.hero_background_type === "video" || isVideoUrl(heroBackgroundUrl, content?.hero_background_type));

  const heroBadge = pickSiteText(content, "hero_badge", isAr, t("hero.badge"));
  const heroTitle = pickSiteText(content, "hero_title", isAr, t("hero.title"));
  const heroSubtitle = pickSiteText(content, "hero_subtitle", isAr, t("hero.subtitle"));
  const heroCta = pickSiteText(content, "hero_cta", isAr, t("hero.cta"));
  const heroStats = pickSiteText(content, "hero_note", isAr, t("hero.stats"));

  return (

    <PageShell>

      {loadError && (

        <div className="fixed inset-x-0 top-20 z-[60] px-4 sm:px-6">

          <div className="mx-auto max-w-3xl rounded-2xl border border-yellow-400/30 bg-yellow-500/15 px-4 py-3 text-sm text-yellow-100">

            {t("home.loadError")} {loadError}

          </div>

        </div>

      )}



      <section className="hero-bg relative min-h-screen overflow-hidden px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        {heroUsesVideo ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden
          >
            <source src={heroBackgroundUrl} />
          </video>
        ) : heroBackgroundUrl ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${heroBackgroundUrl}")` }}
            aria-hidden
          />
        ) : null}
        <div
          className="absolute inset-0 bg-gradient-to-br from-forest-950/95 via-forest-950/78 to-forest-900/35"
          aria-hidden
        />

        <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">

          <div>

            <p className="mb-5 inline-flex rounded-full border border-forest-400/40 bg-forest-500/10 px-4 py-2 text-sm font-bold text-forest-400">

              {heroBadge}

            </p>

            <h1 className="max-w-3xl text-5xl font-black leading-tight text-white md:text-7xl">{heroTitle}</h1>

            <p className="mt-6 max-w-2xl text-xl leading-8 text-white/75">{heroSubtitle}</p>

            <div className="mt-8 flex flex-wrap items-center gap-4">

              <Link to="/booking" className="rounded-full bg-forest-500 px-7 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400">

                {heroCta}

              </Link>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 pe-5 ps-1.5 py-1.5 font-bold text-white shadow-lg shadow-black/10 transition hover:border-pink-400/40 hover:bg-white/15"
                aria-label={t("hero.instagramAria")}
              >
                <span className="relative shrink-0">
                  <img
                    src={INSTAGRAM_AVATAR_URL}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 rounded-full object-cover ring-2 ring-white/25 transition group-hover:ring-pink-300/50"
                  />
                  <span className="absolute -bottom-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] ring-2 ring-forest-950">
                    <InstagramGlyph className="h-3 w-3 text-white" />
                  </span>
                </span>
                <span className="leading-tight">
                  <span className="block text-[11px] font-semibold uppercase tracking-wide text-white/55">{t("hero.instagramLabel")}</span>
                  <span>{t("hero.instagram")}</span>
                </span>
              </a>

            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">

              {heroFeatures.map((item, index) => (

                <FeatureIcon key={item} type={index === 0 ? "view" : index === 1 ? "safety" : "support"} title={item} />

              ))}

            </div>

          </div>

          <HomeInstagramGallery
            variant="hero"
            fallback={
              <div className="relative">
                <div className="absolute inset-10 rounded-full bg-forest-400/20 blur-3xl" aria-hidden />
                <img
                  src={heroSideImageUrl}
                  alt="ATV buggy ride on a green off-road trail"
                  className="animate-float relative z-10 aspect-[4/3] rounded-[2.5rem] object-cover shadow-glow"
                />
                <div className="glass absolute bottom-4 z-20 max-w-xs rounded-3xl p-5 ltr:left-4 rtl:right-4">
                  <p className="flex items-center gap-2 font-bold text-forest-400">
                    <BadgeCheck size={20} /> {heroStats}
                  </p>
                </div>
              </div>
            }
          />

        </div>

      </section>



      <section className="relative -mt-24 px-4 sm:px-6 lg:px-8">

        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_360px]">

          {ready ? (

            <>

              <BookingWidget vehicles={vehicles} routes={routes} selection={selection} onChange={setSelection} />

              <BookingSummaryCard vehicles={vehicles} routes={routes} selection={selection} />

            </>

          ) : (

            <div className="glass col-span-full rounded-[2rem] p-8 text-center text-white/60 lg:col-span-2">

              {t("home.loading")}

            </div>

          )}

        </div>

      </section>



      <AvailabilityBoard />



      {visibleRoutes.length > 0 && (

        <section id="routes" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">

          <div className="text-center">

            <h2 className="text-4xl font-black md:text-5xl">

              {(isAr ? content?.routes_title_ar : content?.routes_title_en) || t("routes.title")}

            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-lg text-white/70">

              {(isAr ? content?.routes_subtitle_ar : content?.routes_subtitle_en) || t("routes.subtitle")}

            </p>

          </div>



          <div className="mt-12 grid gap-8 lg:grid-cols-2">

            {visibleRoutes.map((route) => {

              const { start, end } = routeLabels(route);

              return (

                <article key={route.id} className="glass overflow-hidden rounded-[2rem] p-5">

                  <div className="flex flex-wrap items-start justify-between gap-4">

                    <div>

                      <h3 className="text-2xl font-black text-white">{isAr ? route.name_ar : route.name_en}</h3>

                      {(isAr ? route.description_ar : route.description_en) && (

                        <p className="mt-2 max-w-md text-sm leading-6 text-white/70">{isAr ? route.description_ar : route.description_en}</p>

                      )}

                    </div>

                    <div className="text-end">

                      <p className="text-3xl font-black text-forest-400">

                        {route.price} {t("booking.omr")}

                      </p>

                      <p className="mt-1 flex items-center justify-end gap-1 text-sm text-white/60">

                        <Clock size={15} /> {route.duration_minutes} {t("routes.minutes")}

                      </p>

                    </div>

                  </div>



                  <div className="mt-5">

                    <Suspense fallback={<div className="flex h-80 items-center justify-center rounded-3xl bg-white/5 text-white/50">{t("home.loadingMap")}</div>}>

                      <RealMapRoutePreview route={route} className="h-80" title={isAr ? route.name_ar : route.name_en} />

                    </Suspense>

                  </div>



                  <div className="mt-5 grid gap-3 sm:grid-cols-2">

                    <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80">

                      <MapPin size={18} className="shrink-0 text-forest-400" />

                      <span>

                        <span className="font-bold text-forest-400">{t("routes.start")}:</span> {start}

                      </span>

                    </div>

                    <div className="flex items-center gap-2 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/80">

                      <Navigation size={18} className="shrink-0 text-red-300" />

                      <span>

                        <span className="font-bold text-red-300">{t("routes.end")}:</span> {end}

                      </span>

                    </div>

                  </div>



                  <Link

                    to="/booking"

                    className="mt-5 block rounded-2xl bg-forest-500 px-5 py-4 text-center font-bold text-white transition hover:bg-forest-400"

                  >

                    {t("routes.book")}

                  </Link>

                </article>

              );

            })}

          </div>

        </section>

      )}

      <section id="how" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">

        <h2 className="text-center text-4xl font-black">{t("how.title")}</h2>

        <div className="mt-10 grid gap-5 md:grid-cols-4">

          {howItems.map((item, index) => (

            <FeatureIcon key={item.title} type={index === 3 ? "payment" : index === 2 ? "vehicle" : "booking"} title={item.title} text={item.text} />

          ))}

        </div>

      </section>

    </PageShell>

  );

}

