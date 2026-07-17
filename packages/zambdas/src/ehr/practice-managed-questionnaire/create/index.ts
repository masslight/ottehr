import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { PracticeManagedQuestionnaireCreateOutput } from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateQuestionnaireUniqueness, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'practice-managed-questionnaire-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  const validatedParameters = validateRequestParameters(input);

  const { questionnaire, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // confirm there is no existing questionnaire with url|version
  await validateQuestionnaireUniqueness(questionnaire, oystehr);

  const created = await oystehr.fhir.create<Questionnaire>(questionnaire);

  const response: PracticeManagedQuestionnaireCreateOutput = {
    questionnaireId: created.id,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
