import { BookingSelection } from "../components/Booking";
import { bikesRequiredForPassengers, normalizeBookingMode, normalizeGroupType } from "../api/client";

const STORAGE_KEY = "khareef_booking_draft";

export const defaultBookingSelection: BookingSelection = {
  date: "",
  time: "",
  vehicleId: 0,
  routeId: 0,
  fleetUnitIds: [],
  passengers: 1,
  bookingMode: "group",
  groupType: ""
};

export function isBookingSelectionReady(selection: BookingSelection) {
  const bikesNeeded = bikesRequiredForPassengers(selection.passengers, selection.bookingMode);
  const groupTypeOk = selection.bookingMode !== "group" || Boolean(selection.groupType);
  return Boolean(
    selection.date &&
      selection.time &&
      selection.routeId &&
      selection.fleetUnitIds.length === bikesNeeded &&
      groupTypeOk
  );
}

export function saveBookingDraft(selection: BookingSelection) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

export function loadBookingDraft(): BookingSelection | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BookingSelection> & { fleetUnitId?: number };
    if (!parsed || typeof parsed !== "object") return null;

    const legacyFleetUnitId = typeof parsed.fleetUnitId === "number" ? parsed.fleetUnitId : 0;
    const fleetUnitIds = Array.isArray(parsed.fleetUnitIds)
      ? parsed.fleetUnitIds.filter((id): id is number => typeof id === "number" && id > 0)
      : legacyFleetUnitId
        ? [legacyFleetUnitId]
        : [];

    const passengers =
      typeof parsed.passengers === "number" && parsed.passengers >= 1
        ? Math.min(Math.floor(parsed.passengers), 40)
        : 1;

    return {
      date: typeof parsed.date === "string" ? parsed.date : "",
      time: typeof parsed.time === "string" ? parsed.time : "",
      vehicleId: typeof parsed.vehicleId === "number" ? parsed.vehicleId : 0,
      routeId: typeof parsed.routeId === "number" ? parsed.routeId : 0,
      fleetUnitIds,
      passengers,
      bookingMode: normalizeBookingMode(parsed.bookingMode),
      groupType: normalizeGroupType(parsed.groupType)
    };
  } catch {
    return null;
  }
}

export function clearBookingDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function resolveInitialBookingSelection(navState: unknown): BookingSelection {
  const fromNav = (navState as { selection?: BookingSelection } | null)?.selection;
  if (fromNav && isBookingSelectionReady(fromNav)) {
    return fromNav;
  }
  const fromStorage = loadBookingDraft();
  if (fromStorage && fromStorage.date) {
    return fromStorage;
  }
  return defaultBookingSelection;
}
