import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, Link2, Upload } from "lucide-react";
import { api } from "../api/client";
import { isVideoUrl, resolveMediaUrl } from "../lib/mediaUrl";

type MediaKind = "image" | "video";

type AdminMediaFieldProps = {
  label: string;
  help?: string;
  value: string;
  onChange: (url: string) => void;
  mediaKind: MediaKind;
  token: string;
  inputClass: string;
};

export function AdminMediaField({
  label,
  help,
  value,
  onChange,
  mediaKind,
  token,
  inputClass
}: AdminMediaFieldProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const resolved = resolveMediaUrl(value);
  const showVideoPreview = Boolean(resolved) && isVideoUrl(resolved, mediaKind);

  async function handleUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await api.adminUploadMedia(token, file, mediaKind);
      onChange(result.url);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : t("admin.mediaUploadFailed"));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  const accept =
    mediaKind === "video"
      ? "video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
      : "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-white">{label}</p>
          {help ? <p className="mt-1 text-sm text-white/55">{help}</p> : null}
        </div>
        {resolved ? (
          <span className="rounded-full bg-forest-500/20 px-2 py-1 text-xs font-bold text-forest-200">
            {mediaKind === "video" ? t("admin.mediaTypeVideo") : t("admin.mediaTypeImage")}
          </span>
        ) : null}
      </div>

      <label className="mt-4 block space-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-white/75">
          <Link2 size={14} />
          {t("admin.mediaUrlLabel")}
        </span>
        <input
          className={inputClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("admin.mediaUrlPlaceholder")}
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(event) => handleUpload(event.target.files?.[0] || null)}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-forest-500/20 px-4 py-2.5 text-sm font-bold text-forest-200 transition hover:bg-forest-500/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Upload size={16} />
          {uploading ? t("admin.mediaUploading") : t("admin.mediaUploadFromPc")}
        </button>
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/5"
          >
            {t("admin.mediaClear")}
          </button>
        ) : null}
      </div>

      {error ? <p className="mt-3 rounded-xl bg-red-500/15 px-3 py-2 text-sm text-red-200">{error}</p> : null}

      {resolved ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          {showVideoPreview ? (
            <video src={resolved} className="aspect-video w-full object-cover" controls muted playsInline />
          ) : (
            <img src={resolved} alt={label} className="aspect-video w-full object-cover" />
          )}
        </div>
      ) : (
        <div className="mt-4 flex aspect-video items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/5 text-white/40">
          <div className="text-center">
            <ImagePlus className="mx-auto" size={28} />
            <p className="mt-2 text-sm">{t("admin.mediaPreviewEmpty")}</p>
          </div>
        </div>
      )}
    </div>
  );
}