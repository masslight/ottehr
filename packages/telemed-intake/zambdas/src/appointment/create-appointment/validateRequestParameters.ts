import { DateTime } from 'luxon';
import {
  CreateAppointmentUCTelemedParams,
  RequiredAllProps,
  Secrets,
  ZambdaInput,
  checkValidBookingTime,
  isISODateTime,
} from 'ottehr-utils';
import { phoneRegex } from '../../shared';
import { PersonSex } from '../../types';
import { SCHEDULE_TYPES } from '../../get-schedule/validateRequestParameters';

// Note that this file is copied from BH and needs significant changes
export function validateCreateAppointmentParams(
  input: ZambdaInput,
): RequiredAllProps<CreateAppointmentUCTelemedParams> & { secrets: Secrets | null } {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    patient,
    slot,
    scheduleType,
    visitType,
    visitService,
    locationID,
    providerID,
    groupID,
    unconfirmedDateOfBirth,
    timezone,
    isDemo,
  } = JSON.parse(input.body);

  // Check existence of necessary fields
  if (patient === undefined || scheduleType === undefined || visitType === undefined) {
    throw new Error('These fields are required: "patient", "scheduleType", ""visitType"');
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    throw new Error(`scheduleType must be either ${SCHEDULE_TYPES}`);
  }

  if (slot && !isISODateTime(slot)) {
    throw new Error(`"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS+zz:zz)`);
  }
  const VISIT_TYPES = ['now', 'prebook'];
  const SERVICE_TYPES = ['in-person', 'telemedicine'];
  if (!VISIT_TYPES.includes(visitType)) {
    throw new Error(`visitType must be one of the following values ${VISIT_TYPES}`);
  }
  if (visitType === 'prebook' && !checkValidBookingTime(slot)) {
    throw new Error('"slot" cannot be in the past for appointment with visit type prebook');
  }
  let start = slot;
  if (visitType === 'now') {
    start = DateTime.now();
  }
  if (!SERVICE_TYPES.includes(visitService)) {
    throw new Error(`visitService must be one of the following values ${SERVICE_TYPES}`);
  }
  if (scheduleType === 'location' && !locationID) {
    throw new Error('If scheduleType is "location", locationID is required');
  }
  if (scheduleType === 'provider' && !providerID) {
    throw new Error('If scheduleType is "provider", providerID is required');
  }
  if (scheduleType === 'group' && !groupID) {
    throw new Error('If scheduleType is "group", groupID is required');
  }

  // Patient details
  if (
    patient.firstName === undefined ||
    patient.lastName === undefined ||
    patient.sex === undefined ||
    patient.dateOfBirth === undefined ||
    patient.email === undefined ||
    patient.emailUser === undefined ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    patient.sex === '' ||
    patient.email === '' ||
    patient.emailUser === ''
  ) {
    throw new Error(
      'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.sex", "patient.dateOfBirth", "patient.email", "patient.emailUser"',
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
    slot: start,
    scheduleType,
    visitType,
    visitService,
    locationID,
    providerID,
    groupID,
    unconfirmedDateOfBirth,
    timezone,
    secrets: input.secrets,
    isDemo,
  };
}
