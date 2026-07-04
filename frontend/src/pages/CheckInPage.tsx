import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, Ticket } from "lucide-react";
import { api, BookingCheckIn } from "../api/client";
import { BookingQrCode } from "../components/BookingQrCode";
import { PageShell } from "../components/Layout";

function customerStatusLabel(status: string, t: (key: string) => string) {
  if (status === "paid") return t("booking.statusConfirmed");
  if (status === "cancelled") return t("booking.statusCancelled");
  return t("booking.statusPending");
}

export default function CheckInPage() {
  const { token = "" } = useParams();
  const { t, i18n } = useTranslation();
  const [booking, setBooking] = useState<BookingCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api.getCheckInBooking(token);
      setBooking(data);
    } catch (err) {
      setBooking(null);
      setError(err instanceof Error ? err.message : t("booking.passNotFound"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    if (token) loadBooking();
  }, [token, loadBooking]);

  const routeName =
    booking && i18n.language.startsWith("ar")
      ? booking.route_name_ar || booking.route_name_en
      : booking?.route_name_en;

  const bikesLabel =
    booking?.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
      ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
      : "—";

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <Ticket className="mx-auto text-forest-400" size={56} />
            <h1 className="mt-4 text-4xl font-black">{t("booking.passTitle")}</h1>
            <p className="mt-2 text-white/60">{t("booking.passSubtitle")}</p>
          </div>

          {loading && <p className="glass rounded-[2rem] p-8 text-center text-white/50">{t("availability.loading")}</p>}

          {!loading && error && (
            <div className="glass rounded-[2rem] p-8 text-center">
              <p className="text-red-200">{error}</p>
              <Link to="/" className="mt-6 inline-block font-bold text-forest-300 hover:underline">
                {t("checkIn.backHome")}
              </Link>
            </div>
          )}

          {!loading && booking && (
            <div className="glass rounded-[2rem] p-8">
              {booking.checked_in_at ? (
                <div className="mb-6 flex items-center gap-3 rounded-2xl bg-forest-500/15 px-4 py-3 text-forest-200">
                  <CheckCircle2 size={22} />
                  <span className="font-bold">{t("booking.passWelcome")}</span>
                </div>
              ) : (
                <p className="mb-6 text-center text-sm text-white/60">{t("booking.passArrivalHint")}</p>
              )}

              <p className="text-center text-4xl font-black tracking-[0.2em] text-forest-400">{booking.booking_number}</p>

              <dl className="mt-6 space-y-3 text-sm">
                {[
                  [t("booking.fullName"), booking.customer_name],
                  [t("booking.date"), booking.date],
                  [t("booking.time"), booking.time],
                  [t("booking.route"), routeName || "—"],
                  [t("booking.passengers"), String(booking.passengers)],
                  [t("booking.buggyBike"), bikesLabel],
                  [t("booking.total"), `${booking.total_price} ${t("booking.omr")}`],
                  [t("booking.bookingStatus"), customerStatusLabel(booking.booking_status, t)]
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                    <dt className="text-white/55">{label}</dt>
                    <dd className="text-end font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-8 flex justify-center">
                <BookingQrCode checkInUrl={booking.check_in_url} size={180} hintKey="booking.passQrHint" />
              </div>
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}
