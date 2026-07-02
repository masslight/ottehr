import { APIGatewayProxyResult } from 'aws-lambda';
import {
  getSecret,
  ImportEraInput,
  ImportEraInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, safeValidate, validateJsonBody, wrapHandler, ZambdaInput } from '../../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'import-era';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);

  const projectApiUrl = getSecret(SecretsKeys.PROJECT_API, params.secrets);
  const response = await fetch(projectApiUrl + '/rcm/process-era', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${m2mToken}`,
      'x-zapehr-project-id': getSecret(SecretsKeys.PROJECT_ID, params.secrets),
    },
    body: JSON.stringify({
      edi835: params.era,
    }),
  });

  if (response.status != 200) {
    return { statusCode: response.status, body: await response.text() };
  }

  return { statusCode: 200, body: await response.text() };
});

interface ImportEraParams extends ImportEraInput {
  secrets: ZambdaInput['secrets'];
}

function validateRequestParameters(input: ZambdaInput): ImportEraParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const data = safeValidate(ImportEraInputSchema, validateJsonBody(input));

  return {
    ...data,
    secrets: input.secrets,
  };
}
