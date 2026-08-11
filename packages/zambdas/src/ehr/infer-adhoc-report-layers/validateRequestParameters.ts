import { Secrets } from 'utils/lib/secrets';
import { InferAdHocLayersInput, InferAdHocLayersInputSchema } from 'utils/lib/types/adhoc/generation/infer.types';
import { MISSING_REQUEST_SECRETS } from 'utils/lib/types/errors';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): InferAdHocLayersInput & { secrets: Secrets } {
  const parsed = validateWithSchema(InferAdHocLayersInputSchema, input);

  const { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } = parsed.secrets;

  if (!GOOGLE_CLOUD_PROJECT_ID || !GOOGLE_CLOUD_API_KEY) {
    throw MISSING_REQUEST_SECRETS;
  }

  return parsed;
}
