import { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import type { SiteContent } from "../api/client";
import { AdminMediaField } from "./AdminMediaField";
import { resolveMediaUrl } from "../lib/mediaUrl";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

type AdvertisementForm = Pick<SiteContent, "advertisement_image_url" | "advertisement_active">;

export function AdminAdvertisementSettings({
  form,
  token,
  message,
  readOnly = false,
  embedded = false,
  onChange,
  onSave
}: {
  form: AdvertisementForm & Record<string, unknown>;
  token: string;
  message?: { type: "success" | "error"; text: string } | null;
  readOnly?: boolean;
  embedded?: boolean;
  onChange: (next: AdvertisementForm) => void;
  onSave: (event: FormEvent) => void;
}) {
  const { t } = useTranslation();
  const preview = resolveMediaUrl(form.advertisement_image_url);

  return (
    <section className={embedded ? "rounded-[2rem] bg-white/5 p-6" : "rounded-[2rem] bg-white/5 p-6"}>
      <h2 className="text-2xl font-black">{t("admin.advertisementTitle")}</h2>
      <p className="mt-2 max-w-3xl text-sm text-white/60">{t("admin.advertisementSubtitle")}</p>
      {message && (
        <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${message.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"}`}>
          {message.text}
        </p>
      )}
      <form onSubmit={onSave} className="mt-6 space-y-5">
        <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 ${form.advertisement_active ? "border-forest-400/40 bg-forest-500/10" : "border-white/10 bg-black/20"}`}>
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 rounded"
            checked={Boolean(form.advertisement_active)}
            disabled={readOnly}
            onChange={(event) => onChange({ advertisement_image_url: form.advertisement_image_url, advertisement_active: event.target.checked })}
          />
          <span>
            <span className="block font-bold text-white">{t("admin.advertisementShowOnHome")}</span>
            <span className="mt-1 block text-sm text-white/55">{t("admin.advertisementShowHelp")}</span>
          </span>
        </label>

        <AdminMediaField
          label={t("admin.advertisementImage")}
          help={t("admin.advertisementImageHelp")}
          value={form.advertisement_image_url || ""}
          onChange={(url) => onChange({ advertisement_image_url: url, advertisement_active: form.advertisement_active })}
          mediaKind="image"
          token={token}
          inputClass={inputClass}
        />

        {preview ? (
          <div className="mx-auto max-w-sm">
            <p className="mb-3 text-sm font-bold text-forest-200">{t("admin.advertisementPreview")}</p>
            <img src={preview} alt={t("admin.advertisementAlt")} className="w-full rounded-3xl border border-white/10 object-cover shadow-lg" />
            <p className="mt-3 text-center text-sm text-white/50">
              {form.advertisement_active ? t("admin.advertisementVisibleNow") : t("admin.advertisementHiddenNow")}
            </p>
            {form.advertisement_active ? (
              <Link to="/" className="mt-3 block text-center text-sm font-bold text-forest-300 hover:text-forest-200">
                {t("admin.advertisementViewHome")}
              </Link>
            ) : null}
          </div>
        ) : null}

        {!readOnly && (
          <button type="submit" className="rounded-2xl bg-forest-500 px-5 py-3 font-bold">
            {t("admin.advertisementSave")}
          </button>
        )}
      </form>
    </section>
  );
}
