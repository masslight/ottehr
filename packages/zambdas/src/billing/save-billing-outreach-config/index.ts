import { APIGatewayProxyResult } from 'aws-lambda';
import { INVOICE_OUTREACH_TRIGGER_EVENTS } from 'utils/lib/types/api/scheduled-outreach.types';
import { BILLING_OUTREACH_TASK_CODE_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { INVALID_INPUT_ERROR, MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { saveOutreachConfig } from '../../rcm/scheduled-outreach-config/save-outreach-config';
import { validateRequestParameters } from '../../rcm/scheduled-outreach-config/save-scheduled-outreach-config/validateRequestParameters';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-outreach-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { actions, notificationsTimeRestriction, secrets } = validateRequestParameters(input);
  if (!isOutreachInBillingApp(secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }
  const unsupported = actions.find((action) => !INVOICE_OUTREACH_TRIGGER_EVENTS.includes(action.trigger.event));
  if (unsupported) {
    throw INVALID_INPUT_ERROR(`Billing outreach does not support the trigger event '${unsupported.trigger.event}'`);
  }

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
