import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { XCircle } from "lucide-react";
import { api, BookingResult } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { PageShell } from "../components/Layout";
import {
  hasAmwalCallbackParams,
  normalizeAmwalCallback,
  shouldDismissAfterFailedPayment,
  shouldRetryPaymentCompletion
} from "../lib/amwalCallback";
import {
  clearPaymentCompleting,
  clearBookingSession,
  finalizePaidBookingSession,
  markPaymentCompleting
} from "../lib/bookingSession";
import { shouldDismissFailedVisa } from "../lib/visaBooking";

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function loadPaidBooking(token: string, attempts = 20): Promise<BookingResult | null> {
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

async function tryCompletePayment(
  token: string,
  callbackData: Record<string, string>,
  attempts = 6
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

async function dismissUnpaidVisaIfNeeded(token: string, booking: BookingResult): Promise<boolean> {
  try {
    const result = await api.dismissFailedVisaBooking(token);
    return result.cancelled;
  } catch {
    return false;
  }
}

export default function BookingConfirmationPage() {
  const { token = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [booking, setBooking] = useState<BookingResult | null>(null);
  const [routes, setRoutes] = useState<{ id: number; name_en: string; name_ar: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [paymentError, setPaymentError] = useState("");
  const [bookingCancelled, setBookingCancelled] = useState(false);
  const [paymentJustCompleted, setPaymentJustCompleted] = useState(searchParams.get("payment") === "success");
  const callbackQuery = searchParams.toString();

  const loadBooking = useCallback(async () => {
    if (!token) return null;
    return api.getBookingConfirmation(token);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setPaymentError("");
      setBookingCancelled(false);
      try {
        const routeData = await api.getRoutes();
        if (cancelled) return;
        setRoutes(routeData);

        const callbackData = normalizeAmwalCallback(searchParams);
        let resolvedBooking: BookingResult | null = null;

        if (callbackData) {
          markPaymentCompleting();
          const completed = await tryCompletePayment(token, callbackData);
          resolvedBooking = await loadPaidBooking(token);
          if (!cancelled && resolvedBooking?.payment_status === "paid") {
            setPaymentJustCompleted(true);
            clearPaymentCompleting();
          } else if (!cancelled && shouldRetryPaymentCompletion(callbackData)) {
            clearPaymentCompleting();
            setPaymentError(t("booking.paymentConfirming"));
          } else if (!cancelled && !completed) {
            clearPaymentCompleting();
            setPaymentError(t("booking.visaBookingCancelledMessage"));
          }
        }

        if (!resolvedBooking || resolvedBooking.payment_status !== "paid") {
          const latest = await loadBooking().catch(() => null);
          if (latest?.payment_status === "paid") {
            resolvedBooking = latest;
            if (!cancelled) {
              setPaymentJustCompleted(true);
            }
          } else if (!resolvedBooking) {
            resolvedBooking = latest;
          }
        }

        const canDismiss = shouldDismissAfterFailedPayment(callbackData);
        if (
          resolvedBooking &&
          shouldDismissFailedVisa(resolvedBooking, canDismiss) &&
          !cancelled
        ) {
          await dismissUnpaidVisaIfNeeded(token, resolvedBooking);
          clearBookingSession();
          setBooking(null);
          setBookingCancelled(true);
          return;
        }

        if (!cancelled) {
          setBooking(resolvedBooking?.payment_status === "paid" ? resolvedBooking : null);
          if (resolvedBooking?.payment_status === "paid") {
            setPaymentError("");
          }
        }
      } catch (error) {
        if (!cancelled) {
          setBooking(null);
          setPaymentError(error instanceof Error ? error.message : t("booking.passNotFound"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [token, loadBooking, callbackQuery, t, searchParams]);

  const isPaid = booking?.payment_status === "paid";

  useEffect(() => {
    if (!token || !isPaid) return;

    finalizePaidBookingSession();

    const cleanUrl = `/booking/confirmation/${token}?payment=success`;
    if (hasAmwalCallbackParams(searchParams) || searchParams.get("payment") !== "success") {
      navigate(cleanUrl, { replace: true });
    }
  }, [token, isPaid, navigate, searchParams]);

  useEffect(() => {
    if (!token || !isPaid) return;

    const cleanUrl = `/booking/confirmation/${token}?payment=success`;
    window.history.replaceState({ bookingConfirmed: true }, "", cleanUrl);
    window.history.pushState({ bookingConfirmed: true }, "", cleanUrl);

    const onPopState = () => {
      clearBookingSession();
      navigate("/", { replace: true });
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [token, isPaid, navigate]);

  const routeName = useMemo(() => {
    if (!booking) return undefined;
    const route = routes.find((item) => item.id === booking.route_id);
    if (!route) return undefined;
    return i18n.language.startsWith("ar") ? route.name_ar : route.name_en;
  }, [booking, routes, i18n.language]);

  function handleGoHome() {
    clearBookingSession();
    window.location.href = "/";
  }

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-3xl">
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">{t("nav.book")}</p>
            <h1 className="mt-3 text-5xl font-black">{t("booking.confirmationPageTitle")}</h1>
          </div>

          {loading && (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <p className="text-lg font-bold text-forest-300">{t("availability.loading")}</p>
              <p className="mt-3 text-sm text-white/55">{t("booking.paymentConfirmingHint")}</p>
            </div>
          )}

          {!loading && bookingCancelled && (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <XCircle className="mx-auto text-red-300" size={72} />
              <h2 className="mt-6 text-3xl font-black text-red-100">{t("booking.visaBookingCancelledTitle")}</h2>
              <p className="mt-4 text-white/70">{t("booking.visaBookingCancelledMessage")}</p>
              <p className="mt-3 text-sm text-white/50">{t("booking.visaBookingCancelledHint")}</p>
              <Link
                to="/booking"
                className="mt-8 inline-block rounded-2xl bg-forest-500 px-8 py-4 font-bold text-white shadow-glow transition hover:bg-forest-400"
              >
                {t("nav.book")}
              </Link>
            </div>
          )}

          {!loading && !booking && !bookingCancelled && (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <p className="text-red-200">{paymentError || t("booking.passNotFound")}</p>
              <Link to="/" className="mt-6 inline-block font-bold text-forest-300 hover:underline">
                {t("nav.home")}
              </Link>
            </div>
          )}

          {!loading && booking && isPaid && (
            <BookingConfirmationCard
              booking={booking}
              routeName={routeName}
              onRedirect={handleGoHome}
              paymentError=""
              paymentJustCompleted={paymentJustCompleted}
              autoRedirect={false}
            />
          )}
        </div>
      </main>
    </PageShell>
  );
}