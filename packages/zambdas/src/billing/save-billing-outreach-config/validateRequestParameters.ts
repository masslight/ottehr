import { INVOICE_OUTREACH_TRIGGER_EVENTS } from 'utils/lib/types/api/scheduled-outreach.types';
import { INVALID_INPUT_ERROR, MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import {
  SaveOutreachConfigInput,
  validateRequestParameters as validateSaveOutreachConfig,
} from '../../rcm/scheduled-outreach-config/save-scheduled-outreach-config/validateRequestParameters';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): SaveOutreachConfigInput {
  const params = validateSaveOutreachConfig(input);
  if (!isOutreachInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }
  const unsupported = params.actions.find((action) => !INVOICE_OUTREACH_TRIGGER_EVENTS.includes(action.trigger.event));
  if (unsupported) {
    throw INVALID_INPUT_ERROR(`Billing outreach does not support the trigger event '${unsupported.trigger.event}'`);
  }
  return params;
}
