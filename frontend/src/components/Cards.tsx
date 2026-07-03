import { useTranslation } from "react-i18next";
import { RouteExperience, Vehicle } from "../api/client";

export function RouteCard({ route, onBook }: { route: RouteExperience; onBook?: () => void }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";

  return (
    <article className="soft-card overflow-hidden rounded-[2rem]">
      <img src={route.image_url} alt={isAr ? route.name_ar : route.name_en} className="h-52 w-full object-cover" />
      <div className="p-6">
        {route.is_popular && <span className="rounded-full bg-forest-500 px-3 py-1 text-xs font-bold">{t("routes.popular")}</span>}
        <h3 className="mt-4 text-2xl font-black">{isAr ? route.name_ar : route.name_en}</h3>
        <p className="mt-3 text-white/65">{isAr ? route.description_ar : route.description_en}</p>
        <button onClick={onBook} className="mt-5 rounded-full bg-forest-500 px-5 py-3 font-bold text-white">
          {t("routes.book")}
        </button>
      </div>
    </article>
  );
}

export function VehicleCard({
  vehicle,
  selected = false,
  onSelect
}: {
  vehicle: Vehicle;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { t, i18n } = useTranslation();
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`soft-card overflow-hidden rounded-[2rem] text-start transition hover:-translate-y-1 hover:border-forest-400 ${
        selected ? "border-forest-400 ring-2 ring-forest-400/40" : ""
      }`}
    >
      <img src={vehicle.image_url} alt={vehicle.name_en} className="h-44 w-full object-cover" />
      <div className="p-5">
        <h3 className="text-xl font-black">{i18n.language === "ar" ? vehicle.name_ar : vehicle.name_en}</h3>
        <p className="mt-2 text-white/65">
          {vehicle.seats} {t("booking.person")} · {vehicle.price_per_hour} {t("booking.omr")}/hr
        </p>
        <span className="mt-4 inline-flex rounded-full bg-forest-500 px-4 py-2 text-sm font-bold text-white">{t("vehicles.select")}</span>
      </div>
    </button>
  );
}

export function WhyBookCard({ text }: { text: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/5 p-5 font-semibold text-white">{text}</div>;
}
