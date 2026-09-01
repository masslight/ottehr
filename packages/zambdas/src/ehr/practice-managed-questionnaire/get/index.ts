import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { SYSTEM_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { fhirQuestionnaireToPracticeManaged } from 'utils/lib/helpers/practice-managed-questionnaires';
import { isSystemManagedQ } from 'utils/lib/helpers/system-managed-questionnaires';
import { PracticeManagedQuestionnaire } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { ManagedQuestionnaireGetOutput } from 'utils/lib/types/data/system-managed-questionnaires/system-managed-questionnaire.types';
import { MANAGED_QUESTIONNAIRE_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { compareVersions } from '../../../shared/fhir';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateQisPracticeManaged } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-get';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const questionnaireId = validatedParameters.questionnaireId;
  console.log('searching for questionnaire');
  const response = await getQuestionnaire(oystehr, questionnaireId);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function getQuestionnaire(oystehr: Oystehr, questionnaireId: string): Promise<ManagedQuestionnaireGetOutput> {
  const questionnaire = await oystehr.fhir.get<Questionnaire>({ resourceType: 'Questionnaire', id: questionnaireId });

  // System-managed forms carry logic the practice-managed parser cannot represent, so return the raw
  // FHIR resource(s) instead of parsing into a PracticeManagedQuestionnaire.
  if (isSystemManagedQ(questionnaire)) {
    const draft = await findDraftForUrl(oystehr, questionnaire.url);
    return {
      isSystemManaged: true,
      questionnaire,
      draft,
    };
  }

  validateQisPracticeManaged(questionnaire, questionnaireId);

  let practiceManagedQuestionnaire: PracticeManagedQuestionnaire | undefined;
  try {
    practiceManagedQuestionnaire = fhirQuestionnaireToPracticeManaged(questionnaire);
  } catch (e) {
    throw MANAGED_QUESTIONNAIRE_ERROR(`Questionnaire has attributes the admin portal cannot process. ${e}`);
  }

  return {
    isSystemManaged: false,
    practiceManagedQuestionnaire,
  };
}

/** Finds the highest-version draft (status: draft, system-managed tag) sharing the given canonical url. */
async function findDraftForUrl(oystehr: Oystehr, url: string | undefined): Promise<Questionnaire | null> {
  if (!url) return null;

  const { system, code } = SYSTEM_MANAGED_QUESTIONNAIRE_TAG;
  const params: SearchParam[] = [
    { name: 'url', value: url },
    { name: 'status', value: 'draft' },
    { name: '_tag', value: `${system}|${code}` },
  ];

  const drafts = (await oystehr.fhir.search<Questionnaire>({ resourceType: 'Questionnaire', params })).unbundle();
  if (drafts.length === 0) return null;

  return drafts.reduce((latest, q) =>
    compareVersions(q.version ?? '0.0.0', latest.version ?? '0.0.0') > 0 ? q : latest
  );
}
