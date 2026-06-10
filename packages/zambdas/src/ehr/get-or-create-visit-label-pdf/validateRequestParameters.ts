import { GetVisitLabelInput, MISSING_REQUEST_BODY } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const GetVisitLabelBodySchema = z.object({
  encounterId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetVisitLabelInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = JSON.parse(input.body);
  const { encounterId } = safeValidate(GetVisitLabelBodySchema, parsed);

  return {
    encounterId,
    secrets: input.secrets,
  };
}
