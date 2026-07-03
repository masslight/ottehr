import {
  getSecret,
  MISSING_REQUEST_BODY,
  MISSING_REQUEST_SECRETS,
  NOT_AUTHORIZED,
  SecretsKeys,
  visitStatusArray,
  VisitStatusWithoutUnknown,
} from 'utils';
import { z } from 'zod';
import { safeJsonParse, safeValidate, ZambdaInput } from '../../shared';
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
