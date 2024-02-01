import { DateTime } from 'luxon';
import { CreateAppointmentInput } from '.';
import { PersonSex, VisitType } from '../types';
import { isISODateTime } from '../shared/dateUtils';
import { checkValidBookingTime } from '../shared/helpers';
import { phoneRegex } from '../shared';
import { ZambdaInput } from 'utils';

export function validateCreateAppointmentParams(input: ZambdaInput, isEHRUser: boolean): CreateAppointmentInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const bodyJSON = JSON.parse(input.body);
  const { slot, patient, location, visitType, unconfirmedDateOfBirth } = bodyJSON;
  console.log('unconfirmedDateOfBirth', unconfirmedDateOfBirth);

  // Check existence of necessary fields
  if (patient === undefined || location === undefined || visitType === undefined) {
    throw new Error('These fields are required: "patient", "location", "visitType');
  }

  // Patient details
  if (
    patient.firstName === undefined ||
    patient.lastName === undefined ||
    (isEHRUser && patient.sex === undefined) ||
    patient.dateOfBirth === undefined ||
    patient.reasonForVisit === undefined ||
    (!isEHRUser && patient.email === undefined) ||
    patient.emailUser === undefined ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    (isEHRUser && patient.sex === '') ||
    patient.reasonForVisit === '' ||
    (!isEHRUser && patient.email === '') ||
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

  if (isEHRUser && !Object.values(PersonSex).includes(patient.sex)) {
    throw new Error(`"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`);
  }

  const patientUser = ['Patient', 'Parent/Guardian'];
  if (!patientUser.includes(patient.emailUser)) {
    throw new Error(
      `"patient.emailUser" must be one of the following values: ${JSON.stringify(Object.values(patientUser))}`,
    );
  }

  if (visitType !== VisitType.PreBook && visitType !== VisitType.WalkIn) {
    throw new Error(`visitType must be either ${VisitType.PreBook} or ${VisitType.WalkIn}`);
  }

  if (visitType === VisitType.PreBook) {
    if (!isISODateTime(slot)) {
      throw new Error(`"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS+zz:zz)`);
    }
    if (slot === undefined) {
      throw new Error(`"slot" is required for appointment with visit type prebook`);
    }
    if (!checkValidBookingTime(slot)) {
      throw new Error('"slot" cannot be in the past for appointment with visit type prebook');
    }
  }

  if (visitType === VisitType.WalkIn && slot) {
    throw new Error(`"slot" should not be defined for walkin appointments`);
  }

  if (!isEHRUser && !patient.email) {
    throw new Error('patient email is not defined');
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw new Error('patient phone number is not valid');
  }

  // if (!DateTime.fromFormat(patient.dateOfBirth, 'yyyy-mm-dd')) {
  //   throw new Error(`"patient.dateOfBirth" must be in the format yyyy-mm-dd`);
  // }

  return {
    slot,
    patient,
    location,
    secrets: input.secrets,
    visitType,
    unconfirmedDateOfBirth,
  };
}
