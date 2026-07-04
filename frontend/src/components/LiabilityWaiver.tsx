import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildLiabilityWaiverText } from "../lib/liabilityWaiver";

type LiabilityWaiverProps = {
  customerName: string;
  nationalId: string;
  phone: string;
  email: string;
  rideDate: string;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
};

export function LiabilityWaiver({
  customerName,
  nationalId,
  phone,
  email,
  rideDate,
  accepted,
  onAcceptedChange
}: LiabilityWaiverProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.language.startsWith("ar") ? "ar" : "en";

  const waiverText = useMemo(
    () =>
      buildLiabilityWaiverText(
        { customerName, nationalId, phone, email, rideDate },
        language
      ),
    [customerName, nationalId, phone, email, rideDate, language]
  );

  const canAccept = Boolean(customerName.trim() && nationalId.trim() && phone.trim() && email.trim());

  return (
    <section className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-5 md:p-6">
      <h3 className="text-xl font-black">{t("booking.waiverTitle")}</h3>
      <p className="mt-2 text-sm text-white/60">{t("booking.waiverIntro")}</p>
      <div
        dir={language === "ar" ? "rtl" : "ltr"}
        className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm leading-relaxed text-white/85 whitespace-pre-wrap"
      >
        {waiverText}
      </div>
      <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${canAccept ? "border-white/10 bg-white/5 hover:bg-white/10" : "cursor-not-allowed border-white/5 bg-white/[0.02] opacity-60"}`}>
        <input
          type="checkbox"
          className="mt-1 h-5 w-5 shrink-0 accent-forest-400"
          checked={accepted}
          disabled={!canAccept}
          onChange={(event) => onAcceptedChange(event.target.checked)}
        />
        <span className="text-sm font-semibold leading-relaxed text-white/90">{t("booking.waiverAgree")}</span>
      </label>
      {!canAccept && (
        <p className="mt-2 text-xs text-amber-200/80">{t("booking.waiverFillDetails")}</p>
      )}
      {canAccept && !accepted && (
        <p className="mt-2 text-xs text-white/50">{t("booking.waiverRequired")}</p>
      )}
    </section>
  );
}
