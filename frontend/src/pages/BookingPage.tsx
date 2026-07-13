import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { api, BookingPayload, BookingResult, PromoValidateResult, RouteExperience, Vehicle } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { BookingSelection, BookingSummaryCard, BookingWidget, calculateTotal } from "../components/Booking";
import { LiabilityWaiver } from "../components/LiabilityWaiver";
import { PageShell } from "../components/Layout";
import { defaultBookingSelection, clearBookingDraft, isBookingSelectionReady, resolveInitialBookingSelection, saveBookingDraft } from "../lib/bookingDraft";
import {
  clearBookingSession,
  clearPaymentCompleting,
  clearPendingVisaBooking,
  finalizePaidBookingSession,
  isPaymentCompleting,
  loadPendingVisaBooking,
  markPaymentCompleting,
  savePendingVisaBooking,
  shouldBlockBookingPage
} from "../lib/bookingSession";
import { hasSuccessfulAmwalCallback, normalizeAmwalCallback } from "../lib/amwalCallback";
import { openAmwalSmartBox } from "../lib/amwalSmartBox";
import { buildConfirmationPath, loadPaidBooking } from "../lib/visaPayment";

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
  const [openingCardPayment, setOpeningCardPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [pendingVisaBooking, setPendingVisaBooking] = useState<BookingResult | null>(() => loadPendingVisaBooking());
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoValidateResult | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoApplying, setPromoApplying] = useState(false);

  useEffect(() => {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isBackNavigation = nav?.type === "back_forward";

    if (isBackNavigation && shouldBlockBookingPage()) {
      clearBookingSession();
      navigate("/", { replace: true });
      return;
    }

    if (!isBackNavigation && shouldBlockBookingPage()) {
      clearBookingSession();
    }
  }, [navigate]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !shouldBlockBookingPage()) return;
      clearBookingSession();
      navigate("/", { replace: true });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [navigate]);

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
    setAppliedPromo(null);
    setPromoError("");
  }, [selection]);

  useEffect(() => {
    setWaiverAccepted(false);
    setPendingVisaBooking(null);
    clearPendingVisaBooking();
  }, [form.customer_name, form.national_id, form.phone, form.email]);

  function finishConfirmation() {
    clearBookingDraft();
    window.location.href = "/";
  }

  async function goToConfirmation(
    booking: BookingResult,
    paymentSuccess = false,
    callbackData: Record<string, string> | null = null
  ) {
    setPaymentError("");
    setPayingOnline(false);
    setPendingVisaBooking(null);
    if (paymentSuccess) {
      finalizePaidBookingSession();
    } else {
      clearBookingDraft();
    }

    let resolved = booking;
    if (booking.check_in_token && (paymentSuccess || callbackData?.transactionId)) {
      const paid = await loadPaidBooking(booking.check_in_token, paymentSuccess ? 20 : 12);
      if (paid) {
        resolved = paid;
        paymentSuccess = true;
        finalizePaidBookingSession();
      }
    }

    if (resolved.check_in_token) {
      navigate(
        buildConfirmationPath(resolved.check_in_token, {
          paymentSuccess: paymentSuccess || resolved.payment_status === "paid",
          callbackData
        }),
        { replace: true }
      );
      return;
    }

    setConfirmedBooking(resolved.payment_status === "paid" ? resolved : booking);
    setConfirmed(true);
  }

  const handleConfirmationRedirect = useCallback(() => {
    finishConfirmation();
  }, []);

  async function abandonUnpaidBooking(booking: BookingResult | null, force = false) {
    if (!force && isPaymentCompleting()) return;
    if (!booking?.id || !booking.check_in_token) return;
    try {
      await api.abandonAmwalPayment(booking.id, booking.check_in_token, force);
    } catch {
      // Best-effort cleanup; stale holds expire on the server.
    }
    setPendingVisaBooking(null);
    clearPendingVisaBooking();
  }

  function buildAmwalCallbacks(booking: BookingResult) {
    return {
      onComplete: async (data: Record<string, unknown>) => {
        markPaymentCompleting();
        const callbackData = normalizeAmwalCallback(data);
        try {
          const payment = await api.completeAmwalPayment(
            booking.id,
            callbackData ?? data,
            booking.check_in_token ?? undefined
          );
          if (payment.success) {
            const paidBooking = payment.booking ?? {
              ...booking,
              payment_status: "paid",
              booking_status: "paid"
            };
            await goToConfirmation(paidBooking, true, callbackData);
          } else if (callbackData && hasSuccessfulAmwalCallback(callbackData)) {
            await goToConfirmation(booking, false, callbackData);
          } else {
            clearPaymentCompleting();
            await abandonUnpaidBooking(booking, true);
            setPaymentError(t("booking.visaBookingCancelledMessage"));
          }
        } catch {
          if (callbackData && hasSuccessfulAmwalCallback(callbackData)) {
            await goToConfirmation(booking, false, callbackData);
          } else if (callbackData?.transactionId) {
            await goToConfirmation(booking, false, callbackData);
          } else {
            clearPaymentCompleting();
            await abandonUnpaidBooking(booking, true);
            setPaymentError(t("booking.visaBookingCancelledMessage"));
          }
        } finally {
          setPayingOnline(false);
          setOpeningCardPayment(false);
        }
      },
      onError: async () => {
        // AMWAL redirect after a successful charge triggers errorCallback — keep the booking.
        setOpeningCardPayment(false);
      },
      onCancel: async () => {
        clearPaymentCompleting();
        setPaymentError(t("booking.paymentCancelled"));
        setPayingOnline(false);
        setOpeningCardPayment(false);
      }
    };
  }

  async function startOnlinePayment(booking: BookingResult) {
    setPayingOnline(true);
    setPaymentError("");
    setPendingVisaBooking(booking);
    savePendingVisaBooking(booking);
    markPaymentCompleting();
    setOpeningCardPayment(false);
    await openCardPayment(booking);
  }

  async function openCardPayment(booking: BookingResult) {
    setOpeningCardPayment(true);
    setPaymentError("");
    try {
      const config = await api.initAmwalPayment(booking.id, i18n.language.startsWith("ar") ? "ar" : "en");
      await openAmwalSmartBox(config, buildAmwalCallbacks(booking));
      setOpeningCardPayment(false);
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : t("booking.paymentUnavailable"));
      setOpeningCardPayment(false);
    }
  }

  async function applyPromoCode() {
    const code = promoInput.trim();
    if (!code) {
      setAppliedPromo(null);
      setPromoError("");
      return;
    }
    if (!isBookingSelectionReady(selection)) {
      setPromoError(t("booking.unavailable"));
      return;
    }
    setPromoApplying(true);
    setPromoError("");
    try {
      const result = await api.validatePromoCode({
        code,
        passengers: selection.passengers,
        booking_mode: selection.bookingMode
      });
      if (!result.valid) {
        setAppliedPromo(null);
        setPromoError(result.message || t("booking.promoInvalid"));
        return;
      }
      setAppliedPromo(result);
      setPromoInput(result.code);
    } catch (error) {
      setAppliedPromo(null);
      setPromoError(error instanceof Error ? error.message : t("booking.promoInvalid"));
    } finally {
      setPromoApplying(false);
    }
  }

  function clearPromoCode() {
    setPromoInput("");
    setAppliedPromo(null);
    setPromoError("");
  }

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
      total_price: appliedPromo?.valid ? appliedPromo.total_price : calculateTotal(selection),
      promo_code: appliedPromo?.valid ? appliedPromo.code : undefined,
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
              autoRedirect={false}
            />
          ) : payingOnline ? (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <p className="text-lg font-bold text-forest-300">
                {openingCardPayment ? t("booking.openingPayment") : t("booking.paymentProcessing")}
              </p>
              <p className="mt-3 text-sm text-white/60">{t("booking.paymentWindowHint")}</p>
              {pendingVisaBooking && (
                <p className="mt-2 text-sm text-white/50">
                  {t("booking.paymentBookingRef", { number: pendingVisaBooking.booking_number })}
                </p>
              )}
              {paymentError && (
                <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{paymentError}</p>
              )}
              {pendingVisaBooking && !openingCardPayment && (
                <button
                  type="button"
                  onClick={() => openCardPayment(pendingVisaBooking)}
                  className="mt-8 w-full max-w-sm rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400"
                >
                  {t("booking.openPaymentWindow")}
                </button>
              )}
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
                  <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <h3 className="text-lg font-bold">{t("booking.promoTitle")}</h3>
                    <p className="mt-1 text-sm text-white/55">{t("booking.promoHint")}</p>
                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        className={inputClass}
                        value={promoInput}
                        onChange={(event) => setPromoInput(event.target.value.toUpperCase())}
                        placeholder={t("booking.promoPlaceholder")}
                        aria-label={t("booking.promoTitle")}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={promoApplying || !promoInput.trim()}
                          onClick={applyPromoCode}
                          className="rounded-2xl bg-forest-500/20 px-5 py-3 text-sm font-bold text-forest-200 hover:bg-forest-500/30 disabled:opacity-50"
                        >
                          {promoApplying ? t("booking.promoApplying") : t("booking.promoApply")}
                        </button>
                        {appliedPromo?.valid && (
                          <button
                            type="button"
                            onClick={clearPromoCode}
                            className="rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold"
                          >
                            {t("booking.promoRemove")}
                          </button>
                        )}
                      </div>
                    </div>
                    {appliedPromo?.valid && (
                      <p className="mt-3 text-sm font-semibold text-forest-300">{t("booking.promoApplied", { code: appliedPromo.code })}</p>
                    )}
                    {promoError && <p className="mt-3 text-sm text-red-300">{promoError}</p>}
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
              <BookingSummaryCard
                vehicles={vehicles}
                routes={routes}
                selection={selection}
                showButton={false}
                appliedPromo={
                  appliedPromo?.valid
                    ? {
                        code: appliedPromo.code,
                        subtotal: appliedPromo.subtotal,
                        discount_amount: appliedPromo.discount_amount,
                        tax: appliedPromo.tax_amount,
                        total: appliedPromo.total_price
                      }
                    : null
                }
              />
            </div>
          )}
        </div>
      </main>
    </PageShell>
  );
}
