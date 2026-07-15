import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { QrCode, Search } from "lucide-react";
import { api, BookingCheckIn, BookingLookupResult, BookingResult } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { PageShell } from "../components/Layout";
import { parseCheckInToken } from "../lib/bookingQr";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

type LookupView = {
  booking: BookingResult;
  routeName?: string;
};

function toBookingResult(lookup: BookingLookupResult): BookingResult {
  return {
    id: 0,
    booking_number: lookup.booking_number,
    customer_name: lookup.customer_name,
    phone: lookup.phone,
    email: lookup.email,
    date: lookup.date,
    time: lookup.time,
    vehicle_id: 0,
    route_id: 0,
    fleet_unit_ids: [],
    fleet_unit_numbers: lookup.fleet_unit_numbers,
    bike_count: lookup.bike_count,
    passengers: lookup.passengers,
    booking_mode: lookup.booking_mode,
    group_type: lookup.group_type,
    subtotal: null,
    tax_amount: null,
    total_price: lookup.total_price,
    payment_method: lookup.payment_method,
    payment_status: lookup.payment_status,
    booking_status: lookup.booking_status,
    check_in_token: null,
    check_in_url: lookup.check_in_url,
    checked_in_at: lookup.checked_in_at
  };
}

function fromCheckIn(data: BookingCheckIn, token: string): BookingResult {
  return {
    id: data.booking_id,
    booking_number: data.booking_number,
    customer_name: data.customer_name,
    phone: data.phone,
    email: data.email,
    date: data.date,
    time: data.time,
    vehicle_id: 0,
    route_id: 0,
    fleet_unit_ids: [],
    fleet_unit_numbers: data.fleet_unit_numbers,
    bike_count: data.bike_count,
    passengers: data.passengers,
    booking_mode: data.booking_mode || "group",
    group_type: data.group_type ?? null,
    subtotal: null,
    tax_amount: null,
    total_price: data.total_price,
    payment_method: data.payment_status === "paid" ? "visa" : "bank_transfer",
    payment_status: data.payment_status,
    booking_status: data.booking_status,
    check_in_token: token,
    check_in_url: data.check_in_url,
    checked_in_at: data.checked_in_at
  };
}

