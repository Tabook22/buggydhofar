import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Download, ExternalLink } from "lucide-react";
import { buildPublicBookingUrl, qrCodeImageUrl } from "../lib/bookingQr";

export function AdminBookingLinkQr({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const bookingUrl = useMemo(() => buildPublicBookingUrl(), []);
  const qrPreviewUrl = useMemo(() => qrCodeImageUrl(bookingUrl, 280), [bookingUrl]);
  const qrDownloadUrl = useMemo(() => qrCodeImageUrl(bookingUrl, 512), [bookingUrl]);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className={`${embedded ? "" : "mt-8"} rounded-[2rem] bg-white/5 p-6`}>
      <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
        <div>
          <h2 className="text-2xl font-black">{t("admin.bookingQrTitle")}</h2>
          <p className="mt-2 max-w-2xl text-sm text-white/60">{t("admin.bookingQrSubtitle")}</p>

          <label className="mt-6 block space-y-2">
            <span className="text-xs font-bold uppercase tracking-wide text-white/45">{t("admin.bookingQrUrl")}</span>
            <div className="flex flex-wrap gap-2">
              <input
                readOnly
                value={bookingUrl}
                className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/85"
              />
              <button
                type="button"
                onClick={copyLink}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15"
              >
                <Copy size={16} />
                {copied ? t("admin.linkCopied") : t("admin.copyLink")}
              </button>
            </div>
          </label>

          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-forest-500/20 px-4 py-2 text-sm font-bold text-forest-200 hover:bg-forest-500/30"
            >
              <ExternalLink size={16} />
              {t("admin.openBookingPage")}
            </a>
            <a
              href={qrDownloadUrl}
              download="buggydhofar-booking-qr.png"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm font-bold hover:bg-white/5"
            >
              <Download size={16} />
              {t("admin.downloadQr")}
            </a>
          </div>
        </div>

        <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white p-4">
          <img src={qrPreviewUrl} alt={t("admin.bookingQrTitle")} width={280} height={280} className="h-[280px] w-[280px]" />
          <p className="mt-3 text-center text-xs text-gray-600">{t("admin.bookingQrScanHint")}</p>
        </div>
      </div>
    </section>
  );
}
