import { getSecret, SecretsKeys, visitStatusArray, VisitStatusWithoutUnknown } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { ChangeInPersonVisitStatusInputValidated } from '.';

const validStatuses = visitStatusArray.filter((s) => s !== 'unknown') as [
  VisitStatusWithoutUnknown,
  ...VisitStatusWithoutUnknown[],
];

const ChangeVisitStatusBodySchema = z.object({
  encounterId: z.string(),
  updatedStatus: z.enum(validStatuses),
});

export function validateRequestParameters(input: ZambdaInput): ChangeInPersonVisitStatusInputValidated {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { encounterId, updatedStatus } = safeValidate(ChangeVisitStatusBodySchema, JSON.parse(input.body));

  if (!input.secrets) {
    throw new Error('No secrets provided');
  }

  getSecret(SecretsKeys.PROJECT_API, input.secrets);
  getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('No user token provided in Authorization header');
  }

  return {
    encounterId,
    userToken,
    updatedStatus,
    secrets: input.secrets,
  };
}
