import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  api,
  bikesRequiredForPassengers,
  BookingMode,
  GROUP_TYPE_OPTIONS,
  GroupType,
  groupTypeLabel,
  calculateBookingTotal,
  calculateSubtotal,
  calculateTax,
  calculateTotalWithTax,
  FleetUnitAvailability,
  maxPassengersForAvailableBikes,
  RouteExperience,
  TAX_PERCENT,
  Vehicle
} from "../api/client";
import { FleetBikeGrid } from "./FleetBikeGrid";
import { isBookingSelectionReady, saveBookingDraft } from "../lib/bookingDraft";
import { pricingNoteValues } from "../lib/pricingDisplay";

export type BookingSelection = {
  date: string;
  time: string;
  vehicleId: number;
  routeId: number;
  fleetUnitIds: number[];
  passengers: number;
  bookingMode: BookingMode;
  groupType: GroupType | "";
};

export function calculateTotal(selection: BookingSelection) {
  if (!selection.fleetUnitIds.length) return 0;
  return calculateBookingTotal(selection.passengers, selection.bookingMode);
}

export function bookingPriceSummary(selection: BookingSelection) {
  const subtotal = calculateSubtotal(selection.passengers, selection.bookingMode);
  const tax = calculateTax(subtotal);
  const total = calculateTotalWithTax(subtotal);
  return { subtotal, tax, total };
}

function localizedName(item: Vehicle | RouteExperience | FleetUnitAvailability, language: string) {
  return language === "ar" ? item.name_ar : item.name_en;
}

function defaultBuggyVehicle(vehicles: Vehicle[]) {
  return vehicles.find((vehicle) => vehicle.type === "buggy" && vehicle.seats === 2) || vehicles.find((vehicle) => vehicle.type === "buggy") || vehicles[0];
}

function syncFleetSelection(
  currentIds: number[],
  fleetUnits: FleetUnitAvailability[],
  bikesNeeded: number
) {
  const availableIds = new Set(fleetUnits.filter((unit) => unit.is_available).map((unit) => unit.id));
  const kept = currentIds.filter((id) => availableIds.has(id)).slice(0, bikesNeeded);
  const next = [...kept];
  for (const unit of fleetUnits) {
    if (next.length >= bikesNeeded) break;
    if (unit.is_available && !next.includes(unit.id)) {
      next.push(unit.id);
    }
  }
  return next;
}

export type AppliedPromo = {
  code: string;
  subtotal: number;
  discount_amount: number;
  tax: number;
  total: number;
};

export function BookingSummaryCard({
  selection,
  vehicles,
  routes,
  showButton = true,
  appliedPromo = null
}: {
  selection: BookingSelection;
  vehicles: Vehicle[];
  routes: RouteExperience[];
  showButton?: boolean;
  appliedPromo?: AppliedPromo | null;
}) {
  const { t, i18n } = useTranslation();
  const [fleetUnits, setFleetUnits] = useState<FleetUnitAvailability[]>([]);
  const vehicle = vehicles.find((item) => item.id === selection.vehicleId);
  const route = routes.find((item) => item.id === selection.routeId);
  const prices = bookingPriceSummary(selection);
  const summary = appliedPromo ?? {
    subtotal: prices.subtotal,
    discount_amount: 0,
    tax: prices.tax,
    total: prices.total
  };
  const total = selection.fleetUnitIds.length ? summary.total : 0;
  const bikesNeeded = bikesRequiredForPassengers(selection.passengers, selection.bookingMode);
  const selectedUnits = fleetUnits.filter((unit) => selection.fleetUnitIds.includes(unit.id));

  useEffect(() => {
    if (!selection.date || !selection.time || selection.fleetUnitIds.length === 0) {
      setFleetUnits([]);
      return;
    }
    api
      .getFleetAvailability(selection.date, selection.time)
      .then((data) => setFleetUnits(data.units))
      .catch(() => setFleetUnits([]));
  }, [selection.date, selection.time, selection.fleetUnitIds]);

  const canContinue = isBookingSelectionReady(selection);
  const bikeLabel =
    selectedUnits.length > 0
      ? selectedUnits.map((unit) => `#${unit.unit_number}`).join(", ")
      : selection.fleetUnitIds.length > 0
        ? selection.fleetUnitIds.map((id) => `#${id}`).join(", ")
        : "-";

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
          <dt className="text-white/60">{t("booking.bookingMode")}</dt>
          <dd className="font-semibold">
            {selection.bookingMode === "individual" ? t("booking.modeIndividual") : t("booking.modeGroup")}
          </dd>
        </div>
        {selection.bookingMode === "group" && selection.groupType && (
          <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
            <dt className="text-white/60">{t("booking.groupType")}</dt>
            <dd className="font-semibold">{groupTypeLabel(selection.groupType, i18n.language)}</dd>
          </div>
        )}
        <div className="flex justify-between gap-4 border-b border-white/10 pb-3">
          <dt className="text-white/60">{t("booking.bikes")}</dt>
          <dd className="max-w-[55%] text-end font-semibold">
            {bikeLabel}
            <span className="mt-1 block text-xs text-white/45">
              {t("booking.bikesNeeded", { count: bikesNeeded })}
            </span>
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
        {selection.fleetUnitIds.length > 0 && (
          <>
            <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
              <dt className="text-white/60">{t("booking.subtotal")}</dt>
              <dd className="font-semibold">
                {summary.subtotal.toFixed(2)} {t("booking.omr")}
              </dd>
            </div>
            {appliedPromo && appliedPromo.discount_amount > 0 && (
              <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm text-forest-300">
                <dt>
                  {t("booking.promoDiscount")} ({appliedPromo.code})
                </dt>
                <dd className="font-semibold">
                  -{appliedPromo.discount_amount.toFixed(2)} {t("booking.omr")}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-4 border-b border-white/10 pb-3 text-sm">
              <dt className="text-white/60">{t("booking.tax", { percent: TAX_PERCENT })}</dt>
              <dd className="font-semibold">
                {summary.tax.toFixed(2)} {t("booking.omr")}
              </dd>
            </div>
          </>
        )}
        <div className="flex items-end justify-between gap-4 pt-2">
          <dt className="text-white/60">{t("booking.totalInclTax")}</dt>
          <dd className="text-3xl font-black text-forest-400">
            {total.toFixed(2)} {t("booking.omr")}
          </dd>
        </div>
        {selection.fleetUnitIds.length > 0 && (
          <p className="mt-2 text-xs text-white/45">{t("booking.taxNote", { percent: TAX_PERCENT })}</p>
        )}
      </dl>
      {vehicle && (
        <p className="mt-4 text-xs text-white/45">
          {t("booking.pricingNote", pricingNoteValues())}
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
  const [timeSlots, setTimeSlots] = useState<string[]>(["08:00", "10:00", "12:00", "14:00", "16:00", "17:00"]);
  const [fleetUnits, setFleetUnits] = useState<FleetUnitAvailability[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState("");
  const [passengersDraft, setPassengersDraft] = useState(String(selection.passengers));

  const fieldClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

  const update = (patch: Partial<BookingSelection>) => onChange({ ...selection, ...patch });

  const sortedRoutes = useMemo(() => routes.filter((route) => route.display_on_home !== false), [routes]);
  const defaultVehicle = useMemo(() => defaultBuggyVehicle(vehicles.filter((vehicle) => vehicle.is_available)), [vehicles]);
  const availableUnits = fleetUnits.filter((unit) => unit.is_available);
  const bikesNeeded = bikesRequiredForPassengers(selection.passengers, selection.bookingMode);
  const maxPassengers = Math.max(1, maxPassengersForAvailableBikes(availableUnits.length, selection.bookingMode));

  useEffect(() => {
    let active = true;
    api
      .getTimeSlots(selection.date || undefined)
      .then((data) => {
        if (!active) return;
        setTimeSlots(data.slots);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [selection.date]);

  // Drop times that are not offered on the selected date (e.g. no 12:00 on Fridays).
  useEffect(() => {
    if (selection.time && timeSlots.length > 0 && !timeSlots.includes(selection.time)) {
      update({ time: "", fleetUnitIds: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to slot list / current time
  }, [selection.time, timeSlots]);

  useEffect(() => {
    setPassengersDraft(String(selection.passengers));
  }, [selection.passengers]);

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
    if (!selection.date || !selection.time || fleetLoading) return;
    const nextIds = syncFleetSelection(selection.fleetUnitIds, fleetUnits, bikesNeeded);
    const cappedPassengers = Math.min(Math.max(selection.passengers, 1), Math.max(1, maxPassengers));
    const patch: Partial<BookingSelection> = {};
    if (nextIds.join(",") !== selection.fleetUnitIds.join(",")) patch.fleetUnitIds = nextIds;
    if (cappedPassengers !== selection.passengers) patch.passengers = cappedPassengers;
    if (Object.keys(patch).length) onChange({ ...selection, ...patch });
  }, [
    fleetUnits,
    fleetLoading,
    selection.date,
    selection.time,
    bikesNeeded,
    maxPassengers,
    selection.bookingMode,
    availableUnits.length,
    selection.fleetUnitIds,
    selection.passengers,
    onChange,
    selection
  ]);

  useEffect(() => {
    const patch: Partial<BookingSelection> = {};
    if (!selection.vehicleId && defaultVehicle) patch.vehicleId = defaultVehicle.id;
    if (!selection.routeId && sortedRoutes[0]) patch.routeId = sortedRoutes[0].id;
    if (!Object.keys(patch).length) return;
    onChange({ ...selection, ...patch });
  }, [defaultVehicle, sortedRoutes, selection.vehicleId, selection.routeId, onChange, selection]);

  function changeMode(mode: BookingMode) {
    if (mode === selection.bookingMode) return;
    const cap = Math.max(1, maxPassengersForAvailableBikes(availableUnits.length, mode));
    const passengers = Math.min(Math.max(selection.passengers, 1), cap);
    const needed = bikesRequiredForPassengers(passengers, mode);
    update({
      bookingMode: mode,
      groupType: mode === "group" ? selection.groupType : "",
      passengers,
      fleetUnitIds: syncFleetSelection(selection.fleetUnitIds, fleetUnits, needed)
    });
  }

  function selectGroupType(type: GroupType) {
    update({ groupType: selection.groupType === type ? "" : type });
  }

  const groupTypeButtonClass = (active: boolean) =>
    [
      "flex items-center gap-3 rounded-2xl border px-4 py-3 text-start transition",
      active
        ? "border-forest-400 bg-forest-500/25 text-white ring-2 ring-forest-400/40"
        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
    ].join(" ");

  function toggleFleetUnit(fleetUnitId: number) {
    const isSelected = selection.fleetUnitIds.includes(fleetUnitId);
    if (isSelected) {
      update({ fleetUnitIds: selection.fleetUnitIds.filter((id) => id !== fleetUnitId) });
      return;
    }
    if (selection.fleetUnitIds.length >= bikesNeeded) return;
    update({ fleetUnitIds: [...selection.fleetUnitIds, fleetUnitId] });
  }

  function applyPassengers(passengers: number) {
    const clamped = Math.min(Math.max(1, passengers), Math.max(1, maxPassengers));
    const needed = bikesRequiredForPassengers(clamped, selection.bookingMode);
    update({
      passengers: clamped,
      fleetUnitIds: syncFleetSelection(selection.fleetUnitIds, fleetUnits, needed)
    });
  }

  function handlePassengersInput(raw: string) {
    const digits = raw.replace(/\D/g, "");
    setPassengersDraft(digits);
    if (!digits) return;
    const parsed = Number.parseInt(digits, 10);
    if (!Number.isFinite(parsed) || parsed < 1) return;
    if (parsed <= maxPassengers) {
      applyPassengers(parsed);
    }
  }

  function handlePassengersBlur() {
    if (!passengersDraft.trim()) {
      applyPassengers(1);
      setPassengersDraft("1");
      return;
    }
    const parsed = Number.parseInt(passengersDraft, 10);
    const clamped = Math.min(Math.max(1, Number.isFinite(parsed) ? parsed : 1), Math.max(1, maxPassengers));
    applyPassengers(clamped);
    setPassengersDraft(String(clamped));
  }

  const modeButtonClass = (active: boolean) =>
    [
      "rounded-2xl border px-4 py-4 text-start transition",
      active
        ? "border-forest-400 bg-forest-500/25 text-white ring-2 ring-forest-400/40"
        : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:bg-white/10"
    ].join(" ");

  const selectionReady = selection.fleetUnitIds.length === bikesNeeded && bikesNeeded <= availableUnits.length;

  return (
    <div className="glass rounded-[2rem] p-6 md:p-8">
      <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">{t("booking.quickTitle")}</p>
      <h2 className="mt-3 text-3xl font-black">{t("booking.quickSubtitle")}</h2>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.bookingMode")}</span>
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" className={modeButtonClass(selection.bookingMode === "group")} onClick={() => changeMode("group")}>
              <span className="block font-bold">{t("booking.modeGroup")}</span>
              <span className="mt-1 block text-xs text-white/55">{t("booking.modeGroupHelp")}</span>
            </button>
            <button type="button" className={modeButtonClass(selection.bookingMode === "individual")} onClick={() => changeMode("individual")}>
              <span className="block font-bold">{t("booking.modeIndividual")}</span>
              <span className="mt-1 block text-xs text-white/55">{t("booking.modeIndividualHelp")}</span>
            </button>
          </div>
        </div>
        {selection.bookingMode === "group" && (
          <div className="space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-white/75">{t("booking.groupType")}</span>
            <p className="text-xs text-white/50">{t("booking.groupTypeHelp")}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {GROUP_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={groupTypeButtonClass(selection.groupType === type)}
                  onClick={() => selectGroupType(type)}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      selection.groupType === type ? "border-forest-300 bg-forest-500 text-white" : "border-white/25 bg-transparent"
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {selection.groupType === type ? "✓" : ""}
                  </span>
                  <span className="font-bold">{t(`booking.groupType${type.charAt(0).toUpperCase()}${type.slice(1)}`)}</span>
                </button>
              ))}
            </div>
            {!selection.groupType && (
              <p className="theme-alert-warning text-xs text-amber-300/90">{t("booking.groupTypeRequired")}</p>
            )}
          </div>
        )}
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.selectDate")}</span>
          <input
            className={fieldClass}
            type="date"
            value={selection.date}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(event) => update({ date: event.target.value, time: "", fleetUnitIds: [] })}
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.selectTime")}</span>
          <select className={fieldClass} value={selection.time} onChange={(event) => update({ time: event.target.value, fleetUnitIds: [] })}>
            <option value="">{t("booking.selectTime")}</option>
            {timeSlots.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.passengers")}</span>
          <input
            className={fieldClass}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            aria-label={t("booking.passengers")}
            value={passengersDraft}
            onChange={(event) => handlePassengersInput(event.target.value)}
            onBlur={handlePassengersBlur}
            onFocus={(event) => event.target.select()}
          />
          <p className="text-xs text-white/50">
            {selection.bookingMode === "individual"
              ? t("booking.bikesNeededIndividual", { count: bikesNeeded })
              : t("booking.bikesNeeded", { count: bikesNeeded })}
            {maxPassengers < 40 && ` · ${t("booking.maxPassengersHint", { count: maxPassengers })}`}
          </p>
        </label>
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
        <div className="space-y-2 md:col-span-2">
          <span className="text-sm font-semibold text-white/75">{t("booking.selectBikes")}</span>
          <FleetBikeGrid
            units={fleetUnits}
            selectedIds={selection.fleetUnitIds}
            maxSelectable={bikesNeeded}
            loading={fleetLoading}
            onToggle={toggleFleetUnit}
          />
          <p className={`text-sm ${selectionReady && availableUnits.length ? "text-forest-300" : "text-red-300"}`}>
            {selectionReady
              ? availabilityMessage
              : availableUnits.length < bikesNeeded
                ? t("booking.notEnoughBikes", { needed: bikesNeeded, available: availableUnits.length })
                : t("booking.selectMoreBikes", { selected: selection.fleetUnitIds.length, required: bikesNeeded })}
          </p>
        </div>
      </div>
    </div>
  );
}

export type { FleetUnitAvailability };
