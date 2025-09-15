import Oystehr from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import inPersonIntakeQuestionnaire from '../../../../config/oystehr/in-person-intake-questionnaire.json' assert { type: 'json' };
import { CanonicalUrl } from '../types';

// throws an error if unable to find exactly 1 matching resource
export const getCanonicalQuestionnaire = async (
  canonical: CanonicalUrl,
  oystehrClient: Oystehr
): Promise<Questionnaire> => {
  const { url, version } = canonical;
  if (url === 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson') {
    const questionnaire = inPersonIntakeQuestionnaire.fhirResources[
      'questionnaire-in-person-previsit'
    ] as Questionnaire;
    questionnaire.id = '3833c319-8689-42a4-bf90-c5fc10ca5856';
    return questionnaire;
  }
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
