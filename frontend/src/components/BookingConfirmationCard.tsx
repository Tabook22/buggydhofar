import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { BookingResult } from "../api/client";
import { BookingQrCode } from "./BookingQrCode";

const REDIRECT_SECONDS = 120;

type BookingConfirmationCardProps = {
  booking: BookingResult;
  routeName?: string;
  onRedirect: () => void;
};

function paymentLabel(method: string, t: (key: string) => string) {
  if (method === "bank_transfer") return t("booking.payTransfer");
  if (method === "visa") return t("booking.payVisa");
  return method;
}

export function BookingConfirmationCard({ booking, routeName, onRedirect }: BookingConfirmationCardProps) {
  const { t } = useTranslation();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onRedirect();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, onRedirect]);

  const bikesLabel =
    booking.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
      ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
      : "—";

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="glass mx-auto max-w-3xl rounded-[2rem] p-8 md:p-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-forest-400" size={72} />
        <h2 className="mt-6 text-3xl font-black">{t("booking.confirmed")}</h2>
        <p className="mt-3 text-white/65">{t("booking.confirmedEmail")}</p>
        {booking.booking_number && (
          <p className="mt-6 text-4xl font-black tracking-[0.2em] text-forest-400">{booking.booking_number}</p>
        )}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-black">{t("booking.confirmationDetails")}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              [t("booking.fullName"), booking.customer_name],
              [t("booking.phone"), booking.phone],
              [t("booking.email"), booking.email],
              [t("booking.date"), booking.date],
              [t("booking.time"), booking.time],
              [t("booking.route"), routeName || "—"],
              [t("booking.passengers"), String(booking.passengers)],
              [t("booking.buggyBike"), bikesLabel],
              [t("booking.total"), `${booking.total_price} ${t("booking.omr")}`],
              [t("booking.payment"), paymentLabel(booking.payment_method, t)],
              [t("admin.status"), booking.booking_status]
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-white/55">{label}</dt>
                <dd className="text-end font-semibold text-white/90">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col items-center">
          <p className="mb-4 text-center text-sm font-bold text-forest-300">{t("booking.qrTitle")}</p>
          {booking.check_in_url && <BookingQrCode checkInUrl={booking.check_in_url} size={200} />}
        </div>
      </div>

      <p className="mt-8 text-center text-sm text-white/55">{t("booking.saveBookingNumber")}</p>
      <p className="mt-2 text-center text-sm text-white/45">
        {t("booking.redirectingMinutes", { minutes, seconds })}
      </p>
    </div>
  );
}
