import { SendBillingInvoiceSmsInputSchema } from 'utils/lib/types/api/invoicing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

export type SendBillingInvoiceSmsParams = ValidatedZambdaInput<typeof SendBillingInvoiceSmsInputSchema>;

export function validateRequestParameters(input: ZambdaInput): SendBillingInvoiceSmsParams {
  const params = validateWithSchema(SendBillingInvoiceSmsInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }
  return params;
}
