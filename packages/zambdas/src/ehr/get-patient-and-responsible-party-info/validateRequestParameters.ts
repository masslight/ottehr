import { z } from 'zod';
import { ZambdaInput } from '../../shared';

export function validateRequestParameters(input: ZambdaInput): { patientId: string } & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  if (input.secrets == null) {
    throw new Error('No secrets provided');
  }

  const parsedJSON = JSON.parse(input.body);
  const schema = z.object({
    patientId: z.string(),
  });
  const { patientId } = schema.parse(parsedJSON);

  return {
    patientId,
    secrets: input.secrets,
  };
}
