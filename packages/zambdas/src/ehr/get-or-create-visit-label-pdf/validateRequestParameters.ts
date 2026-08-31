import { GetVisitLabelInput } from 'utils/lib/types/common';
import { MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';

const GetVisitLabelBodySchema = z.object({
  encounterId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetVisitLabelInput & Pick<ZambdaInput, 'secrets'> {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsed = safeJsonParse(input.body);
  const { encounterId } = safeValidate(GetVisitLabelBodySchema, parsed);

  return {
    encounterId,
    secrets: input.secrets,
  };
}
