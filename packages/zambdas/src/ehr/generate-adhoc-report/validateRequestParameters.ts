import { Secrets } from 'utils/lib/secrets';
import {
  GenerateAdHocReportInput,
  GenerateAdHocReportInputSchema,
} from 'utils/lib/types/adhoc/generation/generate.types';
import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';

export function validateRequestParameters(input: ZambdaInput): GenerateAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } = input.secrets;

  if (!GOOGLE_CLOUD_PROJECT_ID || !GOOGLE_CLOUD_API_KEY) {
    throw MISSING_REQUEST_SECRETS;
  }

  // The Zod input schema is the endpoint's single source of truth (it also derives the TS type).
  const parsed = GenerateAdHocReportInputSchema.safeParse(JSON.parse(input.body));
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
