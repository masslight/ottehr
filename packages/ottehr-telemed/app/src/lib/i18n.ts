import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import * as englishStrings from './i18n-en.json';
import * as spanishStrings from './i18n-es.json';

const englishTranslation = JSON.stringify(englishStrings);
const spanishTranslation = JSON.stringify(spanishStrings);

interface Language {
  nativeName: string;
}

export const languages: { [key: string]: Language } = {
  en: { nativeName: 'English' },
  es: { nativeName: 'Español' },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    parseMissingKeyHandler: (key: string) => `No translation found for "${key}"`,
    resources: {
      en: {
        translation: JSON.parse(englishTranslation),
      },
      es: {
        translation: JSON.parse(spanishTranslation),
      },
    },
    returnNull: false,
  })
  .catch((error: any) => {
    throw new Error(error.message);
  });

export default i18n;
