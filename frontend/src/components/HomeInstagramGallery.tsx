import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, Play, X } from "lucide-react";
import { api, MediaAsset } from "../api/client";
import { isVideoUrl, resolveMediaUrl } from "../lib/mediaUrl";

const INSTAGRAM_URL = "https://www.instagram.com/gobuggydhofar/";
const HERO_GALLERY_LIMIT = 4;

function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 1.366.062 2.633.334 3.608 1.308.974.974 1.246 2.241 1.308 3.608.058 1.266.07 1.646.07 4.85s-.012 3.584-.07 4.85c-.062 1.366-.334 2.633-1.308 3.608-.974.974-2.241 1.246-3.608 1.308-1.266.058-1.646.07-4.85.07s-3.584-.012-4.85-.07c-1.366-.062-2.633-.334-3.608-1.308-.974-.974-1.246-2.241-1.308-3.608C2.175 15.747 2.163 15.367 2.163 12s.012-3.584.07-4.85c.062-1.366.334-2.633 1.308-3.608.974-.974 2.241-1.246 3.608-1.308C8.416 2.175 8.796 2.163 12 2.163zm0 1.622c-3.154 0-3.527.012-4.764.069-1.026.047-1.584.218-1.955.363-.492.192-.843.422-1.212.79-.368.369-.598.72-.79 1.212-.145.371-.316.929-.363 1.955-.057 1.237-.069 1.61-.069 4.764s.012 3.527.069 4.764c.047 1.026.218 1.584.363 1.955.192.492.422.843.79 1.212.369.368.72.598 1.212.79.371.145.929.316 1.955.363 1.237.057 1.61.069 4.764.069s3.527-.012 4.764-.069c1.026-.047 1.584-.218 1.955-.363.492-.192.843-.422 1.212-.79.368-.369.598-.72.79-1.212.145-.371.316-.929.363-1.955.057-1.237.069-1.61.069-4.764s-.012-3.527-.069-4.764c-.047-1.026-.218-1.584-.363-1.955-.192-.492-.422-.843-.79-1.212-.368-.368-.72-.598-1.212-.79-.371-.145-.929-.316-1.955-.363-1.237-.057-1.61-.069-4.764-.069zm0 3.351a4.864 4.864 0 1 1 0 9.728 4.864 4.864 0 0 1 0-9.728zm0 1.622a3.242 3.242 0 1 0 0 6.484 3.242 3.242 0 0 0 0-6.484zm5.338-3.205a1.136 1.136 0 1 1-2.272 0 1.136 1.136 0 0 1 2.272 0z" />
    </svg>
  );
}

function galleryTitle(item: MediaAsset, language: string) {
  const title = language.startsWith("ar") ? item.title_ar || item.title_en : item.title_en || item.title_ar;
  return title || "";
}

function GalleryTile({
  item,
  language,
  onOpen,
  compact = false
}: {
  item: MediaAsset;
  language: string;
  onOpen: (item: MediaAsset) => void;
  compact?: boolean;
}) {
  const mediaUrl = resolveMediaUrl(item.url);
  const thumbUrl = resolveMediaUrl(item.thumbnail_url) || mediaUrl;
  const isVideo = isVideoUrl(mediaUrl, item.media_kind);
  const title = galleryTitle(item, language);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`group relative aspect-square overflow-hidden border border-white/10 bg-black/30 text-start shadow-lg transition hover:border-pink-400/35 hover:shadow-glow ${
        compact ? "rounded-2xl" : "rounded-[1.75rem]"
      }`}
    >
      {isVideo ? (
        <video
          src={mediaUrl}
          poster={thumbUrl !== mediaUrl ? thumbUrl : undefined}
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <img
          src={thumbUrl}
          alt={title || "Buggy Dhofar adventure"}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-forest-950/90 via-forest-950/10 to-transparent opacity-80 transition group-hover:opacity-100" />
      {isVideo && (
        <span
          className={`absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 backdrop-blur transition group-hover:bg-pink-500/35 ${
            compact ? "h-9 w-9" : "h-12 w-12"
          }`}
        >
          <Play size={compact ? 16 : 22} className="ms-0.5 text-white" fill="currentColor" />
        </span>
      )}
      {title && !compact ? (
        <span className="absolute inset-x-0 bottom-0 p-4 text-sm font-bold leading-snug text-white">{title}</span>
      ) : null}
      {item.instagram_url ? (
        <span className="absolute end-2 top-2 rounded-full bg-black/45 p-1.5 text-pink-200 opacity-0 transition group-hover:opacity-100">
          <InstagramGlyph className="h-3.5 w-3.5" />
        </span>
      ) : null}
    </button>
  );
}

