import { INVALID_INPUT_ERROR, MISSING_REQUEST_BODY, MISSING_REQUIRED_PARAMETERS, ServiceMode, VALUE_SETS } from 'utils';
import { ZambdaInput } from '../../../shared';
import { CancelAppointmentZambdaInputValidated } from '.';

export function validateRequestParameters(input: ZambdaInput): CancelAppointmentZambdaInputValidated {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { language, appointmentID, cancellationReason, silent, cancellationReasonAdditional } = JSON.parse(input.body);

  const missingFields = [];
  if (appointmentID === undefined) {
    missingFields.push('appointmentID');
  }
  if (cancellationReason === undefined) {
    missingFields.push('cancellationReason');
  }
  if (missingFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingFields);
  }

  if (typeof cancellationReason !== 'string') {
    throw INVALID_INPUT_ERROR(`"cancellationReason" must be a string`);
  }

  if (cancellationReasonAdditional && typeof cancellationReasonAdditional !== 'string') {
    throw INVALID_INPUT_ERROR(`"cancellationReasonAdditional" must be a string if included`);
  }

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
