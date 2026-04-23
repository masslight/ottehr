import {
  ExportInvoicesTasksCsvValidatedInput,
  ExportInvoicesTasksCsvZambdaInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): ExportInvoicesTasksCsvValidatedInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = JSON.parse(input.body) as unknown;
  const parsedInput = safeValidate(ExportInvoicesTasksCsvZambdaInputSchema, parsedJSON);

  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
