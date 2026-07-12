import type { BookingResult } from "../api/client";
import { clearBookingDraft } from "./bookingDraft";

const PENDING_VISA_KEY = "khareef_pending_visa_booking";
const BLOCK_BOOKING_PAGE_KEY = "khareef_block_booking_page";
const PAYMENT_COMPLETING_KEY = "khareef_payment_completing";

export function savePendingVisaBooking(booking: BookingResult) {
  try {
    sessionStorage.setItem(PENDING_VISA_KEY, JSON.stringify(booking));
  } catch {
    // Ignore storage errors (private mode, quota, etc.)
  }
}

export function loadPendingVisaBooking(): BookingResult | null {
  try {
    const raw = sessionStorage.getItem(PENDING_VISA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BookingResult;
  } catch {
    return null;
  }
}

export function clearPendingVisaBooking() {
  try {
    sessionStorage.removeItem(PENDING_VISA_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function markPaymentCompleting() {
  try {
    sessionStorage.setItem(PAYMENT_COMPLETING_KEY, "1");
  } catch {
    // Ignore storage errors
  }
}

export function clearPaymentCompleting() {
  try {
    sessionStorage.removeItem(PAYMENT_COMPLETING_KEY);
  } catch {
    // Ignore storage errors
  }
}

export function isPaymentCompleting(): boolean {
  try {
    return sessionStorage.getItem(PAYMENT_COMPLETING_KEY) === "1";
  } catch {
    return false;
  }
}

export function shouldBlockBookingPage(): boolean {
  try {
    return sessionStorage.getItem(BLOCK_BOOKING_PAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function clearBookingSession() {
  clearBookingDraft();
  clearPendingVisaBooking();
  clearPaymentCompleting();
  try {
    sessionStorage.removeItem(BLOCK_BOOKING_PAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

/** Call after payment succeeds — clears checkout data and blocks return to /booking. */
export function finalizePaidBookingSession() {
  clearBookingDraft();
  clearPendingVisaBooking();
  clearPaymentCompleting();
  try {
    sessionStorage.setItem(BLOCK_BOOKING_PAGE_KEY, "1");
  } catch {
    // Ignore storage errors
  }
}