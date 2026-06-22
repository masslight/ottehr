import { MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, NOT_AUTHORIZED, SignAppointmentInput } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../shared';

const SignAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  encounterId: z.string().uuid(),
  timezone: z.string().min(1).nullable().optional(),
  supervisorApprovalEnabled: z.boolean().optional().default(false),
});

export function validateRequestParameters(input: ZambdaInput): SignAppointmentInput & { userToken: string } {
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

  const { appointmentId, encounterId, timezone, supervisorApprovalEnabled } = safeValidate(
    SignAppointmentSchema,
    parsedJSON
  );

  const userToken = input.headers.Authorization.replace('Bearer ', '');

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentId,
    encounterId,
    secrets: input.secrets,
    timezone: timezone ?? null,
    userToken,
    supervisorApprovalEnabled,
  };
}
