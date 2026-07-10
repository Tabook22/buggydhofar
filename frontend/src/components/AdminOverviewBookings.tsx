import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDays, ChevronDown, ChevronUp } from "lucide-react";
import { api, groupTypeLabel, isAdminAuthError, normalizeGroupType } from "../api/client";
import { AdminSession, can } from "../lib/adminPermissions";
import { qrCodeImageUrl } from "../lib/bookingQr";
import type { AdminBooking } from "./AdminBookingsPanel";

type ArchiveDay = { day: number; date: string; count: number };
type ArchiveMonth = { month: number; month_label: string; count: number; days: ArchiveDay[] };
type ArchiveYear = { year: number; count: number; months: ArchiveMonth[] };
type BookingArchive = { total: number; years: ArchiveYear[] };

type DayEntry = ArchiveDay & { year: number; month: number };

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

function archiveQuery(year: number, month: number, day: number) {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
    day: String(day)
  });
  return `?${params.toString()}`;
}

function flattenArchiveDays(archive: BookingArchive | null): DayEntry[] {
  if (!archive) return [];
  const days: DayEntry[] = [];
  for (const year of archive.years) {
    for (const month of year.months) {
      for (const day of month.days) {
        days.push({ ...day, year: year.year, month: month.month });
      }
    }
  }
  return days.sort((a, b) => b.date.localeCompare(a.date));
}

function dayKey(entry: DayEntry) {
  return `${entry.year}-${entry.month}-${entry.day}`;
}

function displayStatus(status: string) {
  if (status === "confirmed" || status === "completed") return "pending";
  return status;
}

