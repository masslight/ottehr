import Oystehr from '@oystehr/sdk';
import { FhirResource, Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import ehrInsuranceUpdateQuestionnaire from '../../../../config/oystehr/ehr-insurance-update-questionnaire.json' assert { type: 'json' };
import inPersonIntakeQuestionnaire from '../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import inPersonIntakeQuestionnaireArchive from '../../../../config/oystehr/in-person-intake-questionnaire-archive.json' assert { type: 'json' };
import virtualIntakeQuestionnaire from '../../../../config/oystehr/virtual-intake-questionnaire.json' assert { type: 'json' };
import virtualIntakeQuestionnaireArchive from '../../../../config/oystehr/virtual-intake-questionnaire-archive.json' assert { type: 'json' };
import { BOOKING_CONFIG } from '../configuration';
import { CanonicalUrl } from '../types';

const questionnaires: Array<Questionnaire> = [
  ...Object.values(inPersonIntakeQuestionnaire.fhirResources).map((r) => r.resource as Questionnaire),
  ...Object.values(ehrInsuranceUpdateQuestionnaire.fhirResources).map((r) => r.resource as Questionnaire),
  ...Object.values(virtualIntakeQuestionnaire.fhirResources).map((r) => r.resource as Questionnaire),
  ...Object.values(virtualIntakeQuestionnaireArchive.fhirResources).map((r) => r.resource as Questionnaire),
  ...Object.values(inPersonIntakeQuestionnaireArchive.fhirResources).map((r) => r.resource as Questionnaire),
];

// throws an error if unable to find exactly 1 matching resource
export const getCanonicalQuestionnaire = async (
  canonical: CanonicalUrl,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const { url, version } = canonical;

  const maybeQuestionnaireFromFile = questionnaires.find((q) => q.url === url && q.version === version);
  // if we found the Q in the local file, return it
  if (maybeQuestionnaireFromFile) {
    return maybeQuestionnaireFromFile;
  }

  // otherwise, fetch from the FHIR server
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
  console.log('questionnaire search', JSON.stringify(questionnaireSearch));
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
    return BOOKING_CONFIG.intakeQuestionnaires.some((questionnaire) => questionnaire.url?.startsWith(questionnaireUrl));
  }) as QuestionnaireResponse | undefined;
};
