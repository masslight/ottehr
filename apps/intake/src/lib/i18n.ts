// cSpell:ignore Español
import { i18nextCreator } from 'utils';
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

const REACT_APP_IS_LOCAL = Boolean(import.meta.env.VITE_APP_IS_LOCAL);

const i18n = i18nextCreator(
  {
    en: {
      translation: JSON.parse(englishTranslation),
    },
    es: {
      translation: JSON.parse(spanishTranslation),
    },
  },
  REACT_APP_IS_LOCAL
);

export default i18n;
