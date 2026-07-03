import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./i18n/locales/en.json";
import ar from "./i18n/locales/ar.json";

const savedLanguage = localStorage.getItem("khareef-language") || "en";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ar: { translation: ar }
  },
  lng: savedLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

i18n.on("languageChanged", (language) => {
  localStorage.setItem("khareef-language", language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
});

document.documentElement.lang = savedLanguage;
document.documentElement.dir = savedLanguage === "ar" ? "rtl" : "ltr";

export default i18n;
