import { FormEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ADMIN_TOKEN_KEY } from "../api/client";
import { parseCheckInToken } from "../lib/bookingQr";
import { PageShell } from "../components/Layout";

export default function StaffCheckInPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const scannerRef = useRef<{ stop: () => Promise<unknown> } | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [scanError, setScanError] = useState("");
  const [cameraActive, setCameraActive] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(ADMIN_TOKEN_KEY);
    if (!token) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;

    async function startScanner() {
      setScanError("");
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;

        const scanner = new Html5Qrcode("staff-qr-reader");
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const parsed = parseCheckInToken(decodedText);
            if (parsed) {
              scanner.stop().catch(() => undefined);
              navigate(`/admin/verify/${parsed}`);
            }
          },
          () => undefined
        );
        if (!cancelled) setCameraActive(true);
      } catch {
        if (!cancelled) {
          setScanError(t("checkIn.cameraError"));
          setCameraActive(false);
        }
      }
    }

    startScanner();

    return () => {
      cancelled = true;
      scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current = null;
    };
  }, [navigate, t]);

  function submitManual(event: FormEvent) {
    event.preventDefault();
    const parsed = parseCheckInToken(manualToken);
    if (parsed) {
      navigate(`/admin/verify/${parsed}`);
      return;
    }
    setScanError(t("checkIn.invalidCode"));
  }

  return (
    <PageShell>
      <main className="hero-bg px-4 pb-20 pt-32 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="glass rounded-[2rem] p-6 md:p-8">
            <h1 className="text-3xl font-black">{t("checkIn.scannerTitle")}</h1>
            <p className="mt-2 text-sm text-white/60">{t("checkIn.scannerSubtitle")}</p>

            <div id="staff-qr-reader" className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/30" />

            {!cameraActive && scanError && (
              <p className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-100">{scanError}</p>
            )}

            <form onSubmit={submitManual} className="mt-6 space-y-3">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-white/75">{t("checkIn.manualEntry")}</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-forest-400"
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  placeholder={t("checkIn.manualPlaceholder")}
                />
              </label>
              <button type="submit" className="w-full rounded-2xl bg-forest-500 px-6 py-3 font-bold text-white">
                {t("checkIn.lookupBooking")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="mt-4 w-full rounded-2xl border border-white/10 px-6 py-3 font-bold"
            >
              {t("checkIn.backAdmin")}
            </button>
          </div>
        </div>
      </main>
    </PageShell>
  );
}
