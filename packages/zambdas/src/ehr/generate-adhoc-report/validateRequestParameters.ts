import { Secrets } from 'utils/lib/secrets';
import {
  GenerateAdHocReportInput,
  GenerateAdHocReportInputSchema,
  GetAdHocGenerationStatusInput,
  GetAdHocGenerationStatusInputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse } from '../../shared/validation';

export type ValidatedParams =
  | (GenerateAdHocReportInput & { secrets: Secrets })
  | (GetAdHocGenerationStatusInput & { secrets: Secrets });

export function validateRequestParameters(input: ZambdaInput): ValidatedParams {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const body: unknown = safeJsonParse(input.body);

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw INVALID_INPUT_ERROR('Request body must be a JSON object');
  }

  // A body with taskId polls a generation started earlier (an empty taskId is rejected, not treated as
  // a new generation); anything else starts a new one.
  // The Zod input schemas are the endpoint's single source of truth (they also derive the TS types).
  const parsed =
    'taskId' in body
      ? GetAdHocGenerationStatusInputSchema.safeParse(body)
      : GenerateAdHocReportInputSchema.safeParse(body);

  if (!parsed.success) {
    throw INVALID_INPUT_ERROR(
      parsed.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ')
    );
  }

  return { ...parsed.data, secrets: input.secrets };
}
