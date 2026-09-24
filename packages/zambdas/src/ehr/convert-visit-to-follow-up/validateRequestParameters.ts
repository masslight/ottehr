import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { z } from 'zod';
import { ZambdaInput } from '../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../shared/validation';
import { ConvertVisitToFollowUpInputValidated } from '.';

const ConvertVisitToFollowUpBodySchema = z.object({
  encounterId: z.string().min(1),
  parentEncounterId: z.string().min(1),
  skipPatientDiagnosis: z.boolean().optional(),
});

export function validateRequestParameters(input: ZambdaInput): ConvertVisitToFollowUpInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  const { encounterId, parentEncounterId, skipPatientDiagnosis } = safeValidate(
    ConvertVisitToFollowUpBodySchema,
    safeJsonParse(input.body)
  );

  getSecret(SecretsKeys.PROJECT_API, input.secrets);
  getSecret(SecretsKeys.ORGANIZATION_ID, input.secrets);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw NOT_AUTHORIZED;
  }

  return {
    encounterId,
    parentEncounterId,
    skipPatientDiagnosis,
    userToken,
    secrets: input.secrets,
  };
}
