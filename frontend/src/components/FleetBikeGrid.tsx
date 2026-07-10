import { useTranslation } from "react-i18next";
import { Bike } from "lucide-react";
import { FleetUnitAvailability } from "../api/client";

function unitLabel(unit: FleetUnitAvailability, language: string) {
  const name = language === "ar" ? unit.name_ar : unit.name_en;
  return name || `#${unit.unit_number}`;
}

export function FleetBikeGrid({
  units,
  selectedIds = [],
  maxSelectable,
  onToggle,
  loading = false,
  readOnly = false
}: {
  units: FleetUnitAvailability[];
  selectedIds?: number[];
  maxSelectable?: number;
  onToggle?: (id: number) => void;
  loading?: boolean;
  readOnly?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const limit = maxSelectable ?? 1;

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
    <div className="fleet-bike-grid space-y-3">
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
        {limit > 1 && (
          <span className="text-forest-300">
            {t("booking.bikesSelected", { selected: selectedIds.length, required: limit })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12">
        {units.map((unit) => {
          const available = unit.is_available;
          const selected = selectedIds.includes(unit.id);
          const atLimit = selectedIds.length >= limit && !selected;
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
              ? selected
                ? "border-white bg-forest-500/35 text-white ring-2 ring-white ring-offset-2 ring-offset-forest-950"
                : atLimit
                  ? "border-forest-400/25 bg-forest-500/10 text-forest-300/50"
                  : "border-forest-400/55 bg-forest-500/20 text-forest-200 hover:bg-forest-500/30 cursor-pointer"
              : "cursor-not-allowed border-red-400/35 bg-red-500/12 text-red-300/90",
            readOnly || !available ? "" : atLimit && !selected ? "cursor-not-allowed" : ""
          ]
            .filter(Boolean)
            .join(" ");

          if (readOnly || !available || !onToggle) {
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
              onClick={() => onToggle(unit.id)}
              disabled={!available || (atLimit && !selected)}
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
