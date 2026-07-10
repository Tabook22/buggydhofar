import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, AvailabilityBoard as BoardData, FleetUnitAvailability, SiteContent } from "../api/client";
import { pickSiteText } from "../lib/siteContent";
import { FleetBikeGrid } from "./FleetBikeGrid";
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AvailabilityBoard({ content = null }: { content?: SiteContent | null }) {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === "ar";
  const liveLabel = pickSiteText(content, "availability_live", isAr, t("availability.live"));
  const boardTitle = pickSiteText(content, "availability_title", isAr, t("availability.title"));
  const boardSubtitle = pickSiteText(content, "availability_subtitle", isAr, t("availability.subtitle"));
  const [date, setDate] = useState(todayIso());
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [selectedTime, setSelectedTime] = useState("");
  const [slotUnits, setSlotUnits] = useState<FleetUnitAvailability[]>([]);
  const [slotLoading, setSlotLoading] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getAvailabilityBoard(date)
      .then((data) => {
        if (active) setBoard(data);
      })
      .catch(() => {
        if (active) setBoard(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, tick]);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!selectedTime) {
      setSlotUnits([]);
      return;
    }
    let active = true;
    setSlotLoading(true);
    api
      .getFleetAvailability(date, selectedTime)
      .then((data) => {
        if (active) setSlotUnits(data.units);
      })
      .catch(() => {
        if (active) setSlotUnits([]);
      })
      .finally(() => {
        if (active) setSlotLoading(false);
      });
    return () => {
      active = false;
    };
  }, [date, selectedTime, tick]);

  useEffect(() => {
    if (!board?.slots.length) {
      setSelectedTime("");
      return;
    }
    if (!selectedTime || !board.slots.some((slot) => slot.time === selectedTime)) {
      setSelectedTime(board.slots[0].time);
    }
  }, [board, selectedTime]);
  const updatedLabel = useMemo(() => {
    if (!board?.updated_at) return "";
    const stamp = new Date(board.updated_at);
    return stamp.toLocaleTimeString(i18n.language === "ar" ? "ar-OM" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }, [board?.updated_at, i18n.language]);

  return (
    <section id="availability" className="availability-board mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-forest-400">{liveLabel}</p>
          <h2 className="mt-2 text-3xl font-black md:text-4xl">{boardTitle}</h2>
          <p className="mt-2 max-w-2xl text-white/65">{boardSubtitle}</p>
        </div>
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-white/50">{t("booking.selectDate")}</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-white outline-none focus:border-forest-400"
          />
        </label>
      </div>

      <div className="availability-board-panel mt-8 overflow-hidden rounded-[2rem] border border-forest-400/20 bg-[#071611] shadow-glow">
        <div className="availability-board-header flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-forest-500/10 px-5 py-4">
          <div className="font-mono text-sm text-forest-300">
            {t("availability.totalFleet")}: <span className="text-2xl font-black text-white">{board?.total_bikes ?? "—"}</span>
          </div>
          <div className="font-mono text-xs text-white/45">
            {loading ? t("availability.updating") : t("availability.updatedAt", { time: updatedLabel })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse font-mono text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.2em] text-white/45">
                <th className="px-5 py-4">{t("booking.time")}</th>
                <th className="px-5 py-4">{t("availability.available")}</th>
                <th className="px-5 py-4">{t("availability.booked")}</th>
                <th className="px-5 py-4">{t("availability.status")}</th>
              </tr>
            </thead>
            <tbody>
              {(board?.slots || []).map((slot) => {
                const full = slot.available === 0;
                const low = slot.available > 0 && slot.available <= 3;
                const isSelected = selectedTime === slot.time;
                return (
                  <tr
                    key={slot.time}
                    className={`cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03] ${isSelected ? "bg-forest-500/10" : ""}`}
                    onClick={() => setSelectedTime(slot.time)}
                  >                    <td className="px-5 py-4 text-lg font-black text-white">{slot.time}</td>
                    <td className={`px-5 py-4 text-2xl font-black ${full ? "text-red-300" : low ? "text-yellow-300" : "text-forest-400"}`}>
                      {loading ? "…" : slot.available}
                    </td>
                    <td className="px-5 py-4 text-lg text-white/70">{loading ? "…" : slot.booked}</td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${
                          full ? "bg-red-500/20 text-red-200" : low ? "bg-yellow-500/20 text-yellow-100" : "bg-forest-500/20 text-forest-200"
                        }`}
                      >
                        {full ? t("availability.full") : low ? t("availability.limited") : t("availability.open")}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {!loading && (!board || board.slots.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-white/50">
                    {t("availability.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedTime && (
          <div className="border-t border-white/10 px-5 py-5">
            <p className="mb-4 text-sm font-bold text-white/75">
              {t("availability.fleetAtTime", { time: selectedTime })}
            </p>
            <FleetBikeGrid units={slotUnits} loading={slotLoading} readOnly />
          </div>
        )}
      </div>    </section>
  );
}
