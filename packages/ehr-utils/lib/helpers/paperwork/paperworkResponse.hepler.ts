import { QuestionnaireResponse, QuestionnaireResponseItem, QuestionnaireResponseItemAnswer } from 'fhir/r4';
import { PRIVATE_EXTENSION_BASE_URL } from '../../types';

interface QuestionnaireResponseItemAnswerWithValueArray extends QuestionnaireResponseItemAnswer {
  valueArray?: Record<string, string>[];
}

interface QuestionnaireResponseItemWithValueArray extends QuestionnaireResponseItem {
  answer: QuestionnaireResponseItemAnswerWithValueArray[];
}

export const mapPaperworkResponseItem = (item: QuestionnaireResponseItem): QuestionnaireResponseItemWithValueArray => {
  if (item.extension) {
    return {
      ...item,
      answer: [
        ...(item.answer || []),
        {
          valueArray: item.extension
            .filter((extension) => extension.url === `${PRIVATE_EXTENSION_BASE_URL}/form-list-values`)
            .map((extension) => {
              return extension.extension!.reduce(
                (accumulator, currentValue) => {
                  const key = currentValue.extension!.find((extension) => extension.url === 'code')!.valueCode!;
                  const value = currentValue.extension!.find((extension) => extension.url === 'value')!.valueString!;
                  accumulator[key] = value;
                  return accumulator;
                },
                {} as Record<string, string>,
              );
            }),
        },
      ],
      extension: item.extension.filter(
        (extension) => extension.url != `${PRIVATE_EXTENSION_BASE_URL}/form-list-values`,
      ),
    };
  }
  return item as QuestionnaireResponseItemWithValueArray;
};

export enum QuestionnaireLinkIds {
  PREFERRED_LANGUAGE = 'preferred-language',
  ALLERGIES = 'allergies',
  REASON_FOR_VISIT = 'reason-for-visit',
  VITALS_TEMPERATURE = 'vitals-temperature',
  VITALS_PULSE = 'vitals-pulse',
  VITALS_HR = 'vitals-hr',
  VITALS_RR = 'vitals-rr',
  VITALS_BP = 'vitals-bp',
  MEDICAL_HISTORY = 'medical-history',
  SURGICAL_HISTORY = 'surgical-history',
  CURRENT_MEDICATION = 'current-medications',
  PATIENT_STREET_ADDRESS = 'patient-street-address',
  PATIENT_NUMBER = 'patient-number',
  GUARDIAN_NUMBER = 'guardian-number',
  RELAY_PHONE = 'relay-phone',
  CONSENT_FORMS = 'consent-forms',
}

export const getQuestionnaireResponseByLinkId = (
  linkId: string,
  questionnaireResponse?: QuestionnaireResponse,
): QuestionnaireResponseItemWithValueArray | undefined => {
  const item = questionnaireResponse?.item && questionnaireResponse.item.find((item) => item.linkId === linkId);
  return item && mapPaperworkResponseItem(item);
};
