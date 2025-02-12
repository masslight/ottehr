import { DateTime } from 'luxon';
import { CreateAppointmentUCTelemedParams, PersonSex, RequiredAllProps } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets } from 'zambda-utils';
import { phoneRegex } from '../../shared';

// Note that this file is copied from BH and needs significant changes
export function validateCreateAppointmentParams(
  input: ZambdaInput
): RequiredAllProps<CreateAppointmentUCTelemedParams> & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patient, locationState, unconfirmedDateOfBirth, timezone } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (patient === undefined) {
    throw new Error('These fields are required: "patient"');
  }

  // Patient details
  if (
    patient.firstName === undefined ||
    patient.lastName === undefined ||
    patient.dateOfBirth === undefined ||
    patient.email === undefined ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    patient.email === ''
  ) {
    throw new Error(
      'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.email"'
    );
  }

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw new Error('"patient.dateOfBirth" was not read as a valid date');
  }

  if (patient.sex && !Object.values(PersonSex).includes(patient.sex)) {
    throw new Error(`"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`);
  }

  if (!patient.email) {
    throw new Error('patient email is not defined');
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw new Error('patient phone number is not valid');
  }

  if (unconfirmedDateOfBirth) {
    const isInvalidUnconfirmedDateOfBirth = !DateTime.fromISO(unconfirmedDateOfBirth).isValid;
    if (isInvalidUnconfirmedDateOfBirth) {
      throw new Error('"unconfirmedDateOfBirth" was not read as a valid date');
    }
  }

  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    patient,
    locationState,
    unconfirmedDateOfBirth,
    timezone,
    secrets: input.secrets,
  };
}
