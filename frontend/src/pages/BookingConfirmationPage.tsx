import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, BookingResult } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { PageShell } from "../components/Layout";
import { clearBookingSession, finalizePaidBookingSession } from "../lib/bookingSession";

const AMWAL_CALLBACK_KEYS = [
  "amount",
  "currencyId",
  "customerId",
  "customerTokenId",
  "merchantId",
  "merchantReference",
  "responseCode",
  "terminalId",
  "transactionId",
  "transactionTime",
  "secureHashValue"
] as const;

function readAmwalCallback(searchParams: URLSearchParams): Record<string, string> | null {
  const data: Record<string, string> = {};
  let found = false;
  for (const key of AMWAL_CALLBACK_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      data[key] = value;
      found = true;
    }
  }
  return found ? data : null;
}

function hasAmwalCallbackParams(searchParams: URLSearchParams): boolean {
  return AMWAL_CALLBACK_KEYS.some((key) => searchParams.has(key));
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
      try {
        const [routeData, currentBooking] = await Promise.all([api.getRoutes(), loadBooking()]);
        if (cancelled) return;
        setRoutes(routeData);
        if (!currentBooking) {
          setBooking(null);
          return;
        }

        let resolvedBooking = currentBooking;
        const callbackData = readAmwalCallback(searchParams);
        if (callbackData && currentBooking.payment_status !== "paid") {
          try {
            const payment = await api.completeAmwalPayment(currentBooking.id, callbackData);
            if (payment.success) {
              resolvedBooking = { ...currentBooking, payment_status: "paid", booking_status: "paid" };
              setPaymentJustCompleted(true);
            }
          } catch (error) {
            if (!cancelled) {
              setPaymentError(error instanceof Error ? error.message : t("booking.paymentFailed"));
            }
          }
        }

        if (!cancelled) {
          setBooking(resolvedBooking);
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
            </div>
          )}

          {!loading && !booking && (
            <div className="glass mx-auto max-w-2xl rounded-[2rem] p-10 text-center">
              <p className="text-red-200">{paymentError || t("booking.passNotFound")}</p>
              <Link to="/" className="mt-6 inline-block font-bold text-forest-300 hover:underline">
                {t("nav.home")}
              </Link>
            </div>
          )}

          {!loading && booking && (
            <BookingConfirmationCard
              booking={booking}
              routeName={routeName}
              onRedirect={handleGoHome}
              paymentError={isPaid ? "" : paymentError}
              paymentJustCompleted={paymentJustCompleted}
              autoRedirect={!isPaid}
            />
          )}
        </div>
      </main>
    </PageShell>
  );
}