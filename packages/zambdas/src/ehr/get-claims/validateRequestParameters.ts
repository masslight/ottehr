import { ClaimsQueueGetRequest, ClaimsQueueItemStatuses, getSecret, SecretsKeys } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const GetClaimsBodySchema = z.object({
  patient: z.string().optional(),
  visitId: z.string().uuid().optional(),
  claimId: z.string().uuid().optional(),
  teamMember: z.string().optional(),
  queue: z.string().optional(),
  dayInQueue: z.number().optional(),
  status: z.enum(ClaimsQueueItemStatuses).optional(),
  state: z.string().optional(),
  facilityGroup: z.string().optional(),
  facility: z.string().optional(),
  insurance: z.string().optional(),
  balance: z.number().optional(),
  dosFrom: z.string().optional(),
  dosTo: z.string().optional(),
  offset: z.number().int().min(0).optional(),
  pageSize: z.number().int().min(1).optional(),
});

export function validateRequestParameters(input: ZambdaInput): ClaimsQueueGetRequest & Pick<ZambdaInput, 'secrets'> {
  getSecret(SecretsKeys.PROJECT_API, input.secrets);

  if (input.body) {
    const parsedJSON = JSON.parse(input.body) as unknown;
    const data = safeValidate(GetClaimsBodySchema, parsedJSON);
    return {
      secrets: input.secrets,
      ...data,
    };
  } else return { secrets: input.secrets };
}
