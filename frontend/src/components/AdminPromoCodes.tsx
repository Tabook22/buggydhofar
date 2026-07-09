import { FormEvent, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RefreshCw, Tag, Trash2 } from "lucide-react";
import { api, isAdminAuthError, PromoCode } from "../api/client";
import { AdminSession, can } from "../lib/adminPermissions";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

type PromoForm = {
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: string;
  max_uses: string;
  is_active: boolean;
};

const emptyForm = (): PromoForm => ({
  code: "",
  discount_type: "percent",
  discount_value: "10",
  max_uses: "1",
  is_active: true
});

function randomPromoCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function formatDiscount(promo: PromoCode) {
  return promo.discount_type === "percent" ? `${promo.discount_value}%` : `${promo.discount_value} OMR`;
}

export function AdminPromoCodes({
  token,
  onAuthFailure,
  permissions = null,
  embedded = false
}: {
  token: string;
  onAuthFailure: (message?: string) => void;
  permissions?: AdminSession | null;
  embedded?: boolean;
}) {
  const canCreate = can(permissions, "promo", "create");
  const canEdit = can(permissions, "promo", "edit");
  const canDelete = can(permissions, "promo", "delete");
  const { t } = useTranslation();
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadPromos = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.adminGet<PromoCode[]>("/api/admin/promo-codes", token);
      setPromos(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.promoLoadFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [token, onAuthFailure, t]);

  useEffect(() => {
    loadPromos();
  }, [loadPromos]);

  async function submitPromo(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    const maxUsesRaw = form.max_uses.trim();
    const payload = {
      code: form.code.trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      max_uses: maxUsesRaw ? Number(maxUsesRaw) : null,
      is_active: form.is_active
    };
    try {
      await api.adminSend("/api/admin/promo-codes", token, "POST", payload);
      setForm(emptyForm());
      setStatus(t("admin.promoCreated"));
      await loadPromos();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.promoSaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(promo: PromoCode) {
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/promo-codes/${promo.id}`, token, "PATCH", { is_active: !promo.is_active });
      await loadPromos();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.promoSaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    }
  }

  async function deletePromo(promo: PromoCode) {
    if (!window.confirm(t("admin.promoDeleteConfirm", { code: promo.code }))) return;
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/promo-codes/${promo.id}`, token, "DELETE");
      setStatus(t("admin.promoDeleted"));
      await loadPromos();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.promoSaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    }
  }

  return (
    <section className={`${embedded ? "" : "mt-8"} rounded-[2rem] bg-white/5 p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <Tag size={24} className="text-forest-400" />
            {t("admin.promoCodesTitle")}
          </h2>
          <p className="mt-1 text-sm text-white/60">{t("admin.promoCodesHelp")}</p>
        </div>
      </div>

      {canCreate && (
      <form onSubmit={submitPromo} className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h3 className="text-lg font-bold">{t("admin.promoCreateTitle")}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-2 md:col-span-2 xl:col-span-1">
            <span className="text-sm font-semibold text-white/75">{t("admin.promoCode")}</span>
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="VIP2026"
                required
              />
              <button
                type="button"
                onClick={() => setForm({ ...form, code: randomPromoCode() })}
                className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white/80 hover:bg-white/10"
              >
                <RefreshCw size={14} />
                {t("admin.promoGenerate")}
              </button>
            </div>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.promoDiscountType")}</span>
            <select
              className={inputClass}
              value={form.discount_type}
              onChange={(event) => setForm({ ...form, discount_type: event.target.value as PromoForm["discount_type"] })}
            >
              <option value="percent">{t("admin.promoTypePercent")}</option>
              <option value="fixed">{t("admin.promoTypeFixed")}</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">
              {form.discount_type === "percent" ? t("admin.promoPercentValue") : t("admin.promoFixedValue")}
            </span>
            <input
              className={inputClass}
              type="number"
              min={form.discount_type === "percent" ? 1 : 0.01}
              max={form.discount_type === "percent" ? 100 : undefined}
              step={form.discount_type === "percent" ? 1 : 0.01}
              value={form.discount_value}
              onChange={(event) => setForm({ ...form, discount_value: event.target.value })}
              required
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.promoMaxUses")}</span>
            <input
              className={inputClass}
              type="number"
              min={1}
              value={form.max_uses}
              onChange={(event) => setForm({ ...form, max_uses: event.target.value })}
              placeholder={t("admin.promoUnlimitedPlaceholder")}
            />
            <span className="text-xs text-white/45">{t("admin.promoMaxUsesHelp")}</span>
          </label>
          <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-white/80">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              className="h-4 w-4 rounded"
            />
            {t("admin.promoActive")}
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? t("admin.sending") : t("admin.promoCreate")}
        </button>
      </form>
      )}

      {status && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-forest-200">{status}</p>}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="p-3 text-start">{t("admin.promoCode")}</th>
              <th className="p-3 text-start">{t("admin.promoDiscount")}</th>
              <th className="p-3 text-start">{t("admin.promoUsage")}</th>
              <th className="p-3 text-start">{t("admin.status")}</th>
              <th className="p-3 text-start">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/50">
                  {t("availability.loading")}
                </td>
              </tr>
            )}
            {!loading &&
              promos.map((promo) => (
                <tr key={promo.id} className="border-t border-white/10">
                  <td className="p-3 font-mono font-bold tracking-wider text-forest-300">{promo.code}</td>
                  <td className="p-3">{formatDiscount(promo)}</td>
                  <td className="p-3">
                    {promo.used_count}
                    {promo.max_uses != null ? ` / ${promo.max_uses}` : ` (${t("admin.promoUnlimited")})`}
                  </td>
                  <td className="p-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${
                        promo.is_active ? "bg-forest-500/20 text-forest-200" : "bg-white/10 text-white/50"
                      }`}
                    >
                      {promo.is_active ? t("admin.promoActive") : t("admin.promoInactive")}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => toggleActive(promo)}
                          className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/15"
                        >
                          {promo.is_active ? t("admin.promoDeactivate") : t("admin.promoActivate")}
                        </button>
                      )}
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => deletePromo(promo)}
                          className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-500/20"
                        >
                          <Trash2 size={14} />
                          {t("admin.delete")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            {!loading && promos.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-white/50">
                  {t("admin.promoEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}