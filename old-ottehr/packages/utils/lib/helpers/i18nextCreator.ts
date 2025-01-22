import i18next, { Resource, i18n } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

export const i18nextCreator = (resources?: Resource): i18n => {
  i18next
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      fallbackLng: 'en',
      parseMissingKeyHandler: (key: string) => `No translation found for "${key}"`,
      resources: resources,
      returnNull: false,
    })
    .catch((error: any) => {
      throw new Error(error.message);
    });

  return i18next;
};
