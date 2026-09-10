import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { GetVitalsAlertConfigOutput } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { topLevelCatch } from '../../../shared/lambda';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getVitalsAlertConfigPayload } from '../../../shared/vitals-alert-config';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-vitals-alert-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started`);
  try {
    console.group('validateRequestParameters');
    const { secrets } = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    const response = await performEffect(oystehr);
    console.groupEnd();
    console.debug('performEffect success');

    return { statusCode: 200, body: JSON.stringify(response) };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const performEffect = async (oystehr: Oystehr): Promise<GetVitalsAlertConfigOutput> => {
  return await getVitalsAlertConfigPayload(oystehr);
};
