import { lazy, Suspense, useEffect, useState } from "react";

import { Link } from "react-router-dom";

import { useTranslation } from "react-i18next";

import { BadgeCheck, MapPin, Clock, Navigation } from "lucide-react";

import { AvailabilityBoard } from "../components/AvailabilityBoard";

import { api, RouteExperience, SiteContent, Vehicle } from "../api/client";

import { BookingSummaryCard, BookingWidget } from "../components/Booking";

import { FeatureIcon, PageShell } from "../components/Layout";

import { defaultBookingSelection, loadBookingDraft, saveBookingDraft } from "../lib/bookingDraft";
import { isVideoUrl, resolveMediaUrl } from "../lib/mediaUrl";



const INSTAGRAM_URL = "https://www.instagram.com/gobuggydhofar/";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
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

              {t("hero.badge")}

            </p>

            <h1 className="max-w-3xl text-5xl font-black leading-tight text-white md:text-7xl">{t("hero.title")}</h1>

            <p className="mt-6 max-w-2xl text-xl leading-8 text-white/75">{t("hero.subtitle")}</p>

            <div className="mt-8 flex flex-wrap items-center gap-4">

              <Link to="/booking" className="rounded-full bg-forest-500 px-7 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400">

                {t("hero.cta")}

              </Link>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/10 px-6 py-3.5 font-bold text-white transition hover:border-pink-400/40 hover:bg-white/15"
                aria-label={t("hero.instagramAria")}
              >
                <InstagramIcon className="h-5 w-5 text-pink-300" />
                <span>{t("hero.instagram")}</span>
              </a>

            </div>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">

              {heroFeatures.map((item, index) => (

                <FeatureIcon key={item} type={index === 0 ? "view" : index === 1 ? "safety" : "support"} title={item} />

              ))}

            </div>

          </div>

          <div className="relative">

            <div className="absolute inset-10 rounded-full bg-forest-400/20 blur-3xl" />

            <img

              src={heroSideImageUrl}

              alt="ATV buggy ride on a green off-road trail"

              className="animate-float relative z-10 aspect-[4/3] rounded-[2.5rem] object-cover shadow-glow"

            />

            <div className="glass absolute bottom-4 z-20 max-w-xs rounded-3xl p-5 ltr:left-4 rtl:right-4">

              <p className="flex items-center gap-2 font-bold text-forest-400">

                <BadgeCheck size={20} /> {t("hero.stats")}

              </p>

            </div>

          </div>

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

