import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface GetChargeItemDefinitionVersionParams {
  secrets: ZambdaInput['secrets'];
  resourceId: string;
  versionId: string;
}

const GetChargeItemDefinitionVersionBodySchema = z.object({
  resourceId: z.string().uuid(),
  versionId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetChargeItemDefinitionVersionParams {
  const raw = input.body ? safeJsonParse(input.body) : input;

  const { resourceId, versionId } = safeValidate(GetChargeItemDefinitionVersionBodySchema, raw);

  return {
    secrets: input.secrets,
    resourceId,
    versionId,
  };
}
