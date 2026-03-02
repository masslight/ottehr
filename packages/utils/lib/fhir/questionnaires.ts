import Oystehr from '@oystehr/sdk';
import { FhirResource, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE, VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE } from '../ottehr-config';
import { CanonicalUrl } from '../types';

// throws an error if unable to find exactly 1 matching resource
export const getCanonicalQuestionnaire = async (
  canonical: CanonicalUrl,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const { url, version } = canonical;

  // Check if the canonical matches one of the intake questionnaires from config
  // If so, return it directly to save a network request
  const intakeQuestionnaires = [IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(), VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()];
  const matchingIntakeQuestionnaire = intakeQuestionnaires.find((q) => q.url === url && q.version === version);
  if (matchingIntakeQuestionnaire) {
    console.log('returning intake questionnaire from config', url, version);
    return matchingIntakeQuestionnaire;
  }

  console.log('fetching questionnaire from FHIR server', url, version);
  const questionnaireSearch = (
    await oystehrClient.fhir.search<Questionnaire>({
      resourceType: 'Questionnaire',
      params: [
        {
          name: 'url',
          value: url,
        },
        {
          name: 'version',
          value: version,
        },
      ],
    })
  ).unbundle();
  // if we do not get exactly one result, throw an error
  if (questionnaireSearch.length < 1) {
    throw new Error(`Could not find questionnaire with canonical url ${url}|${version}`);
  } else if (questionnaireSearch.length > 1) {
    throw new Error(`Found multiple Questionnaires with same canonical url: ${url}|${version}`);
  }
  const questionnaire: Questionnaire | undefined = questionnaireSearch[0];
  if (!questionnaire.id) {
    throw new Error('Questionnaire does not have ID');
  }
  if (!questionnaire.url) {
    throw new Error('Questionnaire does not have a url');
  }
  if (!questionnaire.version) {
    throw new Error('Questionnaire does not have a version');
  }
  return questionnaire;
};

export const selectIntakeQuestionnaireResponse = (resources: FhirResource[]): QuestionnaireResponse | undefined => {
  return resources.find((res) => {
    if (res.resourceType !== 'QuestionnaireResponse') {
      return false;
    }
    const qr = res as QuestionnaireResponse;
    const questionnaireUrl = qr.questionnaire;
    if (!questionnaireUrl) {
      return false;
    }
    return [IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE(), VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()].some(
      (questionnaire: Questionnaire) => questionnaireUrl.startsWith(questionnaire.url!)
    );
  }) as QuestionnaireResponse | undefined;
};
