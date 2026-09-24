import { APIGatewayProxyResult } from 'aws-lambda';
import { VITALS_ALERT_CONFIG_EDIT_ROLES } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { checkOrCreateM2MClientToken, getUserToken, requireUserWithRole } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { saveVitalsAlertConfig } from '../../../shared/vitals-alert-config';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'admin-update-vitals-alert-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { config, secrets } = validateRequestParameters(input);

  await requireUserWithRole(getUserToken(input), secrets, VITALS_ALERT_CONFIG_EDIT_ROLES);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await saveVitalsAlertConfig(oystehr, config);

  return { statusCode: 204, body: '' };
});
