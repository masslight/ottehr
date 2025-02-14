import Oystehr from '@oystehr/sdk';
import { HealthcareService, Location, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APPOINTMENT_CANT_BE_IN_PAST_ERROR,
  CreateAppointmentInputParams,
  isISODateTime,
  PersonSex,
  VisitType,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { SCHEDULE_TYPES } from '../../get-schedule/validateRequestParameters';
import { phoneRegex } from '../../shared';
import { checkValidBookingTime } from '../../shared/helpers';
export interface CreateAppointmentValidatedInput
  extends Omit<CreateAppointmentInputParams, 'providerID' | 'groupID' | 'locationID'> {
  currentCanonicalQuestionnaireUrl: string;
  schedule: Location | Practitioner | HealthcareService;
  secrets: Secrets | null;
}

export async function validateCreateAppointmentParams(
  input: ZambdaInput,
  isEHRUser: boolean,
  oystehr: Oystehr
): Promise<CreateAppointmentValidatedInput> {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const { secrets } = input;
  const currentCanonicalQuestionnaireUrl = getSecret(SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE, secrets);
  if (currentCanonicalQuestionnaireUrl === '') {
    throw new Error(`Missing secret with name ${SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE}`);
  }

  const bodyJSON = JSON.parse(input.body);
  const {
    slot,
    language,
    patient,
    scheduleType,
    locationID,
    providerID,
    groupID,
    visitType,
    unconfirmedDateOfBirth,
    serviceType,
  } = bodyJSON;
  console.log('unconfirmedDateOfBirth', unconfirmedDateOfBirth);

  // Check existence of necessary fields
  if (patient === undefined || scheduleType === undefined || visitType === undefined) {
    console.log('patient:', patient, 'scheduleType:', scheduleType, 'visitType:', visitType);
    throw new Error('These fields are required: "patient", "scheduleType", "visitType"');
  }

  if (!SCHEDULE_TYPES.includes(scheduleType)) {
    throw new Error(`scheduleType must be either ${SCHEDULE_TYPES}`);
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

  let schedule;
  if (scheduleType === 'location') {
    schedule = await oystehr.fhir.get<Location>({
      resourceType: 'Location',
      id: locationID,
    });
  } else if (scheduleType === 'group') {
    schedule = await oystehr.fhir.get<HealthcareService>({
      resourceType: 'HealthcareService',
      id: groupID,
    });
  } else if (scheduleType === 'provider') {
    schedule = await oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: providerID,
    });
  }

  if (!schedule) {
    throw new Error(`Couldn't find schedule resource`);
  }

  // Patient details
  if (
    patient.firstName === undefined ||
    patient.lastName === undefined ||
    patient.dateOfBirth === undefined ||
    patient.reasonForVisit === undefined ||
    (!isEHRUser && patient.sex === undefined) ||
    (!isEHRUser && patient.email === undefined) ||
    patient.firstName === '' ||
    patient.lastName === '' ||
    patient.reasonForVisit === '' ||
    (!isEHRUser && patient.sex === '') ||
    (!isEHRUser && patient.email === '')
  ) {
    throw new Error(
      'These fields are required and may not be empty: "patient.firstName", "patient.lastName", "patient.dateOfBirth", "patient.reasonForVisit", "patient.email", "patient.sex"'
    );
  }

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw new Error('"patient.dateOfBirth" was not read as a valid date');
  }

  if (!isEHRUser && !Object.values(PersonSex).includes(patient.sex)) {
    throw new Error(`"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`);
  }

  if (visitType !== VisitType.PreBook && visitType !== VisitType.WalkIn && visitType !== VisitType.PostTelemed) {
    throw new Error(`visitType must be either ${VisitType.PreBook} or ${VisitType.WalkIn} or ${VisitType.PostTelemed}`);
  }

  if (visitType === VisitType.PostTelemed && !isEHRUser) {
    throw new Error(`visitType ${VisitType.PostTelemed} can only be created by EHR users`);
  }

  if (visitType === VisitType.PreBook || visitType === VisitType.PostTelemed) {
    if (slot === undefined) {
      throw new Error(`"slot" is required for appointment with visit type prebook`);
    }
    if (!isISODateTime(slot)) {
      throw new Error(`"slot" must be in ISO date and time format (YYYY-MM-DDTHH:MM:SS+zz:zz)`);
    }
    if (!checkValidBookingTime(slot)) {
      throw APPOINTMENT_CANT_BE_IN_PAST_ERROR;
    }
  }

  if (visitType === VisitType.PreBook && !slot) {
    throw new Error(`"slot" is required for prebooked appointments`);
  }

  if (!isEHRUser && !patient.email) {
    throw new Error('patient email is not defined');
  }

  if (isEHRUser && !patient.email) {
    patient.emailUser = undefined;
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw new Error('patient phone number is not valid');
  }

  patient.reasonForVisit = `${patient.reasonForVisit}${
    patient?.reasonAdditional ? ` - ${patient?.reasonAdditional}` : ''
  }`;

  // if (!DateTime.fromFormat(patient.dateOfBirth, 'yyyy-mm-dd')) {
  //   throw new Error(`"patient.dateOfBirth" must be in the format yyyy-mm-dd`);
  // }

  return {
    slot: visitType === VisitType.WalkIn ? undefined : slot,
    patient,
    schedule,
    scheduleType,
    serviceType,
    // locationID,
    // providerID,
    // groupID,
    secrets: input.secrets,
    visitType,
    language,
    unconfirmedDateOfBirth,
    currentCanonicalQuestionnaireUrl,
  };
}
