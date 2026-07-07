import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { BookingResult, groupTypeDetailRow } from "../api/client";
import { BookingQrCode } from "./BookingQrCode";

const REDIRECT_SECONDS = 120;

type BookingConfirmationCardProps = {
  booking: BookingResult;
  routeName?: string;
  onRedirect: () => void;
  onPayOnline?: () => void;
  payingOnline?: boolean;
  paymentError?: string;
  paymentJustCompleted?: boolean;
  autoRedirect?: boolean;
  lookupMode?: boolean;
};

function paymentLabel(method: string, t: (key: string) => string) {
  if (method === "bank_transfer") return t("booking.payTransfer");
  if (method === "visa") return t("booking.payVisa");
  return method;
}

export function BookingConfirmationCard({
  booking,
  routeName,
  onRedirect,
  onPayOnline,
  payingOnline = false,
  paymentError = "",
  paymentJustCompleted = false,
  autoRedirect = true,
  lookupMode = false
}: BookingConfirmationCardProps) {
  const { t, i18n } = useTranslation();
  const isPaid = booking.payment_status === "paid";
  const paymentStepComplete = isPaid || booking.payment_method === "bank_transfer";
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);

  useEffect(() => {
    if (!autoRedirect) return;
    if (secondsLeft <= 0) {
      onRedirect();
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft, onRedirect, autoRedirect]);

  const bikesLabel =
    booking.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
      ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
      : "—";

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = String(secondsLeft % 60).padStart(2, "0");

  const paymentStatusLabel = isPaid
    ? t("booking.paymentPaid")
    : booking.payment_method === "visa"
      ? t("booking.paymentPendingOnline")
      : t("booking.paymentPendingTransfer");

  const bookingStatusLabel = isPaid
    ? t("booking.statusConfirmed")
    : booking.booking_status === "cancelled"
      ? t("booking.statusCancelled")
      : t("booking.statusPending");

  const groupTypeRow = groupTypeDetailRow(booking, t, i18n.language);
  const detailRows: [string, string][] = [
    [t("booking.fullName"), booking.customer_name],
    [t("booking.phone"), booking.phone],
    [t("booking.email"), booking.email],
    [t("booking.date"), booking.date],
    [t("booking.time"), booking.time],
    [t("booking.route"), routeName || "—"],
    [t("booking.passengers"), String(booking.passengers)],
    ...(groupTypeRow ? [groupTypeRow] : []),
    [t("booking.buggyBike"), bikesLabel],
    [t("booking.total"), `${booking.total_price} ${t("booking.omr")}`],
    ...(!isPaid
      ? [
          [t("booking.payment"), paymentLabel(booking.payment_method, t)] as [string, string],
          [t("booking.paymentStatus"), paymentStatusLabel] as [string, string]
        ]
      : []),
    [t("booking.bookingStatus"), bookingStatusLabel]
  ];

  const title = lookupMode
    ? t("lookup.statusTitle")
    : paymentJustCompleted || paymentStepComplete
      ? isPaid
        ? t("booking.paymentConfirmedTitle")
        : t("booking.transferConfirmedTitle")
      : t("booking.confirmed");
  const subtitle = lookupMode
    ? t("lookup.statusSubtitle")
    : paymentJustCompleted || paymentStepComplete
      ? isPaid
        ? t("booking.paymentConfirmedSubtitle")
        : t("booking.transferConfirmedSubtitle")
      : t("booking.confirmedEmail");

  return (
    <div className="glass mx-auto max-w-3xl rounded-[2rem] p-8 md:p-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto text-forest-400" size={72} />
        <h2 className="mt-6 text-3xl font-black">{title}</h2>
        <p className="mt-3 text-white/65">{subtitle}</p>
        {booking.booking_number && (
          <p className="mt-6 text-4xl font-black tracking-[0.2em] text-forest-400">{booking.booking_number}</p>
        )}
        {isPaid && (
          <p className="mt-4 inline-flex rounded-full bg-forest-500/20 px-4 py-2 text-sm font-bold text-forest-200">
            {t("booking.allSetBadge")}
          </p>
        )}
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <h3 className="text-lg font-black">{t("booking.confirmationDetails")}</h3>
          <dl className="mt-4 space-y-3 text-sm">
            {detailRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                <dt className="text-white/55">{label}</dt>
                <dd className={`text-end font-semibold ${label === t("booking.paymentStatus") && isPaid ? "text-forest-300" : "text-white/90"}`}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col items-center">
          {paymentStepComplete ? (
            <>
              <p className="mb-4 text-center text-sm font-bold text-forest-300">{t("booking.passQrTitle")}</p>
              {booking.check_in_url && <BookingQrCode checkInUrl={booking.check_in_url} size={200} hintKey="booking.passQrHint" />}
              <p className="mt-4 max-w-[220px] text-center text-xs text-white/55">
                {isPaid ? t("booking.keepQrVisible") : t("booking.transferQrHint")}
              </p>
            </>
          ) : (
            <p className="max-w-[220px] rounded-2xl border border-white/10 bg-white/5 p-5 text-center text-sm text-white/60">
              {t("booking.qrAfterPayment")}
            </p>
          )}
        </div>
      </div>

      {onPayOnline && (
        <div className="mt-8 text-center">
          {paymentError && <p className="mb-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{paymentError}</p>}
          <button
            type="button"
            disabled={payingOnline}
            onClick={onPayOnline}
            className="rounded-2xl bg-forest-500 px-8 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {payingOnline ? t("booking.paymentProcessing") : t("booking.payNow")}
          </button>
          <p className="mt-3 text-sm text-white/55">{t("booking.paymentPendingOnlineHint")}</p>
        </div>
      )}

      {!lookupMode && (
        <>
          <p className="mt-8 text-center text-sm text-white/55">{t("booking.saveBookingNumber")}</p>
          {isPaid ? (
            <p className="mt-2 text-center text-sm text-white/45">{t("booking.paidStayHint")}</p>
          ) : autoRedirect ? (
            <p className="mt-2 text-center text-sm text-white/45">
              {t("booking.redirectingMinutes", { minutes, seconds })}
            </p>
          ) : null}
        </>
      )}
      {lookupMode && booking.checked_in_at && (
        <p className="mt-6 text-center text-sm font-semibold text-forest-300">{t("lookup.checkedIn")}</p>
      )}
    </div>
  );
}
