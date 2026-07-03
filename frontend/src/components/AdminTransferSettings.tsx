import { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

export type TransferSettingsForm = {
  transfer_title_en: string;
  transfer_title_ar: string;
  transfer_bank_name_en: string;
  transfer_bank_name_ar: string;
  transfer_account_name_en: string;
  transfer_account_name_ar: string;
  transfer_account_number: string;
  transfer_iban: string;
  transfer_mobile_wallet_en: string;
  transfer_mobile_wallet_ar: string;
  transfer_mobile_number: string;
  transfer_notes_en: string;
  transfer_notes_ar: string;
  transfer_show_title: boolean;
  transfer_show_bank_name: boolean;
  transfer_show_account_name: boolean;
  transfer_show_account_number: boolean;
  transfer_show_iban: boolean;
  transfer_show_mobile_wallet: boolean;
  transfer_show_mobile_number: boolean;
  transfer_show_notes: boolean;
};

type ShowKey = keyof Pick<
  TransferSettingsForm,
  | "transfer_show_title"
  | "transfer_show_bank_name"
  | "transfer_show_account_name"
  | "transfer_show_account_number"
  | "transfer_show_iban"
  | "transfer_show_mobile_wallet"
  | "transfer_show_mobile_number"
  | "transfer_show_notes"
>;

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

function FieldBlock({
  label,
  show,
  onShowChange,
  children
}: {
  label: string;
  show: boolean;
  onShowChange: (value: boolean) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className={`rounded-2xl border p-4 transition ${show ? "border-white/10 bg-black/20" : "border-white/5 bg-black/10 opacity-75"}`}>
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-forest-200">
        <input type="checkbox" checked={show} onChange={(event) => onShowChange(event.target.checked)} className="h-4 w-4 rounded" />
        <span>{t("admin.transferShowField")}</span>
        <span className="font-semibold text-white/70">— {label}</span>
      </label>
      <div className={show ? "" : "pointer-events-none opacity-50"}>{children}</div>
    </div>
  );
}

export function AdminTransferSettings({
  form,
  onChange,
  onSave,
  message
}: {
  form: TransferSettingsForm;
  onChange: (next: TransferSettingsForm) => void;
  onSave: (event: FormEvent, form: TransferSettingsForm) => Promise<void>;
  message?: { type: "success" | "error"; text: string } | null;
}) {
  const { t } = useTranslation();

  function patch(values: Partial<TransferSettingsForm>) {
    onChange({ ...form, ...values });
  }

  function setShow(key: ShowKey, value: boolean) {
    patch({ [key]: value });
  }

  function toggleBankSection(show: boolean) {
    patch({
      transfer_show_bank_name: show,
      transfer_show_account_name: show,
      transfer_show_account_number: show,
      transfer_show_iban: show
    });
  }

  function toggleMobileSection(show: boolean) {
    patch({ transfer_show_mobile_number: show, transfer_show_mobile_wallet: false });
  }

  const bankSectionOn =
    form.transfer_show_bank_name ||
    form.transfer_show_account_name ||
    form.transfer_show_account_number ||
    form.transfer_show_iban;
  const mobileSectionOn = form.transfer_show_mobile_number;

  return (
    <section className="mt-8 rounded-[2rem] bg-white/5 p-6">
      <div>
        <h2 className="text-2xl font-black">{t("admin.transferSettingsTitle")}</h2>
        <p className="mt-2 text-sm text-white/60">{t("admin.transferSettingsHelp")}</p>
      </div>
      <form onSubmit={(event) => onSave(event, form)} className="mt-6 space-y-4">
        {message && (
          <p
            className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
              message.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"
            }`}
          >
            {message.text}
          </p>
        )}
        <FieldBlock
          label={t("admin.transferTitleEn")}
          show={form.transfer_show_title}
          onShowChange={(value) => setShow("transfer_show_title", value)}
        >
          <div className="grid gap-3 lg:grid-cols-2">
            <input className={inputClass} placeholder={t("admin.transferTitleEn")} value={form.transfer_title_en} onChange={(event) => patch({ transfer_title_en: event.target.value })} />
            <input className={inputClass} placeholder={t("admin.transferTitleAr")} value={form.transfer_title_ar} onChange={(event) => patch({ transfer_title_ar: event.target.value })} />
          </div>
        </FieldBlock>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-forest-300">{t("admin.transferBankSection")}</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-white/75">
            <input type="checkbox" checked={bankSectionOn} onChange={(event) => toggleBankSection(event.target.checked)} className="h-4 w-4 rounded" />
            {t("admin.transferShowSection")}
          </label>
        </div>

        <FieldBlock label={t("admin.transferBankNameEn")} show={form.transfer_show_bank_name} onShowChange={(value) => setShow("transfer_show_bank_name", value)}>
          <div className="grid gap-3 lg:grid-cols-2">
            <input className={inputClass} placeholder={t("admin.transferBankNameEn")} value={form.transfer_bank_name_en} onChange={(event) => patch({ transfer_bank_name_en: event.target.value })} />
            <input className={inputClass} placeholder={t("admin.transferBankNameAr")} value={form.transfer_bank_name_ar} onChange={(event) => patch({ transfer_bank_name_ar: event.target.value })} />
          </div>
        </FieldBlock>

        <FieldBlock label={t("admin.transferAccountNameEn")} show={form.transfer_show_account_name} onShowChange={(value) => setShow("transfer_show_account_name", value)}>
          <div className="grid gap-3 lg:grid-cols-2">
            <input className={inputClass} placeholder={t("admin.transferAccountNameEn")} value={form.transfer_account_name_en} onChange={(event) => patch({ transfer_account_name_en: event.target.value })} />
            <input className={inputClass} placeholder={t("admin.transferAccountNameAr")} value={form.transfer_account_name_ar} onChange={(event) => patch({ transfer_account_name_ar: event.target.value })} />
          </div>
        </FieldBlock>

        <FieldBlock label={t("admin.transferAccountNumber")} show={form.transfer_show_account_number} onShowChange={(value) => setShow("transfer_show_account_number", value)}>
          <input className={inputClass} placeholder={t("admin.transferAccountNumber")} value={form.transfer_account_number} onChange={(event) => patch({ transfer_account_number: event.target.value })} />
        </FieldBlock>

        <FieldBlock label={t("admin.transferIban")} show={form.transfer_show_iban} onShowChange={(value) => setShow("transfer_show_iban", value)}>
          <input className={inputClass} placeholder={t("admin.transferIban")} value={form.transfer_iban} onChange={(event) => patch({ transfer_iban: event.target.value })} />
        </FieldBlock>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
          <p className="text-xs font-bold uppercase tracking-wide text-forest-300">{t("admin.transferMobileSection")}</p>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-white/75">
            <input type="checkbox" checked={mobileSectionOn} onChange={(event) => toggleMobileSection(event.target.checked)} className="h-4 w-4 rounded" />
            {t("admin.transferShowSection")}
          </label>
        </div>

        <FieldBlock label={t("admin.transferMobileNumber")} show={form.transfer_show_mobile_number} onShowChange={(value) => setShow("transfer_show_mobile_number", value)}>
          <input className={inputClass} placeholder={t("admin.transferMobileNumber")} value={form.transfer_mobile_number} onChange={(event) => patch({ transfer_mobile_number: event.target.value })} />
        </FieldBlock>

        <FieldBlock label={t("admin.transferNotesEn")} show={form.transfer_show_notes} onShowChange={(value) => setShow("transfer_show_notes", value)}>
          <div className="grid gap-3 lg:grid-cols-2">
            <textarea className={inputClass} rows={3} placeholder={t("admin.transferNotesEn")} value={form.transfer_notes_en} onChange={(event) => patch({ transfer_notes_en: event.target.value })} />
            <textarea className={inputClass} rows={3} placeholder={t("admin.transferNotesAr")} value={form.transfer_notes_ar} onChange={(event) => patch({ transfer_notes_ar: event.target.value })} />
          </div>
        </FieldBlock>

        <button type="submit" className="w-fit rounded-2xl bg-forest-500 px-6 py-3 font-bold text-white">
          {t("admin.transferSave")}
        </button>
      </form>
    </section>
  );
}

export const defaultTransferSettings: TransferSettingsForm = {
  transfer_title_en: "",
  transfer_title_ar: "",
  transfer_bank_name_en: "",
  transfer_bank_name_ar: "",
  transfer_account_name_en: "",
  transfer_account_name_ar: "",
  transfer_account_number: "",
  transfer_iban: "",
  transfer_mobile_wallet_en: "",
  transfer_mobile_wallet_ar: "",
  transfer_mobile_number: "",
  transfer_notes_en: "",
  transfer_notes_ar: "",
  transfer_show_title: true,
  transfer_show_bank_name: true,
  transfer_show_account_name: true,
  transfer_show_account_number: true,
  transfer_show_iban: true,
  transfer_show_mobile_wallet: false,
  transfer_show_mobile_number: true,
  transfer_show_notes: true
};
