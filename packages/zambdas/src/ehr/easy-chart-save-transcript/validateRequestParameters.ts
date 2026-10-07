import { SaveTranscriptRequestSchema } from 'utils/lib/easy-chart/api';
import { Secrets } from 'utils/lib/secrets';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';

export function validateRequestParameters(
  input: ZambdaInput
): z.output<typeof SaveTranscriptRequestSchema> & { secrets: Secrets } {
  return validateWithSchema(SaveTranscriptRequestSchema, input);
}
