import { useTranslation } from "react-i18next";
import { qrCodeImageUrl } from "../lib/bookingQr";

type BookingQrCodeProps = {
  checkInUrl: string;
  size?: number;
  className?: string;
  hintKey?: string;
};

export function BookingQrCode({ checkInUrl, size = 220, className = "", hintKey = "booking.qrHint" }: BookingQrCodeProps) {
  const { t } = useTranslation();
  if (!checkInUrl) return null;

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <img
        src={qrCodeImageUrl(checkInUrl, size)}
        alt={t("booking.qrAlt")}
        width={size}
        height={size}
        className="rounded-2xl border border-white/10 bg-white p-2"
      />
      <p className="mt-3 max-w-xs text-center text-xs text-white/50">{t(hintKey)}</p>
    </div>
  );
}
