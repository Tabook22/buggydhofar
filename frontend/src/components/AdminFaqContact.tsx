import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { FaqItem } from "../api/client";
import type { SiteContentForm } from "./AdminHomepageContent";

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

type Props = {
  form: SiteContentForm;
  onChange: (form: SiteContentForm) => void;
  canEdit: boolean;
};

function emptyFaqItem(): FaqItem {
  return { q_en: "", q_ar: "", a_en: "", a_ar: "" };
}

export function AdminFaqContact({ form, onChange, canEdit }: Props) {
  const { t } = useTranslation();

  function patch(patch: Partial<SiteContentForm>) {
    onChange({ ...form, ...patch });
  }

  function patchFaqItem(index: number, itemPatch: Partial<FaqItem>) {
    const next = [...(form.faq_items || [])];
    next[index] = { ...next[index], ...itemPatch };
    patch({ faq_items: next });
  }

  function addFaqItem() {
    patch({ faq_items: [...(form.faq_items || []), emptyFaqItem()] });
  }

  function removeFaqItem(index: number) {
    patch({ faq_items: (form.faq_items || []).filter((_, i) => i !== index) });
  }

  const items = form.faq_items?.length ? form.faq_items : [];

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-black">{t("admin.faqContactNumbersTitle")}</h3>
        <p className="mt-1 text-sm text-white/60">{t("admin.faqContactNumbersHelp")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.contactPhone")}</span>
            <input
              className={inputClass}
              placeholder="+968 9XXX XXXX"
              value={form.contact_phone || ""}
              disabled={!canEdit}
              onChange={(event) => patch({ contact_phone: event.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.contactWhatsapp")}</span>
            <input
              className={inputClass}
              placeholder={t("admin.contactWhatsappPlaceholder")}
              value={form.contact_whatsapp || ""}
              disabled={!canEdit}
              onChange={(event) => patch({ contact_whatsapp: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div>
        <h3 className="text-xl font-black">{t("admin.faqPageTitle")}</h3>
        <p className="mt-1 text-sm text-white/60">{t("admin.faqPageHelp")}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.faqTitleEn")}</span>
            <input
              className={inputClass}
              value={form.faq_title_en || ""}
              disabled={!canEdit}
              onChange={(event) => patch({ faq_title_en: event.target.value })}
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.faqTitleAr")}</span>
            <input
              className={inputClass}
              dir="rtl"
              value={form.faq_title_ar || ""}
              disabled={!canEdit}
              onChange={(event) => patch({ faq_title_ar: event.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h4 className="text-lg font-bold">{t("admin.faqItemsTitle")}</h4>
          {canEdit && (
            <button
              type="button"
              onClick={addFaqItem}
              className="inline-flex items-center gap-2 rounded-xl border border-forest-400/40 bg-forest-500/15 px-4 py-2 text-sm font-bold text-forest-200 transition hover:bg-forest-500/25"
            >
              <Plus size={16} />
              {t("admin.faqAddItem")}
            </button>
          )}
        </div>

        {items.length === 0 && <p className="text-sm text-white/55">{t("admin.faqEmpty")}</p>}

        {items.map((item, index) => (
          <div key={`faq-${index}`} className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-bold text-forest-300">{t("admin.faqItemLabel", { index: index + 1 })}</p>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeFaqItem(index)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 transition hover:bg-red-500/20"
                >
                  <Trash2 size={14} />
                  {t("admin.delete")}
                </button>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/65">{t("admin.faqQuestionEn")}</span>
                <input
                  className={inputClass}
                  value={item.q_en}
                  disabled={!canEdit}
                  onChange={(event) => patchFaqItem(index, { q_en: event.target.value })}
                />
              </label>
              <label className="block space-y-2">
                <span className="text-xs font-semibold text-white/65">{t("admin.faqQuestionAr")}</span>
                <input
                  className={inputClass}
                  dir="rtl"
                  value={item.q_ar}
                  disabled={!canEdit}
                  onChange={(event) => patchFaqItem(index, { q_ar: event.target.value })}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/65">{t("admin.faqAnswerEn")}</span>
                <textarea
                  className={inputClass}
                  rows={3}
                  value={item.a_en}
                  disabled={!canEdit}
                  onChange={(event) => patchFaqItem(index, { a_en: event.target.value })}
                />
              </label>
              <label className="block space-y-2 md:col-span-2">
                <span className="text-xs font-semibold text-white/65">{t("admin.faqAnswerAr")}</span>
                <textarea
                  className={inputClass}
                  dir="rtl"
                  rows={3}
                  value={item.a_ar}
                  disabled={!canEdit}
                  onChange={(event) => patchFaqItem(index, { a_ar: event.target.value })}
                />
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}