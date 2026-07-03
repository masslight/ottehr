import { InferAdHocLayersInput, InferAdHocLayersInputSchema, Secrets } from 'utils';
import { ZambdaInput } from '../../shared';
import { validateWithSchema } from '../../shared/validate-zod';

export function validateRequestParameters(input: ZambdaInput): InferAdHocLayersInput & { secrets: Secrets } {
  return validateWithSchema(InferAdHocLayersInputSchema, input);
}
