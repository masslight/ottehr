import { DateTime } from 'luxon';
import { CreateAppointmentUCTelemedParams, RequiredAllProps, ZambdaInput } from 'ottehr-utils';
import { phoneRegex } from '../../shared';
import { PersonSex } from '../../types';

// Note that this file is copied from BH and needs significant changes
export function validateCreateAppointmentParams(
  input: ZambdaInput,
): RequiredAllProps<CreateAppointmentUCTelemedParams> {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patient, location } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (patient === undefined) {
    throw new Error('These fields are required: "patient"');
  }

  // Patient details
  if (
    patient.firstName === undefined ||
    patient.lastName === undefined ||
    patient.sex === undefined ||
    patient.dateOfBirth === undefined ||
    patient.reasonForVisit === undefined ||
    patient.email === undefined ||
    patient.emailUser === undefined ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    patient.sex === '' ||
    patient.reasonForVisit === '' ||
    patient.email === '' ||
    patient.emailUser === ''
  ) {
    throw new Error(
      'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.reasonForVisit", "patient.email", "patient.emailUser"',
    );
  }

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw new Error('"patient.dateOfBirth" was not read as a valid date');
  }

  if (!Object.values(PersonSex).includes(patient.sex)) {
    throw new Error(`"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`);
  }

  const patientUser = ['Patient', 'Parent/Guardian'];
  if (!patientUser.includes(patient.emailUser)) {
    throw new Error(
      `"patient.emailUser" must be one of the following values: ${JSON.stringify(Object.values(patientUser))}`,
    );
  }

  if (!patient.email) {
    throw new Error('patient email is not defined');
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw new Error('patient phone number is not valid');
  }

  // if (!DateTime.fromFormat(patient.dateOfBirth, 'yyyy-mm-dd')) {
  //   throw new Error(`"patient.dateOfBirth" must be in the format yyyy-mm-dd`);
  // }
  console.groupEnd();
  console.debug('validateRequestParameters success');

  return {
    patient,
    locationState: location,
  };
}
