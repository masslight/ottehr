import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { visitStatusArray, VisitStatusWithoutUnknown } from 'utils/lib/types/api/appointment.types';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
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
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { encounterId, updatedStatus } = safeValidate(ChangeVisitStatusBodySchema, safeJsonParse(input.body));

  getSecret(SecretsKeys.PROJECT_API, input.secrets);
  getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw NOT_AUTHORIZED;
  }

  return {
    encounterId,
    userToken,
    updatedStatus,
    secrets: input.secrets,
  };
}
