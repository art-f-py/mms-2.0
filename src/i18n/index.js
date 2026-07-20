import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

// Idiomas disponíveis (código i18next + rótulo curto para o seletor no header)
export const LANGUAGES = [
  { code: "pt-BR", label: "PT" },
  { code: "en",    label: "EN" },
  { code: "es",    label: "ES" },
];

// Chave usada no localStorage para persistir a escolha de idioma.
export const LANGUAGE_STORAGE_KEY = "mms2-language";

i18n
  // Detecta o idioma APENAS a partir do localStorage — nunca do navegador.
  // Sem valor salvo, cai no fallbackLng (pt-BR): o padrão é sempre português
  // na primeira visita. changeLanguage() persiste a escolha (caches).
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
      en:      { translation: en },
      es:      { translation: es },
    },
    fallbackLng: "pt-BR",
    supportedLngs: ["pt-BR", "en", "es"],
    detection: {
      order: ["localStorage"],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
