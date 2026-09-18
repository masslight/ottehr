import { APIGatewayProxyResult } from 'aws-lambda';
import { VITALS_ALERT_CONFIG_VIEW_ROLES } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getVitalsAlertConfigPayload } from '../../../shared/vitals-alert-config';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'get-vitals-alert-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, VITALS_ALERT_CONFIG_VIEW_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const config = await getVitalsAlertConfigPayload(oystehr);

  return { statusCode: 200, body: JSON.stringify(config) };
});
