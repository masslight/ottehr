// cSpell:ignore languagedetector
import i18next, { i18n, Resource } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const i18nextCreator = (resources?: Resource, debug = false): i18n => {
  i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      debug,
      ...(debug && {
        parseMissingKeyHandler: (key: string) => `No translation found for "${key}"`,
      }),
      resources: resources,
    }).catch;

  return i18next;
};
