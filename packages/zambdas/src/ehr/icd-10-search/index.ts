import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { searchIcd10Codes } from '../../shared/icd-10-search';

interface Icd10SearchResponse {
  codes: Array<{
    code: string;
    display: string;
  }>;
}

interface Icd10SearchRequestParams {
  search: string;
}

function validateRequestParameters(input: ZambdaInput): Icd10SearchRequestParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { search } = JSON.parse(input.body);

  if (!search || typeof search !== 'string') {
    throw INVALID_INPUT_ERROR('search parameter is required and must be a string');
  }

  if (search.trim().length === 0) {
    throw INVALID_INPUT_ERROR('search parameter cannot be empty');
  }

  return {
    search: search.trim(),
  };
}

const ZAMBDA_NAME = 'icd-10-search';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { search } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    console.group('searchIcd10Codes');
    const codes = await searchIcd10Codes(search);
    console.groupEnd();
    console.debug('searchIcd10Codes success');

    const response: Icd10SearchResponse = {
      codes,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