export default function BookingLookupPage() {
  const { t, i18n } = useTranslation();
  const [bookingNumber, setBookingNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LookupView | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<unknown> } | null>(null);
  const handlingScanRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      await scannerRef.current?.stop();
    } catch {
      // already stopped
    }
    scannerRef.current = null;
    setCameraActive(false);
  }, []);

  const loadBookingFromToken = useCallback(
    async (rawValue: string) => {
      const token = parseCheckInToken(rawValue);
      if (!token) {
        setScanError(t("lookup.invalidQr"));
        handlingScanRef.current = false;
        return;
      }

      setQrLoading(true);
      setError("");
      setScanError("");
      try {
        const data = await api.getCheckInBooking(token);
        const languageAr = i18n.language.startsWith("ar");
        await stopScanner();
        setScannerOpen(false);
        setResult({
          booking: fromCheckIn(data, token),
          routeName: languageAr
            ? data.route_name_ar || data.route_name_en || undefined
            : data.route_name_en || data.route_name_ar || undefined
        });
      } catch (err) {
        setScanError(err instanceof Error ? err.message : t("lookup.notFound"));
      } finally {
        setQrLoading(false);
        handlingScanRef.current = false;
      }
    },
    [i18n.language, stopScanner, t]
  );

  useEffect(() => {
    if (!scannerOpen || result) {
      void stopScanner();
      return;
    }

    let cancelled = false;
    handlingScanRef.current = false;

    async function startScanner() {
      setScanError("");
      setCameraActive(false);
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode("lookup-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (handlingScanRef.current) return;
            handlingScanRef.current = true;
            void loadBookingFromToken(decodedText);
          },
          () => undefined
        );
        if (!cancelled) setCameraActive(true);
      } catch {
        if (!cancelled) {
          setScanError(t("lookup.cameraError"));
          setCameraActive(false);
        }
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      void stopScanner();
    };
  }, [scannerOpen, result, loadBookingFromToken, stopScanner, t]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    const trimmedNumber = bookingNumber.trim();
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedNumber && !trimmedEmail && !trimmedPhone) {
      setError(t("lookup.fieldRequired"));
      setLoading(false);
      return;
    }

    try {
      const data = await api.lookupBooking({
        booking_number: trimmedNumber || undefined,
        email: trimmedEmail || undefined,
        phone: trimmedPhone || undefined
      });
      const languageAr = i18n.language.startsWith("ar");
      setResult({
        booking: toBookingResult(data),
        routeName: languageAr
          ? data.route_name_ar || data.route_name_en || undefined
          : data.route_name_en || data.route_name_ar || undefined
      });
      setScannerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("lookup.notFound"));
    } finally {
      setLoading(false);
    }
  }

  function searchAgain() {
    setResult(null);
    setError("");
    setScanError("");
    setScannerOpen(false);
  }

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          {!result ? (
            <>
              <div className="mb-10 text-center">
                <Search className="mx-auto text-forest-400" size={56} />
                <h1 className="mt-4 text-4xl font-black md:text-5xl">{t("lookup.title")}</h1>
                <p className="mt-3 text-white/65">{t("lookup.subtitle")}</p>
              </div>

              <div className="glass mb-6 rounded-[2rem] p-6 md:p-8">
                <div className="flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-start gap-4">
                  <div className="rounded-2xl bg-forest-500/15 p-3 text-forest-300">
                    <QrCode size={32} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-black">{t("lookup.scanTitle")}</h2>
                    <p className="mt-1 text-sm text-white/60">{t("lookup.scanSubtitle")}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScanError("");
                      setScannerOpen((open) => !open);
                    }}
                    className="shrink-0 rounded-2xl bg-forest-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-forest-400"
                  >
                    {scannerOpen ? t("lookup.stopScanner") : t("lookup.startScanner")}
                  </button>
                </div>

                {scannerOpen && (
                  <div className="mt-6">
                    <div
                      id="lookup-qr-reader"
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/30"
                    />
                    {qrLoading && (
                      <p className="mt-3 text-center text-sm text-forest-200">{t("lookup.searching")}</p>
                    )}
                    {!cameraActive && scanError && (
                      <p className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{scanError}</p>
                    )}
                    {cameraActive && scanError && (
                      <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{scanError}</p>
                    )}
                    {cameraActive && !scanError && !qrLoading && (
                      <p className="mt-3 text-center text-xs text-white/50">{t("lookup.scanHint")}</p>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={submit} className="glass rounded-[2rem] p-8">
                <p className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
                  {t("lookup.manualSearch")}
                </p>
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("lookup.bookingNumber")}</span>
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder={t("lookup.bookingNumberPlaceholder")}
                      value={bookingNumber}
                      onChange={(event) => setBookingNumber(event.target.value.replace(/\D/g, ""))}
                    />
                  </label>
                  <p className="text-center text-xs text-white/45">{t("lookup.orDivider")}</p>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("booking.email")}</span>
                    <input
                      type="email"
                      className={inputClass}
                      placeholder={t("booking.email")}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <p className="text-center text-xs text-white/45">{t("lookup.orDivider")}</p>
                  <label className="space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("booking.phone")}</span>
                    <input
                      type="tel"
                      className={inputClass}
                      placeholder={t("booking.phone")}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-2 rounded-2xl bg-forest-500 px-6 py-4 font-bold text-white transition hover:bg-forest-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? t("lookup.searching") : t("lookup.search")}
                  </button>
                  {error && <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{error}</p>}
                </div>
              </form>

              <p className="mt-6 text-center text-sm text-white/50">
                {t("lookup.newBooking")}{" "}
                <Link to="/booking" className="font-semibold text-forest-300 hover:text-forest-200">
                  {t("nav.book")}
                </Link>
              </p>
            </>
          ) : (
            <>
              <BookingConfirmationCard
                booking={result.booking}
                routeName={result.routeName}
                onRedirect={searchAgain}
                autoRedirect={false}
                lookupMode
              />
            </>
          )}
        </div>
      </main>
    </PageShell>
  );
}
