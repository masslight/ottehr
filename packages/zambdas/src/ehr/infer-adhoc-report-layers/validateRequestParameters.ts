import { InferAdHocLayersInput, InferAdHocLayersInputSchema, MISSING_REQUEST_SECRETS, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): InferAdHocLayersInput & { secrets: Secrets } {
  const parsed = validateWithSchema(InferAdHocLayersInputSchema, input);

  const { GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_API_KEY } = parsed.secrets;

  if (!GOOGLE_CLOUD_PROJECT_ID || !GOOGLE_CLOUD_API_KEY) {
    throw MISSING_REQUEST_SECRETS;
  }

  return parsed;
}
