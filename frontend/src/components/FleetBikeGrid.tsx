import { Bike } from "lucide-react";
import { useTranslation } from "react-i18next";
import { FleetUnitAvailability } from "../api/client";

function unitLabel(unit: FleetUnitAvailability, language: string) {
  const name = language === "ar" ? unit.name_ar : unit.name_en;
  return name || `#${unit.unit_number}`;
}

export function FleetBikeGrid({
  units,
  selectedId = 0,
  onSelect,
  loading = false,
  readOnly = false
}: {
  units: FleetUnitAvailability[];
  selectedId?: number;
  onSelect?: (id: number) => void;
  loading?: boolean;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm text-white/50">
        {t("availability.loading")}
      </div>
    );
  }

  if (!units.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/50">
        {t("booking.pickDateTime")}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-white/65">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-forest-400/50 bg-forest-500/25 text-forest-300">
            <Bike size={14} aria-hidden="true" />
          </span>
          {t("availability.bikeAvailable")}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-red-400/40 bg-red-500/15 text-red-300">
            <Bike size={14} aria-hidden="true" />
          </span>
          {t("availability.bikeBooked")}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
        {units.map((unit) => {
          const available = unit.is_available;
          const selected = unit.id === selectedId;
          const label = unitLabel(unit, i18n.language);
          const status = available ? t("availability.bikeAvailable") : t("availability.bikeBooked");

          const content = (
            <>
              <Bike size={20} strokeWidth={2.25} aria-hidden="true" />
              <span className="mt-1 max-w-full truncate text-[10px] font-bold leading-none">{unit.unit_number}</span>
            </>
          );

          const className = [
            "flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border px-1 py-2 transition",
            available
              ? "border-forest-400/55 bg-forest-500/20 text-forest-200 hover:bg-forest-500/30"
              : "cursor-not-allowed border-red-400/35 bg-red-500/12 text-red-300/90",
            selected && (available || readOnly) ? "ring-2 ring-white ring-offset-2 ring-offset-[#071611]" : "",
            readOnly || !available ? "" : "cursor-pointer"
          ]
            .filter(Boolean)
            .join(" ");

          if (readOnly || !available || !onSelect) {
            return (
              <div
                key={unit.id}
                className={className}
                title={`${label} — ${status}`}
                aria-label={`${label} — ${status}`}
              >
                {content}
              </div>
            );
          }

          return (
            <button
              key={unit.id}
              type="button"
              onClick={() => onSelect(unit.id)}
              className={className}
              title={`${label} — ${status}`}
              aria-label={`${label} — ${status}`}
              aria-pressed={selected}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
