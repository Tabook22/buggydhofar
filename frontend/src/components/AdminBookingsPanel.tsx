import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, List, Search, Trash2 } from "lucide-react";
import { api, groupTypeLabel, isAdminAuthError, normalizeGroupType } from "../api/client";
import { qrCodeImageUrl } from "../lib/bookingQr";
import { BookingQrCode } from "./BookingQrCode";

export type AdminBooking = {
  id: number;
  booking_number: string;
  customer_name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  fleet_unit_id?: number | null;
  fleet_unit_ids?: number[];
  fleet_unit_number?: number | null;
  fleet_unit_numbers?: number[];
  bike_count?: number;
  booking_mode?: string;
  group_type?: string | null;
  route_name_en?: string | null;
  passengers: number;
  total_price: number;
  payment_method: string;
  payment_status: string;
  booking_status: string;
  notes?: string | null;
  national_id?: string | null;
  waiver_accepted?: boolean;
  check_in_url?: string | null;
  checked_in_at?: string | null;
  confirmation_email_sent: boolean;
  booking_confirmed: boolean;
  email_count: number;
  created_at: string;
};

type ArchiveDay = { day: number; date: string; count: number };
type ArchiveMonth = { month: number; month_label: string; count: number; days: ArchiveDay[] };
type ArchiveYear = { year: number; count: number; months: ArchiveMonth[] };
type BookingArchive = { total: number; years: ArchiveYear[] };

type EmailLog = {
  id: number;
  email_type: string;
  subject: string;
  body_plain: string;
  delivery_status: string;
  sent_at: string;
};

type BookingWaiver = {
  booking_id: number;
  booking_number: string;
  customer_name: string;
  national_id: string | null;
  waiver_accepted: boolean;
  waiver_accepted_at: string | null;
  waiver_language: string | null;
  waiver_text: string | null;
};

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";
const VIEW_STORAGE_KEY = "admin_bookings_view";
const BOOKINGS_PAGE_SIZE = 20;

type ViewMode = "cards" | "list";

function defaultViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE_KEY);
    if (saved === "cards" || saved === "list") return saved;
  } catch {
    // Ignore storage errors
  }
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches ? "cards" : "list";
}

function displayStatus(status: string) {
  if (status === "confirmed" || status === "completed") return "pending";
  return status;
}

