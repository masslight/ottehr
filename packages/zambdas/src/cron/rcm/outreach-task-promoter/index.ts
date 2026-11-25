import { APIGatewayProxyResult } from 'aws-lambda';
import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { promoteDueOutreachTasks } from './promote-outreach-tasks';

let m2mToken: string;

const ZAMBDA_NAME = 'cron-outreach-task-promoter';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  if (!input.secrets) throw new Error('Secrets are not defined');

  if (!FEATURE_FLAGS_CONFIG.automatedPatientOutreachEnabled) {
    console.log(`${ZAMBDA_NAME}: automatedPatientOutreachEnabled is disabled, skipping`);
    return { statusCode: 200, body: JSON.stringify({ promoted: 0, blocked: 0, total: 0, disabled: true }) };
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);

  const result = await promoteDueOutreachTasks(oystehr);
  return { statusCode: 200, body: JSON.stringify(result) };
});
