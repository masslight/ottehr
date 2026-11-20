import { APIGatewayProxyResult } from 'aws-lambda';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { saveOutreachConfig } from '../../rcm/scheduled-outreach-config/save-outreach-config';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-outreach-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { actions, notificationsTimeRestriction, secrets } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const response = await saveOutreachConfig(
    oystehr,
    actions,
    notificationsTimeRestriction,
    BILLING_OUTREACH_TASK_CODE_SYSTEM
  );
  return { statusCode: 200, body: JSON.stringify(response) };
});
