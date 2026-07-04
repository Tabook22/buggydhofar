import { FormEvent, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCircle2 } from "lucide-react";
import { api, BookingPayload, BookingResult, PaymentTransferInfo, RouteExperience, Vehicle } from "../api/client";
import { BankTransferModal } from "../components/BankTransferModal";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { BookingSelection, BookingSummaryCard, BookingWidget, calculateTotal } from "../components/Booking";
import { LiabilityWaiver } from "../components/LiabilityWaiver";
import { PageShell } from "../components/Layout";
import { defaultTransferSettings } from "../components/AdminTransferSettings";
import { defaultBookingSelection, clearBookingDraft, isBookingSelectionReady, resolveInitialBookingSelection, saveBookingDraft } from "../lib/bookingDraft";

const defaultSelection = defaultBookingSelection;

const inputClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

const emptyTransferInfo: PaymentTransferInfo = { ...defaultTransferSettings };

export default function BookingPage() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteExperience[]>([]);
  const [selection, setSelection] = useState<BookingSelection>(() => resolveInitialBookingSelection(location.state));
  const [confirmed, setConfirmed] = useState(false);
  const [confirmedBooking, setConfirmedBooking] = useState<BookingResult | null>(null);
  const [bookingNumber, setBookingNumber] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("visa");
  const [transferInfo, setTransferInfo] = useState<PaymentTransferInfo>(emptyTransferInfo);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [form, setForm] = useState({
    customer_name: "",
    phone: "",
    email: "",
    national_id: "",
    notes: ""
  });
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  useEffect(() => {
    Promise.all([api.getVehicles(), api.getRoutes(), api.getSiteContent().catch(() => null)]).then(
      ([vehicleData, routeData, content]) => {
      setVehicles(vehicleData);
      setRoutes(routeData);
      if (content) {
        setTransferInfo({
          transfer_title_en: content.transfer_title_en,
          transfer_title_ar: content.transfer_title_ar,
          transfer_bank_name_en: content.transfer_bank_name_en,
          transfer_bank_name_ar: content.transfer_bank_name_ar,
          transfer_account_name_en: content.transfer_account_name_en,
          transfer_account_name_ar: content.transfer_account_name_ar,
          transfer_account_number: content.transfer_account_number,
          transfer_iban: content.transfer_iban,
          transfer_mobile_wallet_en: content.transfer_mobile_wallet_en,
          transfer_mobile_wallet_ar: content.transfer_mobile_wallet_ar,
          transfer_mobile_number: content.transfer_mobile_number,
          transfer_notes_en: content.transfer_notes_en,
          transfer_notes_ar: content.transfer_notes_ar,
          transfer_show_title: content.transfer_show_title ?? true,
          transfer_show_bank_name: content.transfer_show_bank_name ?? true,
          transfer_show_account_name: content.transfer_show_account_name ?? true,
          transfer_show_account_number: content.transfer_show_account_number ?? true,
          transfer_show_iban: content.transfer_show_iban ?? true,
              transfer_show_mobile_wallet: false,
              transfer_show_mobile_number: content.transfer_show_mobile_number ?? true,
          transfer_show_notes: content.transfer_show_notes ?? true
        });
      }
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
  }, [form.customer_name, form.national_id, form.phone, form.email]);

  useEffect(() => {
    if (!waiverAccepted) {
      setShowTransferModal(false);
    }
  }, [waiverAccepted]);

  function finishConfirmation() {
    clearBookingDraft();
    window.location.href = "/";
  }

  const handleConfirmationRedirect = useCallback(() => {
    finishConfirmation();
  }, []);

  async function submitBooking(event: FormEvent) {
    event.preventDefault();
    setSubmitError("");
    if (!isBookingSelectionReady(selection)) {
      setSubmitError(t("booking.unavailable"));
      return;
    }
    if (!waiverAccepted) {
      setSubmitError(t("booking.waiverRequired"));
      return;
    }
    if (!paymentMethod) {
      setSubmitError(t("booking.paymentLocked"));
      return;
    }
    const payload: BookingPayload = {
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
      total_price: calculateTotal(selection),
      payment_method: paymentMethod,
      waiver_accepted: true,
      waiver_language: i18n.language.startsWith("ar") ? "ar" : "en"
    };
    try {
      const result = await api.createBooking(payload);
      setConfirmedBooking(result);
      setBookingNumber(result.booking_number);
      setConfirmed(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : t("availability.loadError"));
    }
  }

  const canChoosePayment = waiverAccepted;

  const canSubmit =
    isBookingSelectionReady(selection) &&
    Boolean(form.customer_name.trim() && form.phone.trim() && form.email.trim() && form.national_id.trim()) &&
    waiverAccepted;

  function selectPaymentMethod(method: string) {
    if (!canChoosePayment) return;
    setPaymentMethod(method);
    if (method === "bank_transfer") {
      setShowTransferModal(true);
    }
  }

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
            />
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
                  <div className={`mt-8 transition ${canChoosePayment ? "" : "opacity-50"}`}>
                    <h3 className="text-xl font-black">{t("booking.payment")}</h3>
                    {!canChoosePayment && (
                      <p className="mt-2 text-sm text-amber-200/80">{t("booking.paymentLocked")}</p>
                    )}
                    <fieldset disabled={!canChoosePayment} className="mt-4 border-0 p-0 disabled:cursor-not-allowed">
                      <div className="grid gap-4 md:grid-cols-2">
                        {[
                          ["visa", t("booking.payVisa")],
                          ["bank_transfer", t("booking.payTransfer")]
                        ].map(([value, label]) => (
                          <label
                            key={value}
                            className={`flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 ${canChoosePayment ? "cursor-pointer" : "cursor-not-allowed"}`}
                          >
                            <input
                              type="radio"
                              checked={paymentMethod === value}
                              disabled={!canChoosePayment}
                              onChange={() => selectPaymentMethod(value)}
                            />
                            <span className="font-semibold">{label}</span>
                          </label>
                        ))}
                      </div>
                      {paymentMethod === "bank_transfer" && (
                        <button
                          type="button"
                          disabled={!canChoosePayment}
                          onClick={() => canChoosePayment && setShowTransferModal(true)}
                          className="mt-3 text-sm font-bold text-forest-300 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
                        >
                          {t("booking.viewTransferDetails")}
                        </button>
                      )}
                    </fieldset>
                  </div>
                  {submitError && <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{submitError}</p>}
                  <button
                    disabled={!canSubmit}
                    className="mt-8 w-full rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {t("booking.submit")}
                  </button>
                </form>
              </div>
              <BookingSummaryCard vehicles={vehicles} routes={routes} selection={selection} showButton={false} />
            </div>
          )}
        </div>
      </main>
      <BankTransferModal info={transferInfo} open={showTransferModal} onClose={() => setShowTransferModal(false)} />
    </PageShell>
  );
}
