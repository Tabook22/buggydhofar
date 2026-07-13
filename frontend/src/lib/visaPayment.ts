import { api, BookingResult } from "../api/client";
import { normalizeAmwalCallback } from "./amwalCallback";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function loadPaidBooking(token: string, attempts = 20): Promise<BookingResult | null> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const booking = await api.getBookingConfirmation(token);
      if (booking.payment_status === "paid") {
        return booking;
      }
    } catch {
      // Retry while payment confirmation propagates.
    }
    if (attempt < attempts - 1) {
      await sleep(700);
    }
  }
  return null;
}

export async function tryCompletePayment(
  token: string,
  callbackData: Record<string, string>,
  attempts = 8
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const payment = await api.completeAmwalPayment(null, callbackData, token);
      if (payment.success) {
        return true;
      }
    } catch {
      // Gateway may still be finalizing — retry.
    }
    if (attempt < attempts - 1) {
      await sleep(800 * (attempt + 1));
    }
  }
  return false;
}

export function appendCallbackToSearchParams(
  params: URLSearchParams,
  callbackData: Record<string, string> | null
) {
  if (!callbackData) return;
  for (const [key, value] of Object.entries(callbackData)) {
    if (value) {
      params.set(key, value);
    }
  }
}

export function buildConfirmationPath(
  token: string,
  options: {
    paymentSuccess?: boolean;
    callbackData?: Record<string, string> | null;
  } = {}
) {
  const params = new URLSearchParams();
  if (options.paymentSuccess) {
    params.set("payment", "success");
  }
  appendCallbackToSearchParams(params, options.callbackData ?? null);
  const query = params.toString();
  return `/booking/confirmation/${token}${query ? `?${query}` : ""}`;
}

export function callbackFromSearchParams(searchParams: URLSearchParams) {
  return normalizeAmwalCallback(searchParams);
}