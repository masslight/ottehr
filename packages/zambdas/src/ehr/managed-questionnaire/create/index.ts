import { APIGatewayProxyResult } from 'aws-lambda';
import { Questionnaire } from 'fhir/r4b';
import { ManagedQuestionnaireCreateOutput } from 'utils';
import { checkOrCreateM2MClientToken } from '../../../shared';
import { createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'managed-questionnaire-create';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { questionnaire, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  const created = await oystehr.fhir.create<Questionnaire>(questionnaire);

  const response: ManagedQuestionnaireCreateOutput = {
    questionnaireId: created.id,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
