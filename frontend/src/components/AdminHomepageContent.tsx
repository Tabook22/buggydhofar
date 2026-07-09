import { FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import type { LucideIcon } from "lucide-react";
import { Image, Images, LayoutGrid, Type } from "lucide-react";
import type { SiteContent } from "../api/client";
import { AdminMediaField } from "./AdminMediaField";
import { AdminMediaLibrary } from "./AdminMediaLibrary";
import { AdminSession, can } from "../lib/adminPermissions";

export type SiteContentForm = Omit<SiteContent, "id">;

const inputClass =
  "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";

const CONTENT_SUB_TAB_STORAGE_KEY = "admin_content_sub_tab";

const CONTENT_SUB_TABS = [
  { id: "hero", labelKey: "admin.contentSubTabHero", icon: Type },
  { id: "images", labelKey: "admin.contentSubTabImages", icon: Image },
  { id: "sections", labelKey: "admin.contentSubTabSections", icon: LayoutGrid },
  { id: "media", labelKey: "admin.contentSubTabMedia", icon: Images }
] as const satisfies ReadonlyArray<{ id: string; labelKey: string; icon: LucideIcon }>;

type ContentSubTabId = (typeof CONTENT_SUB_TABS)[number]["id"];

function readStoredContentSubTab(): ContentSubTabId {
  try {
    const saved = localStorage.getItem(CONTENT_SUB_TAB_STORAGE_KEY);
    if (saved && CONTENT_SUB_TABS.some((tab) => tab.id === saved)) {
      return saved as ContentSubTabId;
    }
  } catch {
    // Ignore storage errors
  }
  return "hero";
}

type Props = {
  form: SiteContentForm;
  onChange: (form: SiteContentForm) => void;
  token: string;
  adminSession: AdminSession | null;
  contentMessage: { type: "success" | "error"; text: string } | null;
  onSave: (event: FormEvent) => void;
  onAuthFailure: (message?: string) => void;
};

export function AdminHomepageContent({
  form,
  onChange,
  token,
  adminSession,
  contentMessage,
  onSave,
  onAuthFailure
}: Props) {
  const { t } = useTranslation();
  const [contentSubTab, setContentSubTab] = useState<ContentSubTabId>(readStoredContentSubTab);
  const canEdit = can(adminSession, "content", "edit");
  const showSave = contentSubTab !== "media" && canEdit;

  function selectContentSubTab(tabId: ContentSubTabId) {
    setContentSubTab(tabId);
    try {
      localStorage.setItem(CONTENT_SUB_TAB_STORAGE_KEY, tabId);
    } catch {
      // Ignore storage errors
    }
  }

  function patchForm(patch: Partial<SiteContentForm>) {
    onChange({ ...form, ...patch });
  }

  return (
    <div className="mt-6 space-y-0">
      <section className="rounded-[2rem] bg-white/5 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black">{t("admin.contentPageTitle")}</h2>
            <p className="mt-2 text-white/60">{t("admin.contentPageSubtitle")}</p>
          </div>
          <a
            href="/"
            target="_blank"
            className="rounded-full border border-white/10 px-5 py-2 font-bold text-forest-400"
            rel="noreferrer"
          >
            {t("admin.viewHomePage")}
          </a>
        </div>

        {contentMessage && (
          <p
            className={`mt-4 rounded-2xl px-4 py-3 text-sm ${
              contentMessage.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"
            }`}
          >
            {contentMessage.text}
          </p>
        )}

        <nav
          className="sticky top-0 z-10 -mx-6 mt-6 overflow-x-auto border-b border-white/10 bg-[#0f1a14]/90 px-6 py-3 backdrop-blur-md"
          aria-label={t("admin.contentPageTitle")}
        >
          <div className="flex min-w-max gap-1.5 rounded-2xl border border-white/10 bg-black/25 p-1.5">
            {CONTENT_SUB_TABS.map(({ id, labelKey, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectContentSubTab(id)}
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-bold transition sm:px-4 ${
                  contentSubTab === id
                    ? "bg-forest-500/25 text-forest-100 shadow-sm"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icon size={16} className="shrink-0" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </nav>

        {contentSubTab === "media" ? (
          <div className="mt-6">
            <AdminMediaLibrary token={token} onAuthFailure={onAuthFailure} permissions={adminSession} embedded />
          </div>
        ) : (
          <form onSubmit={onSave} className={`mt-6 grid gap-4 ${!canEdit ? "pointer-events-none opacity-60" : ""}`}>
            {contentSubTab === "hero" && (
              <div className="rounded-2xl border border-forest-400/20 bg-forest-500/5 p-5">
                <h3 className="text-lg font-bold text-forest-100">{t("admin.heroContentTitle")}</h3>
                <p className="mt-1 text-sm text-white/60">{t("admin.heroContentHelp")}</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroBadgeEn")}</span>
                    <input
                      className={inputClass}
                      value={form.hero_badge_en}
                      onChange={(event) => patchForm({ hero_badge_en: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroBadgeAr")}</span>
                    <input
                      className={inputClass}
                      dir="rtl"
                      value={form.hero_badge_ar}
                      onChange={(event) => patchForm({ hero_badge_ar: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroTitleEn")}</span>
                    <input
                      className={inputClass}
                      value={form.hero_title_en}
                      onChange={(event) => patchForm({ hero_title_en: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroTitleAr")}</span>
                    <input
                      className={inputClass}
                      dir="rtl"
                      value={form.hero_title_ar}
                      onChange={(event) => patchForm({ hero_title_ar: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroSubtitleEn")}</span>
                    <textarea
                      className={inputClass}
                      rows={3}
                      value={form.hero_subtitle_en}
                      onChange={(event) => patchForm({ hero_subtitle_en: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroSubtitleAr")}</span>
                    <textarea
                      className={inputClass}
                      dir="rtl"
                      rows={3}
                      value={form.hero_subtitle_ar}
                      onChange={(event) => patchForm({ hero_subtitle_ar: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroCtaEn")}</span>
                    <input
                      className={inputClass}
                      value={form.hero_cta_en}
                      onChange={(event) => patchForm({ hero_cta_en: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroCtaAr")}</span>
                    <input
                      className={inputClass}
                      dir="rtl"
                      value={form.hero_cta_ar}
                      onChange={(event) => patchForm({ hero_cta_ar: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroNoteEn")}</span>
                    <input
                      className={inputClass}
                      value={form.hero_note_en}
                      onChange={(event) => patchForm({ hero_note_en: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white/75">{t("admin.heroNoteAr")}</span>
                    <input
                      className={inputClass}
                      dir="rtl"
                      value={form.hero_note_ar}
                      onChange={(event) => patchForm({ hero_note_ar: event.target.value })}
                    />
                  </label>
                </div>
              </div>
            )}

            {contentSubTab === "images" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <p className="font-bold text-white">{t("admin.heroBackgroundTitle")}</p>
                  <p className="mt-1 text-sm text-white/55">{t("admin.heroBackgroundHelp")}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {(["image", "video"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => patchForm({ hero_background_type: type })}
                        className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                          form.hero_background_type === type
                            ? "bg-forest-500/25 text-forest-100"
                            : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                        }`}
                      >
                        {type === "video" ? t("admin.heroBackgroundVideo") : t("admin.heroBackgroundImage")}
                      </button>
                    ))}
                  </div>
                  <div className="mt-4">
                    <AdminMediaField
                      label={t("admin.heroBackgroundMedia")}
                      help={t("admin.heroBackgroundMediaHelp")}
                      value={form.hero_background_url}
                      onChange={(url) => patchForm({ hero_background_url: url })}
                      mediaKind={form.hero_background_type === "video" ? "video" : "image"}
                      token={token}
                      inputClass={inputClass}
                    />
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <AdminMediaField
                    label={t("admin.heroSideImage")}
                    help={t("admin.heroSideImageHelp")}
                    value={form.hero_side_image_url}
                    onChange={(url) => patchForm({ hero_side_image_url: url })}
                    mediaKind="image"
                    token={token}
                    inputClass={inputClass}
                  />
                  <AdminMediaField
                    label={t("admin.whySectionImage")}
                    help={t("admin.whySectionImageHelp")}
                    value={form.why_image_url}
                    onChange={(url) => patchForm({ why_image_url: url })}
                    mediaKind="image"
                    token={token}
                    inputClass={inputClass}
                  />
                </div>
              </>
            )}

            {contentSubTab === "sections" && (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-lg font-bold text-white">{t("admin.availabilityContentTitle")}</h3>
                  <p className="mt-1 text-sm text-white/60">{t("admin.availabilityContentHelp")}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilityLiveEn")}</span>
                      <input
                        className={inputClass}
                        value={form.availability_live_en}
                        onChange={(event) => patchForm({ availability_live_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilityLiveAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.availability_live_ar}
                        onChange={(event) => patchForm({ availability_live_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilityTitleEn")}</span>
                      <input
                        className={inputClass}
                        value={form.availability_title_en}
                        onChange={(event) => patchForm({ availability_title_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilityTitleAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.availability_title_ar}
                        onChange={(event) => patchForm({ availability_title_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilitySubtitleEn")}</span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={form.availability_subtitle_en}
                        onChange={(event) => patchForm({ availability_subtitle_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.availabilitySubtitleAr")}</span>
                      <textarea
                        className={inputClass}
                        dir="rtl"
                        rows={2}
                        value={form.availability_subtitle_ar}
                        onChange={(event) => patchForm({ availability_subtitle_ar: event.target.value })}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-lg font-bold text-white">{t("admin.footerNavContentTitle")}</h3>
                  <p className="mt-1 text-sm text-white/60">{t("admin.footerNavContentHelp")}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.siteNameEn")}</span>
                      <input
                        className={inputClass}
                        value={form.site_name_en}
                        onChange={(event) => patchForm({ site_name_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.siteNameAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.site_name_ar}
                        onChange={(event) => patchForm({ site_name_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2 lg:col-span-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.footerTextEn")}</span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={form.footer_text_en}
                        onChange={(event) => patchForm({ footer_text_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2 lg:col-span-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.footerTextAr")}</span>
                      <textarea
                        className={inputClass}
                        dir="rtl"
                        rows={2}
                        value={form.footer_text_ar}
                        onChange={(event) => patchForm({ footer_text_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.navBookEn")}</span>
                      <input
                        className={inputClass}
                        value={form.nav_book_en}
                        onChange={(event) => patchForm({ nav_book_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.navBookAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.nav_book_ar}
                        onChange={(event) => patchForm({ nav_book_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.footerAdminEn")}</span>
                      <input
                        className={inputClass}
                        value={form.footer_admin_en}
                        onChange={(event) => patchForm({ footer_admin_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.footerAdminAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.footer_admin_ar}
                        onChange={(event) => patchForm({ footer_admin_ar: event.target.value })}
                      />
                    </label>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-lg font-bold text-white">{t("admin.howContentTitle")}</h3>
                  <p className="mt-1 text-sm text-white/60">{t("admin.howContentHelp")}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.howTitleEn")}</span>
                      <input
                        className={inputClass}
                        value={form.how_title_en}
                        onChange={(event) => patchForm({ how_title_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.howTitleAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.how_title_ar}
                        onChange={(event) => patchForm({ how_title_ar: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="mt-5 space-y-4">
                    {([1, 2, 3, 4] as const).map((step) => (
                      <div key={step} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-3 text-sm font-bold text-forest-200">{t("admin.howStepLabel", { step })}</p>
                        <div className="grid gap-3 lg:grid-cols-2">
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/60">{t("admin.howStepTitleEn")}</span>
                            <input
                              className={inputClass}
                              value={form[`how_step${step}_title_en` as keyof SiteContentForm] as string}
                              onChange={(event) =>
                                patchForm({ [`how_step${step}_title_en`]: event.target.value } as Partial<SiteContentForm>)
                              }
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/60">{t("admin.howStepTitleAr")}</span>
                            <input
                              className={inputClass}
                              dir="rtl"
                              value={form[`how_step${step}_title_ar` as keyof SiteContentForm] as string}
                              onChange={(event) =>
                                patchForm({ [`how_step${step}_title_ar`]: event.target.value } as Partial<SiteContentForm>)
                              }
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/60">{t("admin.howStepTextEn")}</span>
                            <textarea
                              className={inputClass}
                              rows={2}
                              value={form[`how_step${step}_text_en` as keyof SiteContentForm] as string}
                              onChange={(event) =>
                                patchForm({ [`how_step${step}_text_en`]: event.target.value } as Partial<SiteContentForm>)
                              }
                            />
                          </label>
                          <label className="block space-y-2">
                            <span className="text-xs font-semibold text-white/60">{t("admin.howStepTextAr")}</span>
                            <textarea
                              className={inputClass}
                              dir="rtl"
                              rows={2}
                              value={form[`how_step${step}_text_ar` as keyof SiteContentForm] as string}
                              onChange={(event) =>
                                patchForm({ [`how_step${step}_text_ar`]: event.target.value } as Partial<SiteContentForm>)
                              }
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <h3 className="text-lg font-bold text-white">{t("admin.sectionTitlesContentTitle")}</h3>
                  <p className="mt-1 text-sm text-white/60">{t("admin.sectionTitlesContentHelp")}</p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.vehiclesTitleEn")}</span>
                      <input
                        className={inputClass}
                        value={form.vehicles_title_en}
                        onChange={(event) => patchForm({ vehicles_title_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.vehiclesTitleAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.vehicles_title_ar}
                        onChange={(event) => patchForm({ vehicles_title_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.vehiclesSubtitleEn")}</span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={form.vehicles_subtitle_en}
                        onChange={(event) => patchForm({ vehicles_subtitle_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.vehiclesSubtitleAr")}</span>
                      <textarea
                        className={inputClass}
                        dir="rtl"
                        rows={2}
                        value={form.vehicles_subtitle_ar}
                        onChange={(event) => patchForm({ vehicles_subtitle_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.routesTitleEn")}</span>
                      <input
                        className={inputClass}
                        value={form.routes_title_en}
                        onChange={(event) => patchForm({ routes_title_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.routesTitleAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.routes_title_ar}
                        onChange={(event) => patchForm({ routes_title_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.routesSubtitleEn")}</span>
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={form.routes_subtitle_en}
                        onChange={(event) => patchForm({ routes_subtitle_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.routesSubtitleAr")}</span>
                      <textarea
                        className={inputClass}
                        dir="rtl"
                        rows={2}
                        value={form.routes_subtitle_ar}
                        onChange={(event) => patchForm({ routes_subtitle_ar: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.whyTitleEn")}</span>
                      <input
                        className={inputClass}
                        value={form.why_title_en}
                        onChange={(event) => patchForm({ why_title_en: event.target.value })}
                      />
                    </label>
                    <label className="block space-y-2">
                      <span className="text-sm font-semibold text-white/75">{t("admin.whyTitleAr")}</span>
                      <input
                        className={inputClass}
                        dir="rtl"
                        value={form.why_title_ar}
                        onChange={(event) => patchForm({ why_title_ar: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              </>
            )}

            {showSave && (
              <button type="submit" className="w-fit rounded-2xl bg-forest-500 px-6 py-3 font-bold text-white">
                {t("admin.contentSave")}
              </button>
            )}
          </form>
        )}
      </section>
    </div>
  );
}