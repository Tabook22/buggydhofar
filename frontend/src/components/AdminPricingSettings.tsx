import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, DEFAULT_PUBLIC_PRICING, isAdminAuthError, PublicPricing } from "../api/client";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

type PricingForm = {
  price_1_incl_vat: string;
  price_2_incl_vat: string;
  vat_percent: string;
};

function toForm(data: PublicPricing): PricingForm {
  return {
    price_1_incl_vat: String(data.price_1_incl_vat),
    price_2_incl_vat: String(data.price_2_incl_vat),
    vat_percent: String(data.vat_percent)
  };
}

function breakdown(inclusiveRaw: string, vatRaw: string) {
  const inclusive = Number(inclusiveRaw);
  const vatPercent = Number(vatRaw);
  if (!Number.isFinite(inclusive) || !Number.isFinite(vatPercent) || inclusive <= 0 || vatPercent < 0) {
    return null;
  }
  const preVat = vatPercent <= 0 ? Math.round(inclusive * 100) / 100 : Math.round((inclusive / (1 + vatPercent / 100)) * 100) / 100;
  const vatAmount = Math.round((inclusive - preVat) * 100) / 100;
  return { preVat, vatAmount, inclusive: Math.round(inclusive * 100) / 100 };
}

export function AdminPricingSettings({
  token,
  onAuthFailure,
  embedded = false
}: {
  token: string;
  onAuthFailure: (message?: string) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PricingForm>(toForm(DEFAULT_PUBLIC_PRICING));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadPricing = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGet<PublicPricing>("/api/admin/pricing", token);
      setForm(toForm(data));
      setMessage(null);
    } catch (error) {
      const text = error instanceof Error ? error.message : t("admin.pricingLoadFailed");
      if (isAdminAuthError(text)) {
        onAuthFailure(text);
        return;
      }
      setMessage({ type: "error", text });
    } finally {
      setLoading(false);
    }
  }, [token, onAuthFailure, t]);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  const onePerson = useMemo(() => breakdown(form.price_1_incl_vat, form.vat_percent), [form.price_1_incl_vat, form.vat_percent]);
  const twoPerson = useMemo(() => breakdown(form.price_2_incl_vat, form.vat_percent), [form.price_2_incl_vat, form.vat_percent]);

  async function savePricing(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        price_1_incl_vat: Number(form.price_1_incl_vat),
        price_2_incl_vat: Number(form.price_2_incl_vat),
        vat_percent: Number(form.vat_percent)
      };
      const saved = await api.adminSend<PublicPricing>("/api/admin/pricing", token, "PUT", payload);
      setForm(toForm(saved));
      setMessage({ type: "success", text: t("admin.pricingSaved") });
    } catch (error) {
      const text = error instanceof Error ? error.message : t("admin.pricingSaveFailed");
      if (isAdminAuthError(text)) {
        onAuthFailure(text);
        return;
      }
      setMessage({ type: "error", text });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={embedded ? "mt-6 rounded-[2rem] bg-white/5 p-6" : "rounded-[2rem] bg-white/5 p-6"}>
      <h2 className="text-2xl font-black">{t("admin.pricingTitle")}</h2>
      <p className="mt-2 max-w-3xl text-sm text-white/60">{t("admin.pricingSubtitle")}</p>
      {message && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${message.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"}`}>
          {message.text}
        </p>
      )}
      {loading ? (
        <p className="mt-6 text-white/50">{t("admin.pricingLoading")}</p>
      ) : (
        <form onSubmit={savePricing} className="mt-6 space-y-5">
          <label className="block max-w-xs">
            <span className="mb-2 block text-sm font-bold text-forest-200">{t("admin.pricingVatPercent")}</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={form.vat_percent}
              onChange={(event) => setForm({ ...form, vat_percent: event.target.value })}
              required
            />
          </label>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-black">{t("admin.pricingOnePerson")}</h3>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-forest-200">{t("admin.pricingInclVat")}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0.5}
                  step="0.01"
                  value={form.price_1_incl_vat}
                  onChange={(event) => setForm({ ...form, price_1_incl_vat: event.target.value })}
                  required
                />
              </label>
              {onePerson && (
                <dl className="mt-4 space-y-2 text-sm text-white/70">
                  <div className="flex justify-between gap-3">
                    <dt>{t("admin.pricingBeforeVat")}</dt>
                    <dd className="font-semibold text-white">{onePerson.preVat.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{t("admin.pricingVatAmount")}</dt>
                    <dd className="font-semibold text-white">{onePerson.vatAmount.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                    <dt>{t("admin.pricingCustomerPays")}</dt>
                    <dd className="font-black text-forest-300">{onePerson.inclusive.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                </dl>
              )}
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
              <h3 className="text-lg font-black">{t("admin.pricingTwoPerson")}</h3>
              <label className="mt-4 block">
                <span className="mb-2 block text-sm font-bold text-forest-200">{t("admin.pricingInclVat")}</span>
                <input
                  className={inputClass}
                  type="number"
                  min={0.5}
                  step="0.01"
                  value={form.price_2_incl_vat}
                  onChange={(event) => setForm({ ...form, price_2_incl_vat: event.target.value })}
                  required
                />
              </label>
              {twoPerson && (
                <dl className="mt-4 space-y-2 text-sm text-white/70">
                  <div className="flex justify-between gap-3">
                    <dt>{t("admin.pricingBeforeVat")}</dt>
                    <dd className="font-semibold text-white">{twoPerson.preVat.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>{t("admin.pricingVatAmount")}</dt>
                    <dd className="font-semibold text-white">{twoPerson.vatAmount.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                    <dt>{t("admin.pricingCustomerPays")}</dt>
                    <dd className="font-black text-forest-300">{twoPerson.inclusive.toFixed(2)} {t("booking.omr")}</dd>
                  </div>
                </dl>
              )}
            </div>
          </div>
          <button type="submit" disabled={saving} className="rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60">
            {saving ? t("admin.pricingSaving") : t("admin.pricingSave")}
          </button>
        </form>
      )}
    </section>
  );
}
