import { DateTime } from 'luxon';
import { PersonSex, RequiredProps, UpdateAppointmentRequestParams } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets } from 'zambda-utils';
import { phoneRegex } from '../../shared';

// Note that this file is copied from BH and needs significant changes
export function validateUpdateAppointmentParams(
  input: ZambdaInput
): RequiredProps<UpdateAppointmentRequestParams, 'patient'> & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patient, appointmentId, unconfirmedDateOfBirth, locationState } = JSON.parse(input.body);

  if (appointmentId === undefined) {
    throw new Error('"appointmentId" is required');
  }

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
    patient.emailUser === undefined ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    patient.email === '' ||
    patient.emailUser === ''
  ) {
    throw new Error(
      'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.email", "patient.emailUser"'
    );
  }

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw new Error('"patient.dateOfBirth" was not read as a valid date');
  }

  if (patient.sex && !Object.values(PersonSex).includes(patient.sex)) {
    throw new Error(`"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`);
  }

  const patientUser = ['Patient', 'Parent/Guardian'];
  if (!patientUser.includes(patient.emailUser)) {
    throw new Error(
      `"patient.emailUser" must be one of the following values: ${JSON.stringify(Object.values(patientUser))}`
    );
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
    appointmentId,
    patient,
    unconfirmedDateOfBirth,
    secrets: input.secrets,
    locationState,
  };
}
