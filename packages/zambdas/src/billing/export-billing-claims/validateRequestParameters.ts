import {
  ExportBillingClaimsInput,
  ExportBillingClaimsInputSchema,
  GetBillingClaimsExportStatusInput,
  GetBillingClaimsExportStatusInputSchema,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
} from 'utils';
import { safeValidate, validateJsonBody, ZambdaInput } from '../../shared';

export type ExportBillingClaimsParams = (ExportBillingClaimsInput | GetBillingClaimsExportStatusInput) & {
  secrets: ZambdaInput['secrets'];
};

export function validateRequestParameters(input: ZambdaInput): ExportBillingClaimsParams {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = validateJsonBody(input);

  // A body carrying a taskId is asking after an export already under way; anything else starts one.
  if (body?.taskId) {
    return {
      ...safeValidate(GetBillingClaimsExportStatusInputSchema, body),
      secrets: input.secrets,
    };
  }

  return {
    ...safeValidate(ExportBillingClaimsInputSchema, body),
    secrets: input.secrets,
  };
}