function formatDayLabel(date: string, language: string) {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(language === "ar" ? "ar-OM" : "en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

type Props = {
  token: string;
  adminSession: AdminSession | null;
  onAuthFailure: (message?: string) => void;
};

export function AdminOverviewBookings({ token, adminSession, onAuthFailure }: Props) {
  const { t, i18n } = useTranslation();
  const canEditBookings = can(adminSession, "bookings", "edit");
  const [archive, setArchive] = useState<BookingArchive | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loadingArchive, setLoadingArchive] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [daysOpen, setDaysOpen] = useState(false);

  const dayEntries = useMemo(() => flattenArchiveDays(archive), [archive]);
  const selectedDay = useMemo(
    () => dayEntries.find((entry) => dayKey(entry) === selectedDayKey) ?? null,
    [dayEntries, selectedDayKey]
  );

  const loadArchive = useCallback(async () => {
    setLoadingArchive(true);
    try {
      const archiveResult = await api.adminGet<BookingArchive>("/api/admin/bookings/archive", token);
      setArchive(archiveResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) onAuthFailure(message);
      setArchive(null);
    } finally {
      setLoadingArchive(false);
    }
  }, [token, onAuthFailure, t]);

  const loadDayBookings = useCallback(
    async (entry: DayEntry) => {
      setLoadingBookings(true);
      try {
        const bookingsResult = await api.adminGet<AdminBooking[]>(
          `/api/admin/bookings${archiveQuery(entry.year, entry.month, entry.day)}`,
          token
        );
        setBookings(bookingsResult);
      } catch (error) {
        const message = error instanceof Error ? error.message : t("admin.pathSaveError");
        if (isAdminAuthError(message)) onAuthFailure(message);
        setBookings([]);
      } finally {
        setLoadingBookings(false);
      }
    },
    [token, onAuthFailure, t]
  );

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  useEffect(() => {
    if (dayEntries.length === 0) {
      setSelectedDayKey(null);
      setBookings([]);
      return;
    }
    if (!selectedDayKey || !dayEntries.some((entry) => dayKey(entry) === selectedDayKey)) {
      setSelectedDayKey(dayKey(dayEntries[0]));
    }
  }, [dayEntries, selectedDayKey]);

  useEffect(() => {
    if (!selectedDay) return;
    loadDayBookings(selectedDay);
  }, [selectedDay, loadDayBookings]);

  async function updateStatus(id: number, booking_status: string) {
    if (!canEditBookings || !selectedDay) return;
    try {
      await api.adminSend(`/api/admin/bookings/${id}/status`, token, "PATCH", { booking_status });
      await loadDayBookings(selectedDay);
      await loadArchive();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) onAuthFailure(message);
    }
  }

  function statusBadge(booking: AdminBooking) {
    const status = displayStatus(booking.booking_status);
    const tone =
      status === "paid"
        ? "bg-forest-500/20 text-forest-200"
        : status === "cancelled"
          ? "bg-red-500/20 text-red-300"
          : "bg-yellow-500/15 text-yellow-100";
    return (
      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${tone}`}>{t(`admin.${status}`)}</span>
    );
  }

  const statuses = ["pending", "paid", "cancelled"];

  const daySidebar = (
    <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{t("admin.overviewDaysTitle")}</p>
      <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
        {loadingArchive && (
          <p className="rounded-xl px-3 py-2 text-sm text-white/50">{t("availability.loading")}</p>
        )}
        {!loadingArchive && dayEntries.length === 0 && (
          <p className="rounded-xl px-3 py-2 text-sm text-white/50">{t("admin.overviewNoDays")}</p>
        )}
        {dayEntries.map((entry) => {
          const active = selectedDayKey === dayKey(entry);
          return (
            <button
              key={dayKey(entry)}
              type="button"
              onClick={() => {
                setSelectedDayKey(dayKey(entry));
                setDaysOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm transition ${
                active ? "bg-forest-500/25 text-forest-100" : "text-white/75 hover:bg-white/5"
              }`}
            >
              <span className="min-w-0">
                <span className="block font-bold">{formatDayLabel(entry.date, i18n.language)}</span>
                <span className="block text-xs text-white/45">{entry.date}</span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                  active ? "bg-forest-500/30 text-forest-100" : "bg-white/10 text-white/70"
                }`}
              >
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );

  return (
    <section className="mt-6 rounded-[2rem] bg-white/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <CalendarDays size={24} className="text-forest-300" />
            {t("admin.overviewBookingsTitle")}
          </h2>
          <p className="mt-2 text-sm text-white/60">{t("admin.overviewBookingsHelp")}</p>
        </div>
        <p className="text-sm font-bold text-forest-300">
          {t("admin.overviewDaysCount", { count: dayEntries.length })}
        </p>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[300px_1fr]">
        <div className="xl:hidden">
          <button
            type="button"
            onClick={() => setDaysOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white/85"
          >
            <span>
              {selectedDay
                ? formatDayLabel(selectedDay.date, i18n.language)
                : t("admin.overviewSelectDay")}
            </span>
            {daysOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {daysOpen && <div className="mt-3">{daySidebar}</div>}
        </div>
        <div className="hidden xl:block">{daySidebar}</div>

        <div>
          <p className="text-sm text-white/55">
            {selectedDay
              ? t("admin.showingDay", { date: selectedDay.date })
              : t("admin.overviewSelectDay")}
            {!loadingBookings && selectedDay ? ` · ${t("admin.resultsCount", { count: bookings.length })}` : ""}
          </p>

          <div className="mt-4 space-y-3">
            {loadingBookings && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                {t("availability.loading")}
              </div>
            )}
            {!loadingBookings &&
              bookings.map((booking) => {
                const isCancelled = booking.booking_status === "cancelled";
                return (
                  <div
                    key={booking.id}
                    className={`rounded-2xl border border-white/10 bg-black/20 p-4 ${
                      isCancelled ? "border-red-500/20" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-mono text-lg font-black tracking-wider text-forest-400">
                          {booking.booking_number}
                        </p>
                        <p className="mt-1 font-semibold text-white">{booking.customer_name}</p>
                        <p className="mt-1 text-sm text-white/55">
                          {booking.time} · {booking.phone}
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {(booking.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
                            ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
                            : `#${booking.fleet_unit_number ?? booking.fleet_unit_id ?? "—"}`) +
                            (booking.bike_count && booking.bike_count > 1 ? ` (${booking.bike_count})` : "")}
                          {booking.route_name_en ? ` · ${booking.route_name_en}` : ""}
                        </p>
                        {booking.booking_mode === "individual" ? (
                          <span className="mt-1 block text-xs text-forest-300">{t("booking.modeIndividual")}</span>
                        ) : normalizeGroupType(booking.group_type) ? (
                          <span className="mt-1 block text-xs text-forest-300">
                            {groupTypeLabel(normalizeGroupType(booking.group_type), i18n.language)}
                          </span>
                        ) : null}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {canEditBookings ? (
                            <select
                              className={`${inputClass} w-auto min-w-[8rem] text-sm ${
                                isCancelled ? "border-red-500/30 text-red-400" : ""
                              }`}
                              value={displayStatus(booking.booking_status)}
                              onChange={(event) => updateStatus(booking.id, event.target.value)}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {t(`admin.${status}`)}
                                </option>
                              ))}
                            </select>
                          ) : (
                            statusBadge(booking)
                          )}
                          <span className="text-sm font-bold text-forest-300">
                            {booking.total_price} {t("booking.omr")}
                          </span>
                        </div>
                      </div>
                      {booking.check_in_url ? (
                        <img
                          src={qrCodeImageUrl(booking.check_in_url, 72)}
                          alt={t("booking.qrAlt")}
                          className="h-16 w-16 shrink-0 rounded-lg border border-white/10 bg-white p-0.5"
                        />
                      ) : null}
                    </div>
                  </div>
                );
              })}
            {!loadingBookings && selectedDay && bookings.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                {t("admin.noBookingsInRange")}
              </div>
            )}
            {!loadingBookings && !selectedDay && (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                {t("admin.overviewSelectDay")}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}