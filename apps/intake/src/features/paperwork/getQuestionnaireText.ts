import { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

// Questionnaire content (question/section text, page titles, info tooltips, consent
// labels, display blocks) is authored in the FHIR Questionnaire, which is the source
// of the English copy. To make it localizable without duplicating it into a second
// store, we resolve each string through the i18n layer keyed by the item's stable
// linkId, falling back to the questionnaire-provided text whenever no translation
// exists for the active language. This keeps English (and any not-yet-translated
// language) rendering exactly as today while allowing Spanish — or any future
// language — to be supplied under the `questionnaire` namespace.
const QUESTIONNAIRE_NS = 'questionnaire';

const buildKey = (linkId: string, suffix?: string): string =>
  suffix ? `${QUESTIONNAIRE_NS}.${linkId}.${suffix}` : `${QUESTIONNAIRE_NS}.${linkId}`;

export const translateQuestionnaireText = (
  t: TFunction,
  linkId: string | undefined,
  text: string | undefined,
  suffix?: string
): string | undefined => {
  if (text == null || linkId == null) {
    return text;
  }
  // Disable i18next key/namespace separators so that option values (which may
  // contain '.', ':' or '/') are treated as a single flat key rather than being
  // split into nested lookups.
  return t(buildKey(linkId, suffix), { defaultValue: text, keySeparator: false, nsSeparator: false });
};

export type QuestionnaireTextTranslator = (
  linkId: string | undefined,
  text: string | undefined,
  suffix?: string
) => string | undefined;

// Hook variant for use inside components; resolves against the active language and
// re-renders on language change.
export const useQuestionnaireText = (): QuestionnaireTextTranslator => {
  const { t } = useTranslation();
  return (linkId, text, suffix) => translateQuestionnaireText(t, linkId, text, suffix);
};
