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

const i18n = i18nextCreator({
  en: {
    translation: JSON.parse(englishTranslation),
  },
  es: {
    translation: JSON.parse(spanishTranslation),
  },
});

export default i18n;
