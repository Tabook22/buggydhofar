import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Trash2 } from "lucide-react";
import { api, isAdminAuthError, MediaAsset, MediaAssetCategory } from "../api/client";
import { AdminMediaField } from "./AdminMediaField";
import { isVideoUrl, resolveMediaUrl } from "../lib/mediaUrl";

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

const CATEGORIES: MediaAssetCategory[] = ["gallery", "hero", "routes", "testimonials", "general"];

type AssetForm = {
  category: MediaAssetCategory;
  media_kind: "image" | "video";
  url: string;
  thumbnail_url: string;
  title_en: string;
  title_ar: string;
  instagram_url: string;
  sort_order: string;
  is_active: boolean;
  show_on_home_gallery: boolean;
};

const emptyForm = (): AssetForm => ({
  category: "gallery",
  media_kind: "image",
  url: "",
  thumbnail_url: "",
  title_en: "",
  title_ar: "",
  instagram_url: "",
  sort_order: "0",
  is_active: true,
  show_on_home_gallery: true
});

export function AdminMediaLibrary({
  token,
  onAuthFailure,
  embedded = false
}: {
  token: string;
  onAuthFailure: (message?: string) => void;
  embedded?: boolean;
}) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [form, setForm] = useState<AssetForm>(emptyForm);
  const [filterCategory, setFilterCategory] = useState<MediaAssetCategory | "all">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    try {
      const path =
        filterCategory === "all" ? "/api/admin/media-assets" : `/api/admin/media-assets?category=${filterCategory}`;
      const data = await api.adminGet<MediaAsset[]>(path, token);
      setAssets(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.mediaLibraryLoadFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    } finally {
      setLoading(false);
    }
  }, [filterCategory, token, onAuthFailure, t]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const homeGalleryCount = useMemo(() => assets.filter((asset) => asset.show_on_home_gallery && asset.is_active).length, [assets]);

  async function submitAsset(event: FormEvent) {
    event.preventDefault();
    if (!form.url.trim()) {
      setStatus(t("admin.mediaLibraryUrlRequired"));
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.adminSend("/api/admin/media-assets", token, "POST", {
        category: form.category,
        media_kind: form.media_kind,
        url: form.url.trim(),
        thumbnail_url: form.thumbnail_url.trim() || null,
        title_en: form.title_en.trim() || null,
        title_ar: form.title_ar.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
        show_on_home_gallery: form.show_on_home_gallery
      });
      setForm(emptyForm());
      setStatus(t("admin.mediaLibrarySaved"));
      await loadAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.mediaLibrarySaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    } finally {
      setSaving(false);
    }
  }

  async function patchAsset(id: number, patch: Partial<MediaAsset>) {
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/media-assets/${id}`, token, "PATCH", patch);
      await loadAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.mediaLibrarySaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    }
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!window.confirm(t("admin.mediaLibraryDeleteConfirm"))) return;
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/media-assets/${asset.id}`, token, "DELETE");
      setStatus(t("admin.mediaLibraryDeleted"));
      await loadAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.mediaLibrarySaveFailed");
      if (isAdminAuthError(message)) onAuthFailure(message);
      else setStatus(message);
    }
  }

  return (
    <section className={`${embedded ? "mt-8 border-t border-white/10 pt-8" : "mt-8"} rounded-[2rem] bg-white/5 p-6`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black">
            <ImagePlus size={24} className="text-forest-400" />
            {t("admin.mediaLibraryTitle")}
          </h2>
          <p className="mt-1 text-sm text-white/60">{t("admin.mediaLibraryHelp")}</p>
          <p className="mt-2 text-sm font-semibold text-forest-300">
            {t("admin.mediaLibraryHomeCount", { count: homeGalleryCount })}
          </p>
        </div>
      </div>

      <form onSubmit={submitAsset} className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
        <h3 className="text-lg font-bold">{t("admin.mediaLibraryAddTitle")}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibraryCategory")}</span>
            <select
              className={inputClass}
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as MediaAssetCategory })}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {t(`admin.mediaCategory.${category}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibraryKind")}</span>
            <select
              className={inputClass}
              value={form.media_kind}
              onChange={(event) => setForm({ ...form, media_kind: event.target.value as "image" | "video" })}
            >
              <option value="image">{t("admin.mediaTypeImage")}</option>
              <option value="video">{t("admin.mediaTypeVideo")}</option>
            </select>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibrarySortOrder")}</span>
            <input
              className={inputClass}
              type="number"
              value={form.sort_order}
              onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
            />
          </label>
          <label className="block space-y-2 md:col-span-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibraryInstagramUrl")}</span>
            <input
              className={inputClass}
              value={form.instagram_url}
              onChange={(event) => setForm({ ...form, instagram_url: event.target.value })}
              placeholder="https://www.instagram.com/gobuggydhofar/reel/..."
            />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibraryTitleEn")}</span>
            <input className={inputClass} value={form.title_en} onChange={(event) => setForm({ ...form, title_en: event.target.value })} />
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-white/75">{t("admin.mediaLibraryTitleAr")}</span>
            <input className={inputClass} value={form.title_ar} onChange={(event) => setForm({ ...form, title_ar: event.target.value })} />
          </label>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <AdminMediaField
            label={t("admin.mediaLibraryMainMedia")}
            help={t("admin.mediaLibraryMainMediaHelp")}
            value={form.url}
            onChange={(url) => setForm({ ...form, url })}
            mediaKind={form.media_kind}
            token={token}
            inputClass={inputClass}
          />
          {form.media_kind === "video" && (
            <AdminMediaField
              label={t("admin.mediaLibraryThumbnail")}
              help={t("admin.mediaLibraryThumbnailHelp")}
              value={form.thumbnail_url}
              onChange={(url) => setForm({ ...form, thumbnail_url: url })}
              mediaKind="image"
              token={token}
              inputClass={inputClass}
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-white/80">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.show_on_home_gallery}
              onChange={(event) => setForm({ ...form, show_on_home_gallery: event.target.checked })}
              className="h-4 w-4 rounded"
            />
            {t("admin.mediaLibraryShowOnHome")}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              className="h-4 w-4 rounded"
            />
            {t("admin.mediaLibraryActive")}
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-5 rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white disabled:opacity-50"
        >
          {saving ? t("admin.sending") : t("admin.mediaLibraryAdd")}
        </button>
      </form>

      {status && <p className="mt-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-forest-200">{status}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilterCategory("all")}
          className={`rounded-xl px-3 py-2 text-xs font-bold ${filterCategory === "all" ? "bg-forest-500/25 text-forest-200" : "bg-white/5 text-white/65"}`}
        >
          {t("admin.mediaLibraryAll")}
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilterCategory(category)}
            className={`rounded-xl px-3 py-2 text-xs font-bold ${
              filterCategory === category ? "bg-forest-500/25 text-forest-200" : "bg-white/5 text-white/65"
            }`}
          >
            {t(`admin.mediaCategory.${category}`)}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="text-white/60">
            <tr>
              <th className="p-3 text-start">{t("admin.mediaLibraryPreview")}</th>
              <th className="p-3 text-start">{t("admin.mediaLibraryCategory")}</th>
              <th className="p-3 text-start">{t("admin.mediaLibraryTitleEn")}</th>
              <th className="p-3 text-start">{t("admin.mediaLibraryHome")}</th>
              <th className="p-3 text-start">{t("admin.status")}</th>
              <th className="p-3 text-start">{t("admin.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-white/50">
                  {t("availability.loading")}
                </td>
              </tr>
            )}
            {!loading &&
              assets.map((asset) => {
                const previewUrl = resolveMediaUrl(asset.thumbnail_url || asset.url);
                const isVideo = isVideoUrl(resolveMediaUrl(asset.url), asset.media_kind);
                return (
                  <tr key={asset.id} className="border-t border-white/10">
                    <td className="p-3">
                      <div className="h-16 w-16 overflow-hidden rounded-xl border border-white/10 bg-black/30">
                        {isVideo ? (
                          <video src={resolveMediaUrl(asset.url)} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                        ) : (
                          <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="font-semibold">{t(`admin.mediaCategory.${asset.category}`)}</span>
                      <span className="mt-1 block text-xs text-white/45">
                        {asset.media_kind === "video" ? t("admin.mediaTypeVideo") : t("admin.mediaTypeImage")}
                      </span>
                    </td>
                    <td className="p-3">
                      <p>{asset.title_en || "—"}</p>
                      {asset.title_ar ? <p className="text-xs text-white/45">{asset.title_ar}</p> : null}
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => patchAsset(asset.id, { show_on_home_gallery: !asset.show_on_home_gallery })}
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          asset.show_on_home_gallery ? "bg-forest-500/20 text-forest-200" : "bg-white/10 text-white/45"
                        }`}
                      >
                        {asset.show_on_home_gallery ? t("admin.yes") : t("admin.no")}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => patchAsset(asset.id, { is_active: !asset.is_active })}
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          asset.is_active ? "bg-forest-500/20 text-forest-200" : "bg-white/10 text-white/45"
                        }`}
                      >
                        {asset.is_active ? t("admin.mediaLibraryActive") : t("admin.mediaLibraryInactive")}
                      </button>
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => deleteAsset(asset)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-200"
                      >
                        <Trash2 size={14} />
                        {t("admin.delete")}
                      </button>
                    </td>
                  </tr>
                );
              })}
            {!loading && assets.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-white/50">
                  {t("admin.mediaLibraryEmpty")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}