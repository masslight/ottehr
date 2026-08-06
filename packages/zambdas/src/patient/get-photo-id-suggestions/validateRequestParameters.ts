import { GetPhotoIdSuggestionsInput } from 'utils/lib/types/api/get-photo-id-suggestions.types';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const bodySchema = z.object({
  appointmentID: z.string().uuid(),
  fileURL: z.string().url(),
  fileContentType: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetPhotoIdSuggestionsInput & {
  secrets: Secrets | null;
} {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { appointmentID, fileURL, fileContentType } = safeValidate(bodySchema, parsed);

  return { appointmentID, fileURL, fileContentType, secrets: input.secrets };
}
