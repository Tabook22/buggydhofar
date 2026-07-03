import { Building2, Smartphone, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { PaymentTransferInfo } from "../api/client";

type Props = {
  info: PaymentTransferInfo;
  open: boolean;
  onClose: () => void;
};

function DetailRow({ label, value, visible }: { label: string; value: string; visible: boolean }) {
  if (!visible || !value.trim()) return null;
  return (
    <div className="rounded-xl bg-white/5 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

export function BankTransferModal({ info, open, onClose }: Props) {
  const { i18n, t } = useTranslation();
  const isAr = i18n.language.startsWith("ar");

  if (!open) return null;

  const title = isAr ? info.transfer_title_ar : info.transfer_title_en;
  const bankName = isAr ? info.transfer_bank_name_ar : info.transfer_bank_name_en;
  const accountName = isAr ? info.transfer_account_name_ar : info.transfer_account_name_en;
  const notes = isAr ? info.transfer_notes_ar : info.transfer_notes_en;

  const bankRows = [
    info.transfer_show_bank_name && bankName.trim(),
    info.transfer_show_account_name && accountName.trim(),
    info.transfer_show_account_number && info.transfer_account_number.trim(),
    info.transfer_show_iban && info.transfer_iban.trim()
  ].filter(Boolean);

  const hasMobile = info.transfer_show_mobile_number && info.transfer_mobile_number.trim();
  const hasBank = bankRows.length > 0;
  const showNotes = info.transfer_show_notes && notes.trim();
  const showTitle = info.transfer_show_title;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-forest-950 p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bank-transfer-title"
      >
        <div className="flex items-start justify-between gap-4">
          {showTitle ? (
            <h2 id="bank-transfer-title" className="text-2xl font-black text-white">
              {title || t("booking.transferModalTitle")}
            </h2>
          ) : (
            <h2 id="bank-transfer-title" className="text-2xl font-black text-white">
              {t("booking.transferModalTitle")}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label={t("booking.transferClose")}
          >
            <X size={20} />
          </button>
        </div>
        <p className="mt-2 text-sm text-white/60">{t("booking.transferModalIntro")}</p>

        {hasBank && (
          <section className="mt-6 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-forest-300">
              <Building2 size={18} />
              {t("booking.transferBankSection")}
            </h3>
            <DetailRow label={t("booking.transferBankName")} value={bankName} visible={info.transfer_show_bank_name} />
            <DetailRow label={t("booking.transferAccountName")} value={accountName} visible={info.transfer_show_account_name} />
            <DetailRow label={t("booking.transferAccountNumber")} value={info.transfer_account_number} visible={info.transfer_show_account_number} />
            <DetailRow label={t("booking.transferIban")} value={info.transfer_iban} visible={info.transfer_show_iban} />
          </section>
        )}

        {hasMobile && (
          <section className="mt-6 space-y-3">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-forest-300">
              <Smartphone size={18} />
              {t("booking.transferMobileSection")}
            </h3>
            <DetailRow label={t("booking.transferMobileNumber")} value={info.transfer_mobile_number} visible={info.transfer_show_mobile_number} />
          </section>
        )}

        {showNotes && (
          <p className="mt-6 rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">{notes}</p>
        )}

        {!hasBank && !hasMobile && !showNotes && (
          <p className="mt-6 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/55">{t("booking.transferNotConfigured")}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-forest-500 px-6 py-3 font-bold text-white hover:bg-forest-400"
        >
          {t("booking.transferClose")}
        </button>
      </div>
    </div>
  );
}
