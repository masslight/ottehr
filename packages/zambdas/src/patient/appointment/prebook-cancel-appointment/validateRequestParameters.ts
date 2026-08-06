import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY } from 'utils/lib/types/errors';
import { ServiceMode } from 'utils/lib/types/common';
import { VALUE_SETS } from 'utils/lib/ottehr-config/value-sets';
import { z } from 'zod';
import { ZambdaInput } from '../../../shared/types/common';
import { safeJsonParse, safeValidate } from '../../../shared/validation';
import { CancelAppointmentZambdaInputValidated } from '.';

const CancelAppointmentBodySchema = z.object({
  appointmentID: z.string().uuid(),
  cancellationReason: z.string().min(1),
  silent: z.boolean().optional(),
  language: z.string().optional(),
  cancellationReasonAdditional: z.string().optional(),
});

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentZambdaInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentID, cancellationReason, silent, language, cancellationReasonAdditional } = safeValidate(
    CancelAppointmentBodySchema,
    safeJsonParse(input.body)
  );

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    appointmentID,
    cancellationReason,
    silent,
    secrets: input.secrets,
    language,
    cancellationReasonAdditional,
  };
}

export interface AppointmentCancellationContext {
  cancellationReason: string;
  requesterType: 'patient' | 'provider';
  serviceMode: ServiceMode;
}

export const validateCancellationReasonForAppointmentContext = (context: AppointmentCancellationContext): void => {
  const { cancellationReason, requesterType, serviceMode } = context;

  const validValueSets: string[] = [];

  if (requesterType === 'provider') {
    if (serviceMode === ServiceMode.virtual) {
      validValueSets.push(...VALUE_SETS.cancelReasonOptionsVirtualProvider.map((option) => option.value));
    } else {
      validValueSets.push(...VALUE_SETS.cancelReasonOptionsInPersonProvider.map((option) => option.value));
    }
  } else {
    if (serviceMode === ServiceMode.virtual) {
      validValueSets.push(...VALUE_SETS.cancelReasonOptionsVirtualPatient.map((option) => option.value));
    } else {
      validValueSets.push(...VALUE_SETS.cancelReasonOptionsInPersonPatient.map((option) => option.value));
    }
  }
  if (!validValueSets.includes(cancellationReason)) {
    throw INVALID_INPUT_ERROR(
      `"cancellationReason" value "${cancellationReason}" is not valid for the appointment context (must be one of [${validValueSets.join(
        ', '
      )}])`
    );
  }
};
