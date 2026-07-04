import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { api, BookingCheckIn, STAFF_TOKEN_KEY, clearStaffToken } from "../api/client";

export default function StaffVerifyBookingPage() {
  const { token = "" } = useParams();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const staffToken = localStorage.getItem(STAFF_TOKEN_KEY) || "";
  const [booking, setBooking] = useState<BookingCheckIn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  const loadBooking = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getCheckInBooking(token);
      setBooking(data);
    } catch (err) {
      setBooking(null);
      setError(err instanceof Error ? err.message : t("checkIn.notFound"));
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  async function confirmCheckIn() {
    if (!staffToken || !token) return;
    setConfirming(true);
    setConfirmMessage("");
    try {
      const data = await api.staffCheckIn(token, staffToken);
      setBooking(data);
      setConfirmMessage(t("checkIn.confirmedSuccess"));
    } catch (err) {
      setConfirmMessage(err instanceof Error ? err.message : t("checkIn.confirmFailed"));
    } finally {
      setConfirming(false);
    }
  }

  function logout() {
    clearStaffToken();
    navigate("/staff/login", { replace: true });
  }

  const routeName =
    booking && i18n.language.startsWith("ar")
      ? booking.route_name_ar || booking.route_name_en
      : booking?.route_name_en;

  const bikesLabel =
    booking?.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
      ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
      : "—";

  return (
    <main className="min-h-screen bg-forest-950 p-4 text-white lg:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="text-center sm:text-start">
            <ShieldCheck className="mx-auto text-forest-400 sm:mx-0" size={56} />
            <h1 className="mt-4 text-3xl font-black">{t("admin.verifyBookingTitle")}</h1>
            <p className="mt-2 text-sm text-white/60">{t("admin.verifyBookingSubtitle")}</p>
          </div>
          <button type="button" onClick={logout} className="shrink-0 rounded-full border border-white/10 px-4 py-2 text-sm font-bold">
            {t("staff.logout")}
          </button>
        </div>

        {loading && <p className="rounded-[2rem] bg-white/5 p-8 text-center text-white/50">{t("availability.loading")}</p>}

        {!loading && error && (
          <div className="rounded-[2rem] bg-white/5 p-8 text-center">
            <p className="text-red-200">{error}</p>
            <button type="button" onClick={() => navigate("/staff/scan")} className="mt-6 rounded-2xl border border-white/10 px-5 py-3 font-bold">
              {t("checkIn.openScanner")}
            </button>
          </div>
        )}

        {!loading && booking && (
          <div className="rounded-[2rem] bg-white/5 p-8">
            {booking.checked_in_at ? (
              <div className="mb-6 flex items-center gap-3 rounded-2xl bg-forest-500/15 px-4 py-3 text-forest-200">
                <CheckCircle2 size={22} />
                <span className="font-bold">{t("checkIn.alreadyCheckedIn")}</span>
                <span className="text-sm text-white/60">{new Date(booking.checked_in_at).toLocaleString()}</span>
              </div>
            ) : null}

            <p className="text-center text-4xl font-black tracking-[0.2em] text-forest-400">{booking.booking_number}</p>

            <dl className="mt-6 space-y-3 text-sm">
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
                [t("admin.status"), booking.booking_status]
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 border-b border-white/5 pb-2">
                  <dt className="text-white/55">{label}</dt>
                  <dd className="text-end font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                disabled={confirming || booking.booking_status === "cancelled" || Boolean(booking.checked_in_at)}
                onClick={confirmCheckIn}
                className="w-full rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirming ? t("checkIn.confirming") : t("checkIn.confirmArrival")}
              </button>
              {confirmMessage && <p className="text-center text-sm text-forest-200">{confirmMessage}</p>}
              <button
                type="button"
                onClick={() => navigate("/staff/scan")}
                className="w-full rounded-2xl border border-white/10 px-6 py-3 font-bold"
              >
                {t("checkIn.openScanner")}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
