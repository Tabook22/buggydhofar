import type { BookingResult } from "../api/client";

export function isUnpaidVisaPending(booking: BookingResult): boolean {
  return (
    booking.payment_method === "visa" &&
    booking.payment_status !== "paid" &&
    booking.booking_status !== "cancelled"
  );
}

export function shouldDismissFailedVisa(booking: BookingResult): boolean {
  return isUnpaidVisaPending(booking);
}