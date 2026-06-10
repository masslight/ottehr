import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';

export interface GetVersionHistoryParams {
  secrets: ZambdaInput['secrets'];
  resourceId: string;
}

const GetVersionHistoryBodySchema = z.object({
  resourceId: z.string().uuid(),
});

export function validateRequestParameters(input: ZambdaInput): GetVersionHistoryParams {
  const raw = input.body ? JSON.parse(input.body) : input;

  const { resourceId } = safeValidate(GetVersionHistoryBodySchema, raw);

  return {
    secrets: input.secrets,
    resourceId,
  };
}
