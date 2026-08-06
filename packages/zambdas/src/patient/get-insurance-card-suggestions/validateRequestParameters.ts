import { Secrets } from 'utils/lib/secrets';
import { GetInsuranceCardSuggestionsInput } from 'utils/lib/types/api/get-insurance-card-suggestions.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
  fileURL: z.string().url(),
  fileContentType: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetInsuranceCardSuggestionsInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, fileURL, fileContentType } = safeValidate(bodySchema, parsed);

  return { appointmentID, fileURL, fileContentType, secrets: input.secrets };
}
