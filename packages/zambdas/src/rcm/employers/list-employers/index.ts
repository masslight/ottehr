import { APIGatewayProxyResult } from 'aws-lambda';
import { Organization } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { EMPLOYER_ORG_TYPE_CODE, EMPLOYER_ORG_TYPE_SYSTEM } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('list-employers', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const results = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'type',
          value: `${EMPLOYER_ORG_TYPE_SYSTEM}|${EMPLOYER_ORG_TYPE_CODE}`,
        },
      ],
    });

    const employers = results.unbundle();

    return {
      statusCode: 200,
      body: JSON.stringify(employers),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('list-employers', error, ENVIRONMENT);
  }
});