function GalleryLightbox({
  activeItem,
  language,
  onClose
}: {
  activeItem: MediaAsset;
  language: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const activeUrl = resolveMediaUrl(activeItem.url);
  const activeIsVideo = isVideoUrl(activeUrl, activeItem.media_kind);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div
        className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/10 bg-forest-950 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
          aria-label={t("gallery.close")}
        >
          <X size={20} />
        </button>
        {activeIsVideo ? (
          <video src={activeUrl} controls autoPlay className="max-h-[80vh] w-full bg-black object-contain" />
        ) : (
          <img src={activeUrl} alt={galleryTitle(activeItem, language)} className="max-h-[80vh] w-full object-contain" />
        )}
        {(galleryTitle(activeItem, language) || activeItem.instagram_url) && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-4">
            {galleryTitle(activeItem, language) ? (
              <p className="font-bold text-white">{galleryTitle(activeItem, language)}</p>
            ) : (
              <span />
            )}
            {activeItem.instagram_url ? (
              <a
                href={activeItem.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-bold text-pink-200 hover:text-pink-100"
              >
                <InstagramGlyph className="h-4 w-4" />
                {t("gallery.viewOnInstagram")}
              </a>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function HomeInstagramGallery({
  variant = "section",
  fallback = null
}: {
  variant?: "hero" | "section";
  fallback?: ReactNode;
}) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeItem, setActiveItem] = useState<MediaAsset | null>(null);

  useEffect(() => {
    api
      .getGallery()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  function openItem(item: MediaAsset) {
    if (item.instagram_url) {
      window.open(item.instagram_url, "_blank", "noopener,noreferrer");
      return;
    }
    setActiveItem(item);
  }

  if (loading) {
    return variant === "hero" ? fallback : null;
  }

  if (items.length === 0) {
    return variant === "hero" ? fallback : null;
  }

  const heroItems = items.slice(0, HERO_GALLERY_LIMIT);
  const displayItems = variant === "hero" ? heroItems : items;

  const followLink = (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 font-bold text-white transition hover:text-pink-200 ${
        variant === "hero"
          ? "rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm hover:border-pink-400/35 hover:bg-white/15"
          : "rounded-full border border-white/15 bg-white/10 px-6 py-3 hover:border-pink-400/35 hover:bg-white/15"
      }`}
    >
      <InstagramGlyph className={variant === "hero" ? "h-4 w-4 text-pink-300" : "h-[18px] w-[18px] text-pink-300"} />
      {t("gallery.follow")}
      <ExternalLink size={variant === "hero" ? 14 : 16} className="text-white/50" />
    </a>
  );

  if (variant === "hero") {
    return (
      <div className="relative" id="instagram">
        <div className="absolute inset-6 rounded-full bg-pink-500/10 blur-3xl" aria-hidden />
        <div className="glass relative z-10 rounded-[2.5rem] p-5 sm:p-6">
          <p className="inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1.5 text-xs font-bold text-pink-200">
            <InstagramGlyph className="h-3.5 w-3.5" />
            {t("gallery.badge")}
          </p>
          <h2 className="mt-4 text-2xl font-black leading-tight text-white sm:text-3xl">{t("gallery.title")}</h2>
          <p className="mt-2 text-sm leading-6 text-white/70 sm:text-base">{t("gallery.subtitle")}</p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:gap-3">
            {heroItems.map((item) => (
              <GalleryTile key={item.id} item={item} language={i18n.language} onOpen={openItem} compact />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            {followLink}
            {items.length > HERO_GALLERY_LIMIT ? (
              <p className="text-xs font-semibold text-white/45">
                +{items.length - HERO_GALLERY_LIMIT} {t("gallery.moreOnInstagram")}
              </p>
            ) : null}
          </div>
        </div>

        {activeItem && <GalleryLightbox activeItem={activeItem} language={i18n.language} onClose={() => setActiveItem(null)} />}
      </div>
    );
  }

  return (
    <section id="instagram" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-4 py-2 text-sm font-bold text-pink-200">
            <InstagramGlyph className="h-4 w-4" />
            {t("gallery.badge")}
          </p>
          <h2 className="mt-5 text-4xl font-black md:text-5xl">{t("gallery.title")}</h2>
          <p className="mt-4 text-lg text-white/70">{t("gallery.subtitle")}</p>
        </div>
        {followLink}
      </div>

      <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {displayItems.map((item) => (
          <GalleryTile key={item.id} item={item} language={i18n.language} onOpen={openItem} />
        ))}
      </div>

      {activeItem && <GalleryLightbox activeItem={activeItem} language={i18n.language} onClose={() => setActiveItem(null)} />}
    </section>
  );
}