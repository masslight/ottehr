import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { PracticeManagedQuestionnaireCreateOutput } from 'utils/lib/types/data/practice-managed-questionnaires/practice-managed-questionnaire.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { ensureUniqueQuestionnaire, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { questionnaire, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // if a questionnaire with url|version already exists, the url is made unique with a random suffix
  const questionnaireToCreate = await ensureUniqueQuestionnaire(questionnaire, oystehr);

  const created = await oystehr.fhir.create<Questionnaire>(questionnaireToCreate);

  const response: PracticeManagedQuestionnaireCreateOutput = {
    questionnaireId: created.id,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
