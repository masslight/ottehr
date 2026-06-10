import { INVALID_INPUT_ERROR, VALUE_SETS } from 'utils';
import { z } from 'zod';
import { safeValidate, ZambdaInput } from '../../../shared';
import { CancelTelemedAppointmentInputValidated } from '.';

const patientReasons = VALUE_SETS.cancelReasonOptionsVirtualPatient.map((o) => o.value) as [string, ...string[]];
const providerReasons = VALUE_SETS.cancelReasonOptionsVirtualProvider.map((o) => o.value) as [string, ...string[]];
const allCancellationReasons = [...patientReasons, ...providerReasons] as [string, ...string[]];

const TelemedCancelAppointmentBodySchema = z.object({
  appointmentID: z.string().uuid(),
  cancellationReason: z.enum(allCancellationReasons),
  cancellationReasonAdditional: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CancelTelemedAppointmentInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw INVALID_INPUT_ERROR('No request body provided');
  }

  const { appointmentID, cancellationReason, cancellationReasonAdditional } = safeValidate(
    TelemedCancelAppointmentBodySchema,
    JSON.parse(input.body)
  );

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentID,
    cancellationReason,
    cancellationReasonAdditional,
    secrets: input.secrets,
  };
}
