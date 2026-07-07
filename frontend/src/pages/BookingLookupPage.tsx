import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { api, BookingLookupResult, BookingResult } from "../api/client";
import { BookingConfirmationCard } from "../components/BookingConfirmationCard";
import { PageShell } from "../components/Layout";

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";

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

export default function BookingLookupPage() {
  const { t, i18n } = useTranslation();
  const [bookingNumber, setBookingNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<BookingLookupResult | null>(null);

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
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("lookup.notFound"));
    } finally {
      setLoading(false);
    }
  }

  function searchAgain() {
    setResult(null);
    setError("");
  }

  const routeName =
    result && i18n.language.startsWith("ar")
      ? result.route_name_ar || result.route_name_en || undefined
      : result?.route_name_en || undefined;

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

              <form onSubmit={submit} className="glass rounded-[2rem] p-8">
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
                booking={toBookingResult(result)}
                routeName={routeName}
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