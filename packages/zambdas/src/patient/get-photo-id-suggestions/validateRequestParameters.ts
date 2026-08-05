import { GetPhotoIdSuggestionsInput, MISSING_REQUEST_BODY, Secrets } from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';

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
