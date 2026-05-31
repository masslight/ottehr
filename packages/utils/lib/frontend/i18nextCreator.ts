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
      // Intentionally no parseMissingKeyHandler: a missing key must fall back to the
      // provided defaultValue (e.g. the English questionnaire text) rather than render a
      // "No translation found" placeholder to the user. With `debug` enabled, i18next still
      // logs missing keys to the console, and the questionnaire-translation-coverage contract
      // test guards completeness.
      resources: resources,
    })
    .catch((error) => {
      console.error('i18next initialization failed:', error);
    });

  return i18next;
};
