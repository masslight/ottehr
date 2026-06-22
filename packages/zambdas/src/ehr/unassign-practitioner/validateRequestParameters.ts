import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, NOT_AUTHORIZED } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';
import { UnassignPractitionerZambdaInputValidated } from '.';

const CodingSchema = z
  .object({
    code: z.string().optional(),
    display: z.string().optional(),
    system: z.string().optional(),
  })
  .passthrough();

const UnassignPractitionerSchema = z.object({
  encounterId: z.string().uuid(),
  practitionerId: z.string().uuid(),
  userRole: z.array(CodingSchema),
});

export function validateRequestParameters(input: ZambdaInput): UnassignPractitionerZambdaInputValidated {
  console.group('validateRequestParameters');

  if (!input.secrets) {
    throw MISSING_REQUEST_SECRETS;
  }

  if (!input.headers.Authorization) {
    throw NOT_AUTHORIZED;
  }

  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const parsedJSON = JSON.parse(input.body);

  const { encounterId, practitionerId, userRole } = safeValidate(UnassignPractitionerSchema, parsedJSON);

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    encounterId,
    practitionerId,
    userRole,
    secrets: input.secrets,
    userToken,
  };
}
