import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, Eye, ExternalLink, ImagePlus, Pencil, Trash2, UserPlus } from "lucide-react";
import { api, isAdminAuthError, MediaAsset, MediaAssetCategory } from "../api/client";
import { AdminMediaField } from "./AdminMediaField";
import { AdminSession, can } from "../lib/adminPermissions";
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

function formFromAsset(asset: MediaAsset): AssetForm {
  return {
    category: asset.category,
    media_kind: asset.media_kind,
    url: asset.url,
    thumbnail_url: asset.thumbnail_url || "",
    title_en: asset.title_en || "",
    title_ar: asset.title_ar || "",
    instagram_url: asset.instagram_url || "",
    sort_order: String(asset.sort_order),
    is_active: asset.is_active,
    show_on_home_gallery: asset.show_on_home_gallery
  };
}

function formatCreatedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function MediaPreview({
  asset,
  large = false
}: {
  asset: Pick<MediaAsset, "url" | "thumbnail_url" | "media_kind">;
  large?: boolean;
}) {
  const previewUrl = resolveMediaUrl(asset.thumbnail_url || asset.url);
  const isVideo = isVideoUrl(resolveMediaUrl(asset.url), asset.media_kind);
  const sizeClass = large ? "h-48 w-full max-w-sm md:h-56" : "h-16 w-16";

  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-black/30 ${sizeClass}`}>
      {isVideo ? (
        <video
          src={resolveMediaUrl(asset.url)}
          muted
          playsInline
          controls={large}
          preload="metadata"
          className="h-full w-full object-cover"
        />
      ) : (
        <img src={previewUrl} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function MediaAssetFormFields({
  form,
  setForm,
  token,
  t
}: {
  form: AssetForm;
  setForm: (form: AssetForm) => void;
  token: string;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
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
    </>
  );
}

function MediaAssetDetails({
  asset,
  t,
  locale
}: {
  asset: MediaAsset;
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,16rem)_1fr]">
      <MediaPreview asset={asset} large />
      <dl className="grid gap-2 text-sm text-white/75 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryCategory")}</dt>
          <dd className="font-semibold text-white">{t(`admin.mediaCategory.${asset.category}`)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryKind")}</dt>
          <dd className="font-semibold text-white">
            {asset.media_kind === "video" ? t("admin.mediaTypeVideo") : t("admin.mediaTypeImage")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryTitleEn")}</dt>
          <dd>{asset.title_en || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryTitleAr")}</dt>
          <dd>{asset.title_ar || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibrarySortOrder")}</dt>
          <dd>{asset.sort_order}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryCreatedAt")}</dt>
          <dd>{formatCreatedAt(asset.created_at, locale)}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryHome")}</dt>
          <dd>{asset.show_on_home_gallery ? t("admin.yes") : t("admin.no")}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.status")}</dt>
          <dd>{asset.is_active ? t("admin.mediaLibraryActive") : t("admin.mediaLibraryInactive")}</dd>
        </div>
        {asset.instagram_url && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryInstagramUrl")}</dt>
            <dd>
              <a
                href={asset.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-forest-300 hover:underline"
              >
                {asset.instagram_url}
                <ExternalLink size={14} />
              </a>
            </dd>
          </div>
        )}
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-white/40">{t("admin.mediaLibraryMediaUrl")}</dt>
          <dd className="break-all text-xs text-white/55">{resolveMediaUrl(asset.url)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function AdminMediaLibrary({
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
  const canCreate = can(permissions, "content", "create");
  const canEdit = can(permissions, "content", "edit");
  const canDelete = can(permissions, "content", "delete");
  const canView = can(permissions, "content", "view");
  const { t, i18n } = useTranslation();
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [addForm, setAddForm] = useState<AssetForm>(emptyForm);
  const [editForm, setEditForm] = useState<AssetForm | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
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

  const homeGalleryCount = useMemo(
    () => assets.filter((asset) => asset.show_on_home_gallery && asset.is_active).length,
    [assets]
  );

  function cancelEdit() {
    setEditingId(null);
    setEditForm(null);
  }

  function selectAsset(asset: MediaAsset) {
    if (!canEdit) {
      setViewingId((current) => (current === asset.id ? null : asset.id));
      return;
    }
    setShowAddForm(false);
    setEditingId(asset.id);
    setViewingId(null);
    setEditForm(formFromAsset(asset));
    setStatus(null);
  }

  function toggleView(asset: MediaAsset, event: React.MouseEvent) {
    event.stopPropagation();
    if (editingId === asset.id) return;
    setViewingId((current) => (current === asset.id ? null : asset.id));
  }

  function startEdit(asset: MediaAsset, event: React.MouseEvent) {
    event.stopPropagation();
    if (!canEdit) return;
    selectAsset(asset);
  }

  async function submitAdd(event: FormEvent) {
    event.preventDefault();
    if (!addForm.url.trim()) {
      setStatus(t("admin.mediaLibraryUrlRequired"));
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.adminSend("/api/admin/media-assets", token, "POST", buildPayload(addForm));
      setAddForm(emptyForm());
      setShowAddForm(false);
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

  function buildPayload(form: AssetForm) {
    return {
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
    };
  }

  async function submitEdit(event: FormEvent, assetId: number) {
    event.preventDefault();
    if (!editForm || !editForm.url.trim()) {
      setStatus(t("admin.mediaLibraryUrlRequired"));
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/media-assets/${assetId}`, token, "PATCH", buildPayload(editForm));
      setStatus(t("admin.mediaLibraryUpdated"));
      cancelEdit();
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

  async function deleteAsset(asset: MediaAsset, event?: React.MouseEvent) {
    event?.stopPropagation();
    if (!window.confirm(t("admin.mediaLibraryDeleteConfirm"))) return;
    setStatus(null);
    try {
      await api.adminSend(`/api/admin/media-assets/${asset.id}`, token, "DELETE");
      if (editingId === asset.id) cancelEdit();
      if (viewingId === asset.id) setViewingId(null);
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
          <p className="mt-1 text-xs text-white/45">{t("admin.clickMediaToEdit")}</p>
          <p className="mt-2 text-sm font-semibold text-forest-300">
            {t("admin.mediaLibraryHomeCount", { count: homeGalleryCount })}
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => {
              cancelEdit();
              setViewingId(null);
              setShowAddForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-forest-500 px-4 py-2 text-sm font-bold"
          >
            <UserPlus size={16} />
            {t("admin.mediaLibraryAddTitle")}
          </button>
        )}
      </div>

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

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-bold">{t("admin.mediaLibraryListTitle")}</h3>
          {!loading && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/60">
              {t("admin.mediaLibraryCount", { count: assets.length })}
            </span>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-white/50">{t("availability.loading")}</p>
        ) : assets.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/50">
            {t("admin.mediaLibraryEmpty")}
          </p>
        ) : (
          assets.map((asset) => {
            const isEditing = editingId === asset.id && editForm !== null;
            const isViewing = viewingId === asset.id && !isEditing;

            return (
              <div
                key={asset.id}
                className={`rounded-2xl border bg-white/5 transition-colors ${
                  isEditing ? "border-forest-400/60 ring-1 ring-forest-400/20" : "border-white/10 hover:border-white/25"
                } ${canEdit || canView ? "cursor-pointer" : ""}`}
                onClick={() => (canEdit || canView) && selectAsset(asset)}
                onKeyDown={(event) => {
                  if ((canEdit || canView) && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    selectAsset(asset);
                  }
                }}
                role={canEdit || canView ? "button" : undefined}
                tabIndex={canEdit || canView ? 0 : undefined}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 p-4">
                  <div className="flex min-w-0 flex-1 gap-4">
                    <MediaPreview asset={asset} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-white">{asset.title_en || asset.title_ar || t("admin.mediaLibraryUntitled")}</p>
                        {isEditing && (
                          <span className="rounded-full bg-forest-500/15 px-2 py-0.5 text-xs text-forest-200">
                            {t("admin.editingUser")}
                          </span>
                        )}
                      </div>
                      {asset.title_ar && asset.title_en ? (
                        <p className="text-xs text-white/45">{asset.title_ar}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-white/60">
                        {t(`admin.mediaCategory.${asset.category}`)} ·{" "}
                        {asset.media_kind === "video" ? t("admin.mediaTypeVideo") : t("admin.mediaTypeImage")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            asset.show_on_home_gallery ? "bg-forest-500/20 text-forest-200" : "bg-white/10 text-white/45"
                          }`}
                        >
                          {t("admin.mediaLibraryHome")}: {asset.show_on_home_gallery ? t("admin.yes") : t("admin.no")}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                            asset.is_active ? "bg-forest-500/20 text-forest-200" : "bg-white/10 text-white/45"
                          }`}
                        >
                          {asset.is_active ? t("admin.mediaLibraryActive") : t("admin.mediaLibraryInactive")}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      onClick={(event) => toggleView(asset, event)}
                      className="inline-flex items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-sm text-white/80"
                    >
                      <Eye size={14} />
                      {isViewing ? t("admin.hideAccess") : t("admin.viewAccess")}
                      {isViewing ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(event) => startEdit(asset, event)}
                        className="inline-flex items-center gap-1 rounded-xl border border-forest-400/30 px-3 py-2 text-sm text-forest-300"
                      >
                        <Pencil size={14} />
                        {t("admin.edit")}
                      </button>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          onClick={() => patchAsset(asset.id, { show_on_home_gallery: !asset.show_on_home_gallery })}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                        >
                          {asset.show_on_home_gallery ? t("admin.mediaLibraryHideHome") : t("admin.mediaLibraryShowHome")}
                        </button>
                        <button
                          type="button"
                          onClick={() => patchAsset(asset.id, { is_active: !asset.is_active })}
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70"
                        >
                          {asset.is_active ? t("admin.mediaLibraryDeactivate") : t("admin.mediaLibraryActivate")}
                        </button>
                      </>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(event) => deleteAsset(asset, event)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-400/20 px-3 py-2 text-sm text-red-300"
                      >
                        <Trash2 size={14} />
                        {t("admin.delete")}
                      </button>
                    )}
                  </div>
                </div>

                {isViewing && (
                  <div className="border-t border-white/10 px-4 pb-4 pt-3" onClick={(event) => event.stopPropagation()}>
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/45">
                      {t("admin.mediaLibraryViewDetails")}
                    </p>
                    <MediaAssetDetails asset={asset} t={t} locale={i18n.language} />
                  </div>
                )}

                {isEditing && editForm && (
                  <form
                    className="border-t border-forest-400/20 px-4 pb-4 pt-4"
                    onSubmit={(event) => submitEdit(event, asset.id)}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <p className="mb-4 text-sm text-white/70">{t("admin.mediaLibraryEditHint")}</p>
                    <MediaAssetFormFields form={editForm} setForm={setEditForm} token={token} t={t} />
                    <div className="mt-4 flex flex-wrap gap-3">
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60"
                      >
                        {saving ? t("admin.sending") : t("admin.mediaLibrarySaveChanges")}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelEdit();
                        }}
                        className="rounded-2xl border border-white/10 px-5 py-3 font-bold"
                      >
                        {t("admin.cancel")}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>

      {canCreate && showAddForm && (
        <form onSubmit={submitAdd} className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
          <h3 className="text-lg font-bold">{t("admin.mediaLibraryAddTitle")}</h3>
          <MediaAssetFormFields form={addForm} setForm={setAddForm} token={token} t={t} />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving ? t("admin.sending") : t("admin.mediaLibraryAdd")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddForm(emptyForm());
              }}
              className="rounded-2xl border border-white/10 px-5 py-3 font-bold"
            >
              {t("admin.cancel")}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}