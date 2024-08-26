import { i18nextCreator } from 'ottehr-utils';
import * as englishStrings from '@translations/i18n-en.json';
import * as defaultEnglishStrings from '@defaultTranslations/i18n-en.json';
import * as spanishStrings from '@translations/i18n-es.json';
import * as defaultSpanishStrings from '@defaultTranslations/i18n-es.json';

const englishTranslation = JSON.stringify({ ...defaultEnglishStrings, ...englishStrings });
const spanishTranslation = JSON.stringify({ ...defaultSpanishStrings, ...spanishStrings });

interface Language {
  nativeName: string;
}

export const languages: { [key: string]: Language } = {
  en: { nativeName: 'English' },
  es: { nativeName: 'Español' },
};

const i18n = i18nextCreator({
  en: {
    translation: JSON.parse(englishTranslation),
  },
  es: {
    translation: JSON.parse(spanishTranslation),
  },
});

export default i18n;
