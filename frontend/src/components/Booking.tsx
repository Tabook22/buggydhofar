import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  calculateBuggyPrice,
  FleetUnitAvailability,
  RouteExperience,
  Vehicle
} from "../api/client";
import { FleetBikeGrid } from "./FleetBikeGrid";
import { isBookingSelectionReady, saveBookingDraft } from "../lib/bookingDraft";

export type BookingSelection = {
  date: string;
  time: string;
  vehicleId: number;
  routeId: number;
  fleetUnitId: number;
  passengers: number;
};

export function calculateTotal(selection: BookingSelection) {
  if (!selection.fleetUnitId) return 0;
  return calculateBuggyPrice(selection.passengers);
}

function localizedName(item: Vehicle | RouteExperience | FleetUnitAvailability, language: string) {
  return language === "ar" ? item.name_ar : item.name_en;
}

function defaultBuggyVehicle(vehicles: Vehicle[]) {
  return vehicles.find((vehicle) => vehicle.type === "buggy" && vehicle.seats === 2) || vehicles.find((vehicle) => vehicle.type === "buggy") || vehicles[0];
}

export function BookingSummaryCard({
  selection,
  vehicles,
  routes,
  showButton = true
}: {
  selection: BookingSelection;
  vehicles: Vehicle[];
  routes: RouteExperience[];
  showButton?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [fleetUnit, setFleetUnit] = useState<FleetUnitAvailability | null>(null);
  const vehicle = vehicles.find((item) => item.id === selection.vehicleId);
  const route = routes.find((item) => item.id === selection.routeId);
  const total = calculateTotal(selection);

  useEffect(() => {
    if (!selection.date || !selection.time || !selection.fleetUnitId) {
      setFleetUnit(null);
      return;
    }
    api
      .getFleetAvailability(selection.date, selection.time)
      .then((data) => setFleetUnit(data.units.find((unit) => unit.id === selection.fleetUnitId) || null))
      .catch(() => setFleetUnit(null));
  }, [selection.date, selection.time, selection.fleetUnitId]);

  const canContinue = isBookingSelectionReady(selection);

  return (
    <aside className="glass sticky top-28 rounded-[2rem] p-6">
      <h3 className="text-2xl font-black">{t("booking.summary")}</h3>
      <dl className="mt-6 space-y-4 text-sm">
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.date")}</dt>
          <dd className="font-semibold">{selection.date || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.time")}</dt>
          <dd className="font-semibold">{selection.time || "-"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.buggyBike")}</dt>
          <dd className="font-semibold">
            {fleetUnit
              ? `#${fleetUnit.unit_number}`
              : selection.fleetUnitId
                ? `#${selection.fleetUnitId}`
                : "-"}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.route")}</dt>
          <dd className="font-semibold">{route ? localizedName(route, i18n.language) : "-"}</dd>
        </div>
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.passengers")}</dt>
          <dd className="font-semibold">{selection.passengers}</dd>
        </div>
        <div className="flex items-end justify-between gap-4 pt-2">
          <dt className="text-white/60">{t("booking.total")}</dt>
          <dd className="text-3xl font-black text-forest-400">
            {total} {t("booking.omr")}
          </dd>
        </div>
      </dl>
      {vehicle && (
        <p className="mt-4 text-xs text-white/45">
          {t("booking.pricingNote")}
        </p>
      )}
      {showButton &&
        (canContinue ? (
          <Link
            to="/booking"
            state={{ selection }}
            onClick={() => saveBookingDraft(selection)}
            className="mt-6 block rounded-2xl bg-forest-500 px-5 py-4 text-center font-bold text-white transition hover:bg-forest-400"
          >
            {t("booking.continue")}
          </Link>
        ) : (
          <p className="mt-6 rounded-2xl border border-white/10 bg-white/5 px-5 py-4 text-center text-sm text-white/50">
            {t("booking.unavailable")}
          </p>
        ))}
    </aside>
  );
}

export function BookingWidget({
  vehicles,
  routes,
  selection,
  onChange
}: {
  vehicles: Vehicle[];
  routes: RouteExperience[];
  selection: BookingSelection;
  onChange: (selection: BookingSelection) => void;
}) {
  const { t, i18n } = useTranslation();
  const [timeSlots, setTimeSlots] = useState<string[]>(["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"]);
  const [fleetUnits, setFleetUnits] = useState<FleetUnitAvailability[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");

  const fieldClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

  const update = (patch: Partial<BookingSelection>) => onChange({ ...selection, ...patch });

  const sortedRoutes = useMemo(() => routes.filter((route) => route.display_on_home !== false), [routes]);
  const defaultVehicle = useMemo(() => defaultBuggyVehicle(vehicles.filter((vehicle) => vehicle.is_available)), [vehicles]);

  useEffect(() => {
    api.getTimeSlots().then((data) => setTimeSlots(data.slots)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!selection.date || !selection.time) {
      setFleetUnits([]);
      setAvailabilityMessage(t("booking.pickDateTime"));
      return;
    }

    let active = true;
    setFleetLoading(true);
    api
      .getFleetAvailability(selection.date, selection.time)
      .then((data) => {
        if (!active) return;
        setFleetUnits(data.units);
        setAvailabilityMessage(
          data.available > 0
            ? t("availability.bikesAvailable", { count: data.available, total: data.total_bikes })
            : t("availability.noBikes")
        );
      })
      .catch(() => {
        if (!active) return;
        setFleetUnits([]);
        setAvailabilityMessage(t("availability.loadError"));
      })
      .finally(() => {
        if (active) setFleetLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selection.date, selection.time, t]);

  useEffect(() => {
    if (!selection.date || !selection.time || fleetLoading || fleetUnits.length === 0) return;

    if (selection.fleetUnitId) {
      const stillAvailable = fleetUnits.some((unit) => unit.id === selection.fleetUnitId && unit.is_available);
      if (stillAvailable) return;
    }

    const firstOpen = fleetUnits.find((unit) => unit.is_available);
    const nextFleetUnitId = firstOpen?.id || 0;
    if (nextFleetUnitId === selection.fleetUnitId) return;
    onChange({ ...selection, fleetUnitId: nextFleetUnitId });
  }, [fleetUnits, fleetLoading, selection.date, selection.time, selection.fleetUnitId, onChange, selection]);

  useEffect(() => {
    const patch: Partial<BookingSelection> = {};
    if (!selection.vehicleId && defaultVehicle) patch.vehicleId = defaultVehicle.id;
    if (!selection.routeId && sortedRoutes[0]) patch.routeId = sortedRoutes[0].id;
    if (!Object.keys(patch).length) return;
    onChange({ ...selection, ...patch });
  }, [defaultVehicle, sortedRoutes, selection.vehicleId, selection.routeId, onChange, selection]);

  const availableUnits = fleetUnits.filter((unit) => unit.is_available);

  return (
    <div className="glass rounded-[2rem] p-6 md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">{t("booking.quickTitle")}</p>
      <h2 className="mt-3 text-3xl font-black">{t("booking.quickSubtitle")}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.selectDate")}</span>
          <input className={fieldClass} type="date" value={selection.date} min={new Date().toISOString().slice(0, 10)} onChange={(event) => update({ date: event.target.value, fleetUnitId: 0 })} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.selectTime")}</span>
          <select className={fieldClass} value={selection.time} onChange={(event) => update({ time: event.target.value, fleetUnitId: 0 })}>
            <option value="">{t("booking.selectTime")}</option>
            {timeSlots.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.buggyBike")}</span>
          <FleetBikeGrid
            units={fleetUnits}
            selectedId={selection.fleetUnitId}
            loading={fleetLoading}
            onSelect={(fleetUnitId) => update({ fleetUnitId })}
          />
          <p className={`text-sm ${availableUnits.length ? "text-forest-300" : "text-red-300"}`}>{availabilityMessage}</p>
        </div>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.route")}</span>
          <select className={fieldClass} value={selection.routeId || ""} onChange={(event) => update({ routeId: Number(event.target.value) })}>
            <option value="">{t("booking.route")}</option>
            {sortedRoutes.map((route) => (
              <option key={route.id} value={route.id}>
                {localizedName(route, i18n.language)}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.passengers")}</span>
          <select className={fieldClass} value={selection.passengers} onChange={(event) => update({ passengers: Number(event.target.value) })}>
            <option value={1}>{t("booking.onePassenger")} — 24 {t("booking.omr")}</option>
            <option value={2}>{t("booking.twoPassengers")} — 30 {t("booking.omr")}</option>
          </select>
        </label>
      </div>
    </div>
  );
}

export type { FleetUnitAvailability };
