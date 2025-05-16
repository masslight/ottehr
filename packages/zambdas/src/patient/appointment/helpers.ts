import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { CanonicalUrl, getCanonicalQuestionnaire, getSecret, Secrets, SecretsKeys, ServiceMode } from 'utils';

export const getCurrentQuestionnaireForServiceType = async (
  serviceMode: ServiceMode,
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const canonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode, secrets);
  return getCanonicalQuestionnaire(canonical, oystehrClient);
};

export const getCanonicalUrlForPrevisitQuestionnaire = (
  serviceMode: ServiceMode,
  secrets: Secrets | null
): CanonicalUrl => {
  let secretKey = '';
  if (serviceMode === 'in-person') {
    secretKey = SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE;
  } else if (serviceMode === 'virtual') {
    secretKey = SecretsKeys.VIRTUAL_PREVISIT_QUESTIONNAIRE;
  }
  const questionnaireCanonURL = getSecret(secretKey, secrets);
  // todo: move this into some kind of util function
  const [questionnaireURL, questionnaireVersion] = questionnaireCanonURL.split('|');
  if (!questionnaireURL || !questionnaireVersion) {
    throw new Error('Questionnaire url secret missing or malformed');
  }
  return {
    url: questionnaireURL,
    version: questionnaireVersion,
  };
};
