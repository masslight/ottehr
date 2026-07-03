import {
  GenerateAdHocReportInput,
  GenerateAdHocReportInputSchema,
  INVALID_INPUT_ERROR,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  Secrets,
} from 'utils';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): GenerateAdHocReportInput & { secrets: Secrets } {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }
  if (!input.secrets) {
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