function filterBookings(bookings: AdminBooking[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return bookings;
  const digits = q.replace(/\D/g, "");
  return bookings.filter((booking) => {
    const phoneDigits = booking.phone.replace(/\D/g, "");
    return (
      booking.booking_number.toLowerCase().includes(q) ||
      booking.customer_name.toLowerCase().includes(q) ||
      booking.email.toLowerCase().includes(q) ||
      booking.phone.toLowerCase().includes(q) ||
      (digits.length > 0 && phoneDigits.includes(digits))
    );
  });
}

function archiveQuery(year: number | null, month: number | null, day: number | null) {
  const params = new URLSearchParams();
  if (year) params.set("year", String(year));
  if (month) params.set("month", String(month));
  if (day) params.set("day", String(day));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function AdminBookingsPanel({
  token,
  onAuthFailure,
  embedded = false
}: {
  token: string;
  onAuthFailure: (message?: string) => void;
  embedded?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [archive, setArchive] = useState<BookingArchive | null>(null);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [replyBooking, setReplyBooking] = useState<AdminBooking | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyMessage, setReplyMessage] = useState("");
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [replySending, setReplySending] = useState(false);
  const [emailHistory, setEmailHistory] = useState<EmailLog[]>([]);
  const [waiverBooking, setWaiverBooking] = useState<AdminBooking | null>(null);
  const [waiverData, setWaiverData] = useState<BookingWaiver | null>(null);
  const [waiverLoading, setWaiverLoading] = useState(false);
  const [qrBooking, setQrBooking] = useState<AdminBooking | null>(null);
  const [detailBooking, setDetailBooking] = useState<AdminBooking | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(defaultViewMode);
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFilterOpen, setDateFilterOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBookingIds, setSelectedBookingIds] = useState<number[]>([]);
  const [deletingBookings, setDeletingBookings] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<string | null>(null);

  const loadBookings = useCallback(
    async (year: number | null, month: number | null, day: number | null) => {
      setLoading(true);
      try {
        const [archiveResult, bookingsResult] = await Promise.allSettled([
          api.adminGet<BookingArchive>("/api/admin/bookings/archive", token),
          api.adminGet<AdminBooking[]>(`/api/admin/bookings${archiveQuery(year, month, day)}`, token)
        ]);
        if (archiveResult.status === "fulfilled") {
          setArchive(archiveResult.value);
        }
        if (bookingsResult.status === "fulfilled") {
          setBookings(bookingsResult.value);
        } else {
          setBookings([]);
          const message = bookingsResult.reason instanceof Error ? bookingsResult.reason.message : t("admin.pathSaveError");
          if (isAdminAuthError(message)) onAuthFailure(message);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : t("admin.pathSaveError");
        if (isAdminAuthError(message)) onAuthFailure(message);
      } finally {
        setLoading(false);
      }
    },
    [token, onAuthFailure, t]
  );

  useEffect(() => {
    loadBookings(selectedYear, selectedMonth, selectedDay);
  }, [loadBookings, selectedYear, selectedMonth, selectedDay]);

  useEffect(() => {
    setDetailBooking((current) => {
      if (!current) return null;
      return bookings.find((booking) => booking.id === current.id) ?? current;
    });
  }, [bookings]);

  function bookingLabel(id: number) {
    return bookings.find((booking) => booking.id === id)?.booking_number || String(id);
  }

  function toggleBookingSelection(id: number) {
    setSelectedBookingIds((current) =>
      current.includes(id) ? current.filter((bookingId) => bookingId !== id) : [...current, id]
    );
  }

  function closePanelsForDeleted(ids: number[]) {
    if (detailBooking && ids.includes(detailBooking.id)) setDetailBooking(null);
    if (replyBooking && ids.includes(replyBooking.id)) setReplyBooking(null);
    if (waiverBooking && ids.includes(waiverBooking.id)) setWaiverBooking(null);
    if (qrBooking && ids.includes(qrBooking.id)) setQrBooking(null);
  }

  async function deleteBookings(ids: number[]) {
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length === 0) return;

    const message =
      uniqueIds.length === 1
        ? t("admin.deleteBookingConfirm", { number: bookingLabel(uniqueIds[0]) })
        : t("admin.deleteBookingsConfirm", { count: uniqueIds.length });
    if (!window.confirm(message)) return;

    setDeletingBookings(true);
    setDeleteStatus(null);
    try {
      let deletedCount = uniqueIds.length;
      if (uniqueIds.length === 1) {
        await api.adminSend(`/api/admin/bookings/${uniqueIds[0]}`, token, "DELETE");
      } else {
        const result = await api.adminSend<{ count: number }>("/api/admin/bookings/bulk-delete", token, "POST", {
          ids: uniqueIds
        });
        deletedCount = result?.count ?? uniqueIds.length;
      }
      setDeleteStatus(t("admin.bookingsDeleted", { count: deletedCount }));
      setSelectedBookingIds((current) => current.filter((id) => !uniqueIds.includes(id)));
      closePanelsForDeleted(uniqueIds);
      await loadBookings(selectedYear, selectedMonth, selectedDay);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : t("admin.deleteBookingFailed");
      if (isAdminAuthError(messageText)) onAuthFailure(messageText);
      else setDeleteStatus(messageText);
    } finally {
      setDeletingBookings(false);
    }
  }

  async function updateStatus(id: number, booking_status: string) {
    try {
      await api.adminSend(`/api/admin/bookings/${id}/status`, token, "PATCH", { booking_status });
      await loadBookings(selectedYear, selectedMonth, selectedDay);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) onAuthFailure(message);
    }
  }

  async function openReply(booking: AdminBooking) {
    setReplyBooking(booking);
    setReplySubject(t("admin.replySubjectDefault", { number: booking.booking_number }));
    setReplyMessage("");
    setReplyStatus(null);
    try {
      const logs = await api.adminGet<EmailLog[]>(`/api/admin/bookings/${booking.id}/emails`, token);
      setEmailHistory(logs);
    } catch {
      setEmailHistory([]);
    }
  }

  async function openWaiver(booking: AdminBooking) {
    setWaiverBooking(booking);
    setWaiverData(null);
    setWaiverLoading(true);
    try {
      const data = await api.adminGet<BookingWaiver>(`/api/admin/bookings/${booking.id}/waiver`, token);
      setWaiverData(data);
    } catch {
      setWaiverData(null);
    } finally {
      setWaiverLoading(false);
    }
  }

  async function submitReply(event: FormEvent) {
    event.preventDefault();
    if (!replyBooking) return;
    setReplySending(true);
    setReplyStatus(null);
    try {
      await api.adminSend(`/api/admin/bookings/${replyBooking.id}/reply`, token, "POST", {
        subject: replySubject.trim(),
        message: replyMessage.trim()
      });
      setReplyStatus(t("admin.replySent"));
      await loadBookings(selectedYear, selectedMonth, selectedDay);
      const logs = await api.adminGet<EmailLog[]>(`/api/admin/bookings/${replyBooking.id}/emails`, token);
      setEmailHistory(logs);
    } catch (error) {
      setReplyStatus(error instanceof Error ? error.message : t("admin.replyFailed"));
    } finally {
      setReplySending(false);
    }
  }

  const statuses = ["pending", "paid", "cancelled"];
  const filteredBookings = useMemo(() => filterBookings(bookings, searchQuery), [bookings, searchQuery]);
  const pagination = useMemo(() => {
    const total = filteredBookings.length;
    const totalPages = Math.max(1, Math.ceil(total / BOOKINGS_PAGE_SIZE));
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (safePage - 1) * BOOKINGS_PAGE_SIZE;
    const endIndex = Math.min(startIndex + BOOKINGS_PAGE_SIZE, total);
    return {
      total,
      totalPages,
      safePage,
      startIndex,
      endIndex,
      items: filteredBookings.slice(startIndex, endIndex)
    };
  }, [filteredBookings, currentPage]);

  function toggleSelectAllOnPage() {
    const pageIds = pagination.items.map((booking) => booking.id);
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedBookingIds.includes(id));
    setSelectedBookingIds((current) =>
      allSelected ? current.filter((id) => !pageIds.includes(id)) : [...new Set([...current, ...pageIds])]
    );
  }

  const pageBookingIds = pagination.items.map((booking) => booking.id);
  const allOnPageSelected = pageBookingIds.length > 0 && pageBookingIds.every((id) => selectedBookingIds.includes(id));
  const someOnPageSelected = pageBookingIds.some((id) => selectedBookingIds.includes(id));
  const selectedMonthData = archive?.years.find((y) => y.year === selectedYear)?.months.find((m) => m.month === selectedMonth);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedBookingIds([]);
    setDeleteStatus(null);
  }, [searchQuery, selectedYear, selectedMonth, selectedDay, viewMode]);

  useEffect(() => {
    if (currentPage > pagination.totalPages) {
      setCurrentPage(pagination.totalPages);
    }
  }, [currentPage, pagination.totalPages]);

  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }

  function confirmationBadge(booking: AdminBooking) {
    const isCancelled = booking.booking_status === "cancelled";
    return (
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
          isCancelled
            ? "bg-red-500/20 text-red-300"
            : booking.booking_confirmed
              ? "bg-forest-500/20 text-forest-200"
              : "bg-yellow-500/15 text-yellow-100"
        }`}
      >
        {isCancelled
          ? t("admin.confirmationUncomplete")
          : booking.booking_confirmed
            ? t("admin.confirmationComplete")
            : t("admin.emailPending")}
      </span>
    );
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

  function renderPassengerMeta(booking: AdminBooking) {
    if (booking.booking_mode === "individual") {
      return <span className="block text-xs text-forest-300">{t("booking.modeIndividual")}</span>;
    }
    return (
      <>
        {normalizeGroupType(booking.group_type) ? (
          <span className="block text-xs text-forest-300">
            {groupTypeLabel(normalizeGroupType(booking.group_type), i18n.language)}
          </span>
        ) : null}
        {booking.bike_count && booking.bike_count > 1 ? (
          <span className="block text-xs text-white/45">{t("booking.bikesNeeded", { count: booking.bike_count })}</span>
        ) : null}
      </>
    );
  }

  function renderBuggyLabel(booking: AdminBooking) {
    const bikes =
      (booking.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
        ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
        : `#${booking.fleet_unit_number ?? booking.fleet_unit_id ?? "—"}`) +
      (booking.bike_count && booking.bike_count > 1 ? ` (${booking.bike_count})` : "");
    return booking.route_name_en ? `${bikes} · ${booking.route_name_en}` : bikes;
  }

  function renderBookingActions(booking: AdminBooking, compact = false) {
    const isCancelled = booking.booking_status === "cancelled";
    return (
      <div className={`flex flex-wrap gap-2 ${compact ? "" : "mt-4"}`}>
        {booking.waiver_accepted && (
          <button
            type="button"
            onClick={() => openWaiver(booking)}
            className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85 hover:bg-white/15"
          >
            {t("admin.viewWaiver")}
          </button>
        )}
        <button
          type="button"
          onClick={() => openReply(booking)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
            isCancelled
              ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
              : "bg-forest-500/20 text-forest-200 hover:bg-forest-500/30"
          }`}
        >
          {t("admin.replyEmail")}
        </button>
        <button
          type="button"
          disabled={deletingBookings}
          onClick={() => deleteBookings([booking.id])}
          className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
        >
          <Trash2 size={14} />
          {t("admin.delete")}
        </button>
      </div>
    );
  }

  const dateSidebar = (
    <aside className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{t("admin.browseByDate")}</p>
      <button
        type="button"
        onClick={() => {
          setSelectedYear(null);
          setSelectedMonth(null);
          setSelectedDay(null);
        }}
        className={`mt-3 w-full rounded-xl px-3 py-2 text-start text-sm font-semibold transition ${
          !selectedYear ? "bg-forest-500/25 text-forest-200" : "text-white/70 hover:bg-white/5"
        }`}
      >
        {t("admin.allBookings")} ({archive?.total ?? 0})
      </button>
      <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto">
        {(archive?.years || []).map((year) => (
          <div key={year.year}>
            <button
              type="button"
              onClick={() => {
                setSelectedYear(year.year);
                setSelectedMonth(null);
                setSelectedDay(null);
              }}
              className={`w-full rounded-xl px-3 py-2 text-start text-sm font-bold transition ${
                selectedYear === year.year && !selectedMonth
                  ? "bg-forest-500/25 text-forest-200"
                  : "text-white/80 hover:bg-white/5"
              }`}
            >
              {year.year} ({year.count})
            </button>
            {selectedYear === year.year &&
              year.months.map((month) => (
                <div key={month.month} className="ms-3 mt-1 border-s border-white/10 ps-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedMonth(month.month);
                      setSelectedDay(null);
                    }}
                    className={`w-full rounded-lg px-2 py-1.5 text-start text-xs font-semibold transition ${
                      selectedMonth === month.month && !selectedDay
                        ? "bg-forest-500/20 text-forest-200"
                        : "text-white/65 hover:bg-white/5"
                    }`}
                  >
                    {month.month_label} ({month.count})
                  </button>
                  {selectedMonth === month.month &&
                    month.days.map((day) => (
                      <button
                        key={day.date}
                        type="button"
                        onClick={() => setSelectedDay(day.day)}
                        className={`ms-2 mt-1 block w-[calc(100%-0.5rem)] rounded-lg px-2 py-1 text-start text-xs transition ${
                          selectedDay === day.day
                            ? "bg-forest-500/15 text-forest-200"
                            : "text-white/55 hover:bg-white/5"
                        }`}
                      >
                        {day.date} ({day.count})
                      </button>
                    ))}
                </div>
              ))}
          </div>
        ))}
      </div>
    </aside>
  );

  return (
    <section className={`${embedded ? "" : "mt-8"} rounded-[2rem] bg-white/5 p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black">{t("admin.bookingsArchive")}</h2>
          <p className="mt-1 text-sm text-white/60">{t("admin.bookingsArchiveHelp")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/staff/scan"
            className="rounded-2xl bg-forest-500/20 px-4 py-2 text-sm font-bold text-forest-200 hover:bg-forest-500/30"
          >
            {t("staff.openPortal")}
          </Link>
          <p className="text-sm font-bold text-forest-300">
            {t("admin.archiveTotal", { count: archive?.total ?? 0 })}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[280px_1fr]">
        <div className="xl:hidden">
          <button
            type="button"
            onClick={() => setDateFilterOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-bold text-white/85"
          >
            <span>{t("admin.filterByDate")}</span>
            {dateFilterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          {dateFilterOpen && <div className="mt-3">{dateSidebar}</div>}
        </div>
        <div className="hidden xl:block">{dateSidebar}</div>

        <div>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-white/55">
              {selectedYear && selectedMonth && selectedDay && selectedMonthData
                ? t("admin.showingDay", {
                    date: selectedMonthData.days.find((d) => d.day === selectedDay)?.date || ""
                  })
                : selectedYear && selectedMonth
                  ? t("admin.showingMonth", { year: selectedYear, month: selectedMonthData?.month_label || selectedMonth })
                  : selectedYear
                    ? t("admin.showingYear", { year: selectedYear })
                    : t("admin.showingAll")}
              {!loading && ` · ${t("admin.resultsCount", { count: pagination.total })}`}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {selectedBookingIds.length > 0 && (
                <button
                  type="button"
                  disabled={deletingBookings}
                  onClick={() => deleteBookings(selectedBookingIds)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300/30 bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                  <Trash2 size={14} />
                  {t("admin.deleteSelected")} ({selectedBookingIds.length})
                </button>
              )}
              <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => changeViewMode("cards")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    viewMode === "cards" ? "bg-forest-500/25 text-forest-200" : "text-white/60 hover:text-white"
                  }`}
                >
                  <LayoutGrid size={14} />
                  {t("admin.viewCards")}
                </button>
                <button
                  type="button"
                  onClick={() => changeViewMode("list")}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${
                    viewMode === "list" ? "bg-forest-500/25 text-forest-200" : "text-white/60 hover:text-white"
                  }`}
                >
                  <List size={14} />
                  {t("admin.viewList")}
                </button>
              </div>
            </div>
          </div>

          {deleteStatus && (
            <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-forest-200">{deleteStatus}</p>
          )}

          <label className="relative mt-4 block">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t("admin.searchBookingsPlaceholder")}
              className={`${inputClass} ps-10`}
              aria-label={t("admin.searchBookings")}
            />
          </label>

          {viewMode === "cards" && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading && (
                <div className="col-span-full rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                  {t("availability.loading")}
                </div>
              )}
              {!loading &&
                pagination.items.map((booking) => {
                  const isCancelled = booking.booking_status === "cancelled";
                  return (
                    <div
                      key={booking.id}
                      className={`relative rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-forest-500/35 hover:bg-black/30 ${
                        isCancelled ? "border-red-500/20" : ""
                      } ${selectedBookingIds.includes(booking.id) ? "border-forest-400/40 ring-1 ring-forest-400/25" : ""}`}
                    >
                      <label
                        className="absolute start-3 top-3 z-10 flex items-center"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-forest-500 focus:ring-forest-400"
                          aria-label={t("admin.selectAllOnPage")}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => setDetailBooking(booking)}
                        className="w-full pt-6 text-start"
                      >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-lg font-black tracking-wider text-forest-400">{booking.booking_number}</p>
                          <p className="mt-1 truncate font-semibold text-white">{booking.customer_name}</p>
                          <p className="mt-1 text-xs text-white/50">
                            {booking.date} · {booking.time}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">{statusBadge(booking)}{confirmationBadge(booking)}</div>
                        </div>
                        {booking.check_in_url ? (
                          <img
                            src={qrCodeImageUrl(booking.check_in_url, 72)}
                            alt={t("booking.qrAlt")}
                            className="h-16 w-16 shrink-0 rounded-lg border border-white/10 bg-white p-0.5"
                          />
                        ) : null}
                      </div>
                      <p className="mt-3 text-xs text-white/45">{t("admin.tapForDetails")}</p>
                      </button>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          disabled={deletingBookings}
                          onClick={() => deleteBookings([booking.id])}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          {t("admin.delete")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              {!loading && filteredBookings.length === 0 && (
                <div className="col-span-full rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                  {t("admin.noBookingsInRange")}
                </div>
              )}
            </div>
          )}

          {viewMode === "list" && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="w-10 p-3 text-start">
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = someOnPageSelected && !allOnPageSelected;
                      }}
                      onChange={toggleSelectAllOnPage}
                      className="h-4 w-4 rounded border-white/20 bg-white/10 text-forest-500 focus:ring-forest-400"
                      aria-label={t("admin.selectAllOnPage")}
                    />
                  </th>
                  <th className="p-3 text-start">{t("booking.bookingNumber")}</th>
                  <th className="p-3 text-start">{t("booking.fullName")}</th>
                  <th className="p-3 text-start">{t("booking.email")}</th>
                  <th className="p-3 text-start">{t("booking.phone")}</th>
                  <th className="p-3 text-start">{t("booking.date")}</th>
                  <th className="p-3 text-start">{t("booking.passengers")}</th>
                  <th className="p-3 text-start">{t("booking.buggyBike")}</th>
                  <th className="p-3 text-start">{t("booking.total")}</th>
                  <th className="p-3 text-start">{t("booking.qrTitle")}</th>
                  <th className="p-3 text-start">{t("admin.emailSent")}</th>
                  <th className="p-3 text-start">{t("admin.status")}</th>
                  <th className="p-3 text-start">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={13} className="p-6 text-center text-white/50">
                      {t("availability.loading")}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pagination.items.map((booking) => {
                    const isCancelled = booking.booking_status === "cancelled";
                    return (
                    <tr
                      key={booking.id}
                      className={`border-t border-white/10 ${isCancelled ? "text-red-400" : ""} ${
                        selectedBookingIds.includes(booking.id) ? "bg-forest-500/5" : ""
                      }`}
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.includes(booking.id)}
                          onChange={() => toggleBookingSelection(booking.id)}
                          className="h-4 w-4 rounded border-white/20 bg-white/10 text-forest-500 focus:ring-forest-400"
                          aria-label={booking.booking_number}
                        />
                      </td>
                      <td className="p-3 font-mono font-bold tracking-wider">
                        <span className="inline-flex items-center gap-2">
                          {isCancelled && (
                            <span
                              className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-400"
                              title={t("admin.confirmationUncomplete")}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            </span>
                          )}
                          {booking.booking_number}
                        </span>
                      </td>
                      <td className="p-3">{booking.customer_name}</td>
                      <td className="p-3">{booking.email}</td>
                      <td className="p-3">{booking.phone}</td>
                      <td className="p-3">
                        {booking.date} {booking.time}
                      </td>
                      <td className="p-3">
                        {booking.passengers}
                        {booking.booking_mode === "individual" ? (
                          <span className="block text-xs text-forest-300">{t("booking.modeIndividual")}</span>
                        ) : (
                          <>
                            {normalizeGroupType(booking.group_type) ? (
                              <span className="block text-xs text-forest-300">
                                {groupTypeLabel(normalizeGroupType(booking.group_type), i18n.language)}
                              </span>
                            ) : null}
                            {booking.bike_count && booking.bike_count > 1 ? (
                              <span className="block text-xs text-white/45">
                                {t("booking.bikesNeeded", { count: booking.bike_count })}
                              </span>
                            ) : null}
                          </>
                        )}
                      </td>
                      <td className="p-3">
                        {(booking.fleet_unit_numbers && booking.fleet_unit_numbers.length > 0
                          ? booking.fleet_unit_numbers.map((n) => `#${n}`).join(", ")
                          : `#${booking.fleet_unit_number ?? booking.fleet_unit_id ?? "—"}`) +
                          (booking.bike_count && booking.bike_count > 1 ? ` (${booking.bike_count})` : "")}
                        {booking.route_name_en ? ` · ${booking.route_name_en}` : ""}
                      </td>
                      <td className="p-3">
                        {booking.total_price} {t("booking.omr")}
                      </td>
                      <td className="p-3">
                        {booking.check_in_url ? (
                          <button type="button" onClick={() => setQrBooking(booking)} className="block">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=72x72&data=${encodeURIComponent(booking.check_in_url)}`}
                              alt={t("booking.qrAlt")}
                              className="h-12 w-12 rounded-lg border border-white/10 bg-white p-0.5"
                            />
                          </button>
                        ) : (
                          "—"
                        )}
                        {booking.checked_in_at && (
                          <span className="mt-1 block text-xs font-bold text-forest-300">{t("checkIn.checkedIn")}</span>
                        )}
                      </td>
                      <td className="p-3">{confirmationBadge(booking)}</td>
                      <td className="p-3">
                        <select
                          className={`${inputClass} ${isCancelled ? "border-red-500/30 text-red-400" : ""}`}
                          value={displayStatus(booking.booking_status)}
                          onChange={(event) => updateStatus(booking.id, event.target.value)}
                        >
                          {statuses.map((status) => (
                            <option key={status} value={status}>
                              {t(`admin.${status}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {booking.waiver_accepted && (
                            <button
                              type="button"
                              onClick={() => openWaiver(booking)}
                              className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white/85 hover:bg-white/15"
                            >
                              {t("admin.viewWaiver")}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openReply(booking)}
                            className={`rounded-xl px-3 py-1.5 text-xs font-bold ${
                              isCancelled
                                ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                                : "bg-forest-500/20 text-forest-200 hover:bg-forest-500/30"
                            }`}
                          >
                            {t("admin.replyEmail")}
                          </button>
                          <button
                            type="button"
                            disabled={deletingBookings}
                            onClick={() => deleteBookings([booking.id])}
                            className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            {t("admin.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                {!loading && filteredBookings.length === 0 && (
                  <tr>
                    <td colSpan={13} className="p-8 text-center text-white/50">
                      {t("admin.noBookingsInRange")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          )}

          {!loading && pagination.total > 0 && (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-white/60">
                {t("admin.showingRange", {
                  from: pagination.startIndex + 1,
                  to: pagination.endIndex,
                  total: pagination.total
                })}
              </p>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <p className="text-sm font-semibold text-white/75">
                  {t("admin.pageOf", { page: pagination.safePage, total: pagination.totalPages })}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pagination.safePage <= 1}
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={16} />
                    {t("admin.previousPage")}
                  </button>
                  <button
                    type="button"
                    disabled={pagination.safePage >= pagination.totalPages}
                    onClick={() => setCurrentPage((page) => Math.min(pagination.totalPages, page + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white/85 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {t("admin.nextPage")}
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {detailBooking && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" onClick={() => setDetailBooking(null)}>
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] border border-white/10 bg-forest-950 p-6 shadow-2xl sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-black">{t("admin.bookingDetails")}</h3>
                <p className="mt-2 font-mono text-2xl font-black tracking-wider text-forest-400">{detailBooking.booking_number}</p>
                <p className="mt-1 text-lg font-semibold text-white">{detailBooking.customer_name}</p>
              </div>
              {detailBooking.check_in_url ? (
                <button type="button" onClick={() => setQrBooking(detailBooking)} className="shrink-0">
                  <img
                    src={qrCodeImageUrl(detailBooking.check_in_url, 88)}
                    alt={t("booking.qrAlt")}
                    className="h-20 w-20 rounded-xl border border-white/10 bg-white p-1"
                  />
                </button>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {statusBadge(detailBooking)}
              {confirmationBadge(detailBooking)}
              {detailBooking.checked_in_at && (
                <span className="inline-flex rounded-full bg-forest-500/20 px-2 py-1 text-xs font-bold text-forest-200">
                  {t("checkIn.checkedIn")}
                </span>
              )}
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              {[
                [t("booking.email"), detailBooking.email],
                [t("booking.phone"), detailBooking.phone],
                [t("booking.date"), `${detailBooking.date} ${detailBooking.time}`],
                [t("booking.passengers"), String(detailBooking.passengers)],
                [t("booking.buggyBike"), renderBuggyLabel(detailBooking)],
                [t("booking.total"), `${detailBooking.total_price} ${t("booking.omr")}`],
                [t("booking.payment"), detailBooking.payment_method],
                [t("admin.status"), t(`admin.${displayStatus(detailBooking.booking_status)}`)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-white/5 px-4 py-3">
                  <dt className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</dt>
                  <dd className="mt-1 font-semibold text-white">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-2 text-sm text-white/70">{renderPassengerMeta(detailBooking)}</div>
            {detailBooking.notes ? (
              <p className="mt-4 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/75">
                <span className="font-bold text-white/45">{t("booking.notice")}: </span>
                {detailBooking.notes}
              </p>
            ) : null}

            <label className="mt-6 block space-y-2">
              <span className="text-sm font-semibold text-white/75">{t("admin.status")}</span>
              <select
                className={inputClass}
                value={displayStatus(detailBooking.booking_status)}
                onChange={(event) => updateStatus(detailBooking.id, event.target.value)}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {t(`admin.${status}`)}
                  </option>
                ))}
              </select>
            </label>

            {renderBookingActions(detailBooking)}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={deletingBookings}
                onClick={() => deleteBookings([detailBooking.id])}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-300/30 bg-red-500/15 px-5 py-3 font-bold text-red-200 hover:bg-red-500/25 disabled:opacity-50"
              >
                <Trash2 size={18} />
                {t("admin.deleteBooking")}
              </button>
              <button
                type="button"
                onClick={() => setDetailBooking(null)}
                className="flex-1 rounded-2xl border border-white/10 px-5 py-3 font-bold"
              >
                {t("admin.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {replyBooking && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setReplyBooking(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-forest-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-black">{t("admin.replyEmail")}</h3>
            <p className="mt-2 text-sm text-white/60">
              {t("admin.replyTo")}: {replyBooking.customer_name} &lt;{replyBooking.email}&gt;
            </p>
            <form onSubmit={submitReply} className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/75">{t("admin.emailSubject")}</span>
                <input className={inputClass} value={replySubject} onChange={(event) => setReplySubject(event.target.value)} required />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/75">{t("admin.emailMessage")}</span>
                <textarea
                  className={inputClass}
                  rows={8}
                  value={replyMessage}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  required
                  placeholder={t("admin.emailMessagePlaceholder")}
                />
              </label>
              <p className="text-xs text-white/45">{t("admin.replyFromNote")}</p>
              {replyStatus && <p className="rounded-xl bg-white/10 px-3 py-2 text-sm text-forest-200">{replyStatus}</p>}
              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={replySending}
                  className="rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white disabled:opacity-50"
                >
                  {replySending ? t("admin.sending") : t("admin.sendEmail")}
                </button>
                <button type="button" onClick={() => setReplyBooking(null)} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">
                  {t("admin.close")}
                </button>
              </div>
            </form>
            {emailHistory.length > 0 && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h4 className="font-bold text-white/80">{t("admin.emailHistory")}</h4>
                <ul className="mt-3 space-y-3">
                  {emailHistory.map((log) => (
                    <li key={log.id} className="rounded-xl bg-white/5 p-3 text-xs text-white/70">
                      <p className="font-bold text-white">
                        {log.email_type === "confirmation"
                        ? t("admin.emailTypeConfirmation")
                        : log.email_type === "booking_confirmed"
                          ? t("admin.emailTypeBookingConfirmed")
                          : log.email_type === "booking_cancelled"
                            ? t("admin.emailTypeBookingCancelled")
                            : log.email_type === "admin_expiry_notice"
                          ? t("admin.emailTypeExpiry")
                          : t("admin.emailTypeReply")}{" "}
                      · {log.subject}
                      </p>
                      <p className="mt-1 text-white/45">
                        {new Date(log.sent_at).toLocaleString()} · {log.delivery_status}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {qrBooking && qrBooking.check_in_url && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setQrBooking(null)}>
          <div
            className="w-full max-w-md rounded-[2rem] border border-white/10 bg-forest-950 p-6 text-center shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-black">{t("booking.qrTitle")}</h3>
            <p className="mt-2 font-mono text-2xl font-black tracking-wider text-forest-400">{qrBooking.booking_number}</p>
            <p className="mt-1 text-sm text-white/60">{qrBooking.customer_name}</p>
            <BookingQrCode checkInUrl={qrBooking.check_in_url} size={240} className="mt-6" />
            <a
              href={qrBooking.check_in_url}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-bold text-forest-300 hover:underline"
            >
              {t("checkIn.openBookingPage")}
            </a>
            <button
              type="button"
              onClick={() => setQrBooking(null)}
              className="mt-6 w-full rounded-2xl border border-white/10 px-5 py-3 font-bold"
            >
              {t("admin.close")}
            </button>
          </div>
        </div>
      )}

      {waiverBooking && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4" onClick={() => setWaiverBooking(null)}>
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/10 bg-forest-950 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-2xl font-black">{t("admin.viewWaiver")}</h3>
            <p className="mt-2 text-sm text-white/60">
              {waiverBooking.booking_number} · {waiverBooking.customer_name}
              {waiverBooking.national_id ? ` · ${waiverBooking.national_id}` : ""}
            </p>
            {waiverLoading && <p className="mt-6 text-white/50">{t("availability.loading")}</p>}
            {!waiverLoading && waiverData?.waiver_text && (
              <>
                {waiverData.waiver_accepted_at && (
                  <p className="mt-3 text-xs text-forest-300">
                    {t("admin.waiverSignedAt")}: {new Date(waiverData.waiver_accepted_at).toLocaleString()}
                  </p>
                )}
                <pre
                  dir={waiverData.waiver_language?.startsWith("ar") ? "rtl" : "ltr"}
                  className="mt-4 whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/85"
                >
                  {waiverData.waiver_text}
                </pre>
              </>
            )}
            {!waiverLoading && !waiverData?.waiver_text && (
              <p className="mt-6 text-sm text-white/50">{t("admin.noWaiver")}</p>
            )}
            <button
              type="button"
              onClick={() => setWaiverBooking(null)}
              className="mt-6 rounded-2xl border border-white/10 px-5 py-3 font-bold"
            >
              {t("admin.close")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
