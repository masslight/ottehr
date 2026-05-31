// cSpell:ignore Español
import { i18nextCreator } from 'utils/lib/frontend';
import englishStrings from './i18n-en.json';
import spanishStrings from './i18n-es.json';

// Default-import the JSON so that ALL keys (including flat, dotted keys such as
// `questionnaire.<linkId>.option.<value>`) are preserved at the top level of the
// translation resource. A namespace import (`import * as`) only re-exports
// valid-identifier top-level keys, which would drop the dotted questionnaire keys.
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
