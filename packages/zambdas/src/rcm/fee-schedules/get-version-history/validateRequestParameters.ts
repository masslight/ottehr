import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';

export interface GetVersionHistoryParams {
  secrets: ZambdaInput['secrets'];
  resourceId: string;
}

const GetVersionHistoryBodySchema = z.object({
  resourceId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetVersionHistoryParams {
  const raw = input.body ? safeJsonParse(input.body) : input;

  const { resourceId } = safeValidate(GetVersionHistoryBodySchema, raw);

  return {
    secrets: input.secrets,
    resourceId,
  };
}
