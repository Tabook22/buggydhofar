import { BookingSelection } from "../components/Booking";

const STORAGE_KEY = "khareef_booking_draft";

export const defaultBookingSelection: BookingSelection = {
  date: "",
  time: "",
  vehicleId: 0,
  routeId: 0,
  fleetUnitId: 0,
  passengers: 1
};

export function isBookingSelectionReady(selection: BookingSelection) {
  return Boolean(selection.date && selection.time && selection.fleetUnitId && selection.routeId);
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
    const parsed = JSON.parse(raw) as Partial<BookingSelection>;
    if (!parsed || typeof parsed !== "object") return null;
    return {
      date: typeof parsed.date === "string" ? parsed.date : "",
      time: typeof parsed.time === "string" ? parsed.time : "",
      vehicleId: typeof parsed.vehicleId === "number" ? parsed.vehicleId : 0,
      routeId: typeof parsed.routeId === "number" ? parsed.routeId : 0,
      fleetUnitId: typeof parsed.fleetUnitId === "number" ? parsed.fleetUnitId : 0,
      passengers: parsed.passengers === 2 ? 2 : 1
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
