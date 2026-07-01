import {
  ExportInvoicesTasksCsvValidatedInput,
  ExportInvoicesTasksCsvZambdaInputSchema,
  GetExportInvoicesCsvStatusValidatedInput,
  GetExportInvoicesCsvStatusZambdaInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

export type ValidatedParams = ExportInvoicesTasksCsvValidatedInput | GetExportInvoicesCsvStatusValidatedInput;

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const parsedJSON = safeJsonParse(input.body) as Record<string, unknown>;

  // If taskId is present, this is a status check request
  if ('taskId' in parsedJSON && parsedJSON.taskId) {
    const parsedInput = safeValidate(GetExportInvoicesCsvStatusZambdaInputSchema, parsedJSON);
    return {
      ...parsedInput,
      secrets: input.secrets,
    };
  }

  // Otherwise, this is a kick-off request
  const parsedInput = safeValidate(ExportInvoicesTasksCsvZambdaInputSchema, parsedJSON);
  return {
    ...parsedInput,
    secrets: input.secrets,
  };
}
