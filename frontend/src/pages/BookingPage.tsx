import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { api, BookingPayload, BookingResult, RouteExperience, Vehicle } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { BookingSelection, BookingSummaryCard, BookingWidget, calculateTotal } from "../components/Booking";
import { LiabilityWaiver } from "../components/LiabilityWaiver";
import { PageShell } from "../components/Layout";
import { defaultBookingSelection, clearBookingDraft, isBookingSelectionReady, resolveInitialBookingSelection, saveBookingDraft } from "../lib/bookingDraft";
import { openAmwalSmartBox } from "../lib/amwalSmartBox";

const defaultSelection = defaultBookingSelection;

const inputClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

const ONLINE_PAYMENT_METHOD = "visa";

export default function BookingPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteExperience[]>([]);
  const [selection, setSelection] = useState<BookingSelection>(() => resolveInitialBookingSelection(location.state));
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResult | null>(null);
  const [bookingNumber, setBookingNumber] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    national_id: "",
    notes: ""
  });
  const [waiverAccepted, setWaiverAccepted] = useState(false);
  const [payingOnline, setPayingOnline] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [pendingVisaBooking, setPendingVisaBooking] = useState<BookingResult | null>(null);

  useEffect(() => {
    Promise.all([api.getVehicles(), api.getRoutes()]).then(([vehicleData, routeData]) => {
      setVehicles(vehicleData);
      setRoutes(routeData);
      const buggy = vehicleData.find((vehicle) => vehicle.type === "buggy" && vehicle.seats === 2) || vehicleData.find((vehicle) => vehicle.type === "buggy");
      setSelection((current) => ({
        ...current,
        vehicleId: buggy?.id || vehicleData[0]?.id || 0,
        routeId: routeData[0]?.id || 0
      }));
    });
  }, []);

  useEffect(() => {
    saveBookingDraft(selection);
  }, [selection]);

  useEffect(() => {
    setWaiverAccepted(false);
    setPendingVisaBooking(null);
  }, [form.customer_name, form.national_id, form.phone, form.email]);

  function finishConfirmation() {
    clearBookingDraft();
    window.location.href = "/";
  }

  function goToConfirmation(booking: BookingResult, paymentSuccess = false) {
    clearBookingDraft();
    setPendingVisaBooking(null);
    if (booking.check_in_token) {
      const suffix = paymentSuccess ? "?payment=success" : "";
      navigate(`/booking/confirmation/${booking.check_in_token}${suffix}`, { replace: true });
      return;
    }
    setConfirmedBooking(booking);
    setConfirmed(true);
  }

  const handleConfirmationRedirect = useCallback(() => {
    finishConfirmation();
  }, []);

  async function startOnlinePayment(booking: BookingResult) {
    setPayingOnline(true);
    setPaymentError("");
    setPendingVisaBooking(booking);
    try {
      const config = await api.initAmwalPayment(booking.id, i18n.language.startsWith("ar") ? "ar" : "en");
      await openAmwalSmartBox(config, {
        onComplete: async (data) => {
          try {
            const payment = await api.completeAmwalPayment(booking.id, data);
            if (payment.success) {
              goToConfirmation({ ...booking, payment_status: "paid", booking_status: "paid" }, true);
            } else {
              setPaymentError(t("booking.paymentFailed"));
            }
          } catch (error) {
            setPaymentError(error instanceof Error ? error.message : t("booking.paymentFailed"));
          } finally {
            setPayingOnline(false);
          }
        },
        onError: () => {
          setPaymentError(t("booking.paymentFailed"));
          setPayingOnline(false);
        },
        onCancel: () => {
          setPaymentError(t("booking.paymentCancelled"));
          setPayingOnline(false);
        }
      });
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : t("booking.paymentUnavailable"));
      setPayingOnline(false);
    }
  }

  const retryOnlinePayment = useCallback(async () => {
    if (!confirmedBooking || confirmedBooking.payment_method !== "visa" || payingOnline) return;
    await startOnlinePayment(confirmedBooking);
  }, [confirmedBooking, payingOnline, i18n.language, t]);

  function buildBookingPayload(): BookingPayload {
    return {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      national_id: form.national_id.trim(),
      nationality: "Guest",
      hotel_location: "",
      notes: form.notes.trim() || undefined,
      date: selection.date,
      time: selection.time,
      vehicle_id: selection.vehicleId,
      route_id: selection.routeId,
      fleet_unit_ids: selection.fleetUnitIds,
      passengers: selection.passengers,
      booking_mode: selection.bookingMode,
      group_type: selection.bookingMode === "group" ? selection.groupType || null : null,
      total_price: calculateTotal(selection),
      payment_method: ONLINE_PAYMENT_METHOD,
      waiver_accepted: true,
      waiver_language: i18n.language.startsWith("ar") ? "ar" : "en"
    };
  }

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    setPaymentError("");
    if (!isBookingSelectionReady(selection)) {
      setSubmitError(t("booking.unavailable"));
      return;
    }
    if (!waiverAccepted) {
      setSubmitError(t("booking.waiverRequired"));
      return;
    }
    if (pendingVisaBooking) {
      await startOnlinePayment(pendingVisaBooking);
      return;
    }
    const payload = buildBookingPayload();
    try {
      const result = await api.createBooking(payload);
      setBookingNumber(result.booking_number);
      await startOnlinePayment(result);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("availability.loadError"));
    }
  }

  const canSubmit =
    isBookingSelectionReady(selection) &&
    Boolean(form.customer_name.trim() && form.phone.trim() && form.email.trim() && form.national_id.trim()) &&
    waiverAccepted;

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">{t("nav.book")}</p>
            <h1 className="mt-3 text-5xl font-black">{t("booking.quickTitle")}</h1>
          </div>
          {confirmed && confirmedBooking ? (
            <BookingConfirmationCard
              booking={confirmedBooking}
              routeName={
                routes.find((route) => route.id === confirmedBooking.route_id)?.[
                  i18n.language.startsWith("ar") ? "name_ar" : "name_en"
                ]
              }
              onRedirect={handleConfirmationRedirect}
              onPayOnline={confirmedBooking.payment_method === "visa" && confirmedBooking.payment_status !== "paid" ? retryOnlinePayment : undefined}
              payingOnline={payingOnline}
              paymentError={paymentError}
              autoRedirect={confirmedBooking.payment_status !== "paid"}
            />
          ) : payingOnline ? (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <p className="text-lg font-bold text-forest-300">{t("booking.paymentProcessing")}</p>
              <p className="mt-3 text-sm text-white/60">{t("booking.paymentProcessingHint")}</p>
            </div>
          ) : confirmed ? (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <CheckCircle2 className="mx-auto text-forest-400" size={72} />
              <h2 className="mt-6 text-3xl font-black">{t("booking.confirmed")}</h2>
              {bookingNumber && (
                <p className="mt-4 text-4xl font-black tracking-[0.2em] text-forest-400">{bookingNumber}</p>
              )}
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <div className="space-y-8">
                <BookingWidget vehicles={vehicles} routes={routes} selection={selection} onChange={setSelection} />
                <form onSubmit={submitBooking} className="glass rounded-[2rem] p-6 md:p-8">
                  <h2 className="text-3xl font-black">{t("booking.customer")}</h2>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("booking.fullName")}</span>
                      <input required type="text" className={inputClass} value={form.customer_name} onChange={(event) => setForm({ ...form, customer_name: event.target.value })} />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("booking.phone")}</span>
                      <input required type="tel" className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-white/75">{t("booking.email")}</span>
                      <input required type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-white/75">{t("booking.nationalId")}</span>
                      <input
                        required
                        type="text"
                        className={inputClass}
                        value={form.national_id}
                        onChange={(event) => setForm({ ...form, national_id: event.target.value })}
                        placeholder={t("booking.nationalIdPlaceholder")}
                      />
                    </label>
                    <label className="space-y-2 md:col-span-2">
                      <span className="text-sm font-semibold text-white/75">{t("booking.notice")}</span>
                      <textarea className={inputClass} rows={4} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={t("booking.noticeOptional")} />
                    </label>
                  </div>
                  <LiabilityWaiver
                    customerName={form.customer_name}
                    nationalId={form.national_id}
                    phone={form.phone}
                    email={form.email}
                    rideDate={selection.date && selection.time ? `${selection.date} ${selection.time}` : ""}
                    accepted={waiverAccepted}
                    onAcceptedChange={setWaiverAccepted}
                  />
                  {submitError && <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{submitError}</p>}
                  {paymentError && (
                    <div className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">
                      <p>{paymentError}</p>
                      {pendingVisaBooking && (
                        <p className="mt-2 text-white/70">
                          {t("booking.paymentRetryHint", { number: pendingVisaBooking.booking_number })}
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    disabled={!canSubmit || payingOnline}
                    className="mt-8 w-full rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {payingOnline
                      ? t("booking.paymentProcessing")
                      : pendingVisaBooking
                        ? t("booking.retryPayment")
                        : t("booking.submitAndPay")}
                  </button>
                </form>
              </div>
              <BookingSummaryCard vehicles={vehicles} routes={routes} selection={selection} showButton={false} />
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}
