import { Appointment, Location, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AllStates,
  APPOINTMENT_ALREADY_EXISTS_ERROR,
  CanonicalUrl,
  CHARACTER_LIMIT_EXCEEDED_ERROR,
  CreateAppointmentInputParams,
  FHIR_RESOURCE_NOT_FOUND,
  getSecret,
  getServiceModeFromScheduleOwner,
  getServiceModeFromSlot,
  getSlotIsPostTelemed,
  getSlotIsWalkin,
  INVALID_INPUT_ERROR,
  isLocationVirtual,
  MISSING_REQUIRED_PARAMETERS,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PatientInfo,
  PersonSex,
  REASON_MAXIMUM_CHAR_LIMIT,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
  ServiceMode,
  VisitType,
} from 'utils';
import { checkIsEHRUser, isTestUser, phoneRegex, userHasAccessToPatient, ZambdaInput } from '../../../shared';
import Oystehr, { User } from '@oystehr/sdk';
import { getCanonicalUrlForPrevisitQuestionnaire } from '../helpers';

export type CreateAppointmentBasicInput = CreateAppointmentInputParams & {
  secrets: Secrets | null;
  currentCanonicalQuestionnaireUrl: string;
  user: User;
  isEHRUser: boolean;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
};

export function validateCreateAppointmentParams(input: ZambdaInput, user: User): CreateAppointmentBasicInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const { secrets } = input;
  const currentCanonicalQuestionnaireUrl = getSecret(SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE, secrets);
  if (currentCanonicalQuestionnaireUrl === '') {
    throw new Error(`Missing secret with name ${SecretsKeys.IN_PERSON_PREVISIT_QUESTIONNAIRE}`);
  }
  const isEHRUser = checkIsEHRUser(user);

  const bodyJSON = JSON.parse(input.body);
  const { slotId, language, patient, unconfirmedDateOfBirth, locationState, appointmentMetadata } = bodyJSON;
  console.log('unconfirmedDateOfBirth', unconfirmedDateOfBirth);
  console.log('patient:', patient, 'slotId:', slotId);
  // Check existence of necessary fields
  if (patient === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['patient']);
  }
  if (slotId === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['slotId']);
  }

  // Patient details
  const missingRequiredPatientFields: string[] = [];
  if (Boolean(patient.firstName) === false) {
    missingRequiredPatientFields.push('firstName');
  }
  if (Boolean(patient.lastName) === false) {
    missingRequiredPatientFields.push('lastName');
  }
  if (Boolean(patient.dateOfBirth) === false) {
    missingRequiredPatientFields.push('dateOfBirth');
  }
  if (Boolean(patient.reasonForVisit) === undefined) {
    missingRequiredPatientFields.push('reasonForVisit');
  }
  if (!isEHRUser && Boolean(patient.sex) === false) {
    missingRequiredPatientFields.push('sex');
  }
  if (!isEHRUser && Boolean(patient.email === undefined)) {
    missingRequiredPatientFields.push('email');
  }
  if (missingRequiredPatientFields.length > 0) {
    throw MISSING_REQUIRED_PARAMETERS(missingRequiredPatientFields.map((field) => `patient.${field}`));
  }

  const isInvalidPatientDate = !DateTime.fromISO(patient.dateOfBirth).isValid;
  if (isInvalidPatientDate) {
    throw INVALID_INPUT_ERROR('"patient.dateOfBirth" was not read as a valid date');
  }

  if (patient.sex && !Object.values(PersonSex).includes(patient.sex)) {
    throw INVALID_INPUT_ERROR(
      `"patient.sex" must be one of the following values: ${JSON.stringify(Object.values(PersonSex))}`
    );
  }

  if (isEHRUser && !patient.email) {
    patient.emailUser = undefined;
  }

  if (patient?.phoneNumber && !phoneRegex.test(patient.phoneNumber)) {
    throw INVALID_INPUT_ERROR('patient phone number is not valid');
  }

  patient.reasonForVisit = `${patient.reasonForVisit}${
    patient?.reasonAdditional ? ` - ${patient?.reasonAdditional}` : ''
  }`;

  if (patient.reasonForVisit && patient.reasonForVisit.length > REASON_MAXIMUM_CHAR_LIMIT) {
    throw CHARACTER_LIMIT_EXCEEDED_ERROR('Reason for visit', REASON_MAXIMUM_CHAR_LIMIT);
  }

  if (language && ['en', 'es'].includes(language) === false) {
    throw INVALID_INPUT_ERROR('"language" must be one of: "en", "es"');
  }

  if (unconfirmedDateOfBirth) {
    const isInvalidUnconfirmedDateOfBirth = !DateTime.fromISO(unconfirmedDateOfBirth).isValid;
    if (isInvalidUnconfirmedDateOfBirth) {
      throw INVALID_INPUT_ERROR('"unconfirmedDateOfBirth" was not read as a valid date');
    }
  }

  if (locationState) {
    const isValidLocationState = AllStates.some((state) => state.value.toLowerCase() === locationState.toLowerCase());
    if (isValidLocationState === false) {
      throw INVALID_INPUT_ERROR('"locationState" must be a valid US state postal abbreviation');
    }
  }

  // will rely on fhir validation for more granular checks
  if (appointmentMetadata && typeof appointmentMetadata !== 'object') {
    throw INVALID_INPUT_ERROR('"appointmentMetadata" must be an object');
  }

  return {
    slotId,
    user,
    isEHRUser,
    patient,
    secrets: input.secrets,
    language,
    unconfirmedDateOfBirth,
    currentCanonicalQuestionnaireUrl,
    locationState,
    appointmentMetadata,
  };
}

export interface CreateAppointmentEffectInput {
  slot: Slot;
  scheduleOwner: ScheduleOwnerFhirResource;
  serviceMode: ServiceMode;
  patient: PatientInfo;
  user: User;
  questionnaireCanonical: CanonicalUrl;
  visitType: VisitType;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
}

export const createAppointmentComplexValidation = async (
  input: CreateAppointmentBasicInput,
  oystehrClient: Oystehr
): Promise<CreateAppointmentEffectInput> => {
  const { slotId, isEHRUser, user, patient, appointmentMetadata } = input;

  console.log('createAppointmentComplexValidation metadata:', appointmentMetadata);

  let locationState = input.locationState;

  // patient input complex validation
  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, oystehrClient);
    if (!userAccess && !isEHRUser && !isTestUser(user)) {
      throw NO_READ_ACCESS_TO_PATIENT_ERROR;
    }
  }

  // schedule and owner complex validation
  const fhirResources = (
    await oystehrClient.fhir.search<Slot | Schedule | ScheduleOwnerFhirResource | Appointment>({
      resourceType: 'Slot',
      params: [
        {
          name: '_id',
          value: slotId,
        },
        {
          name: '_include',
          value: 'Slot:schedule',
        },
        {
          name: '_include:iterate',
          value: 'Schedule:actor',
        },
        {
          name: '_revinclude',
          value: 'Appointment:slot',
        },
      ],
    })
  ).unbundle();
  const slot = fhirResources.find((resource) => resource.resourceType === 'Slot') as Slot;
  const schedule = fhirResources.find((resource) => resource.resourceType === 'Schedule') as Schedule | undefined;
  const scheduleOwner = fhirResources.find((resource) => {
    const asRef = `${resource.resourceType}/${resource.id}`;
    return schedule?.actor?.some((actor) => actor.reference === asRef);
  }) as ScheduleOwnerFhirResource | undefined;
  const appointment = fhirResources.find((resource) => resource.resourceType === 'Appointment') as
    | Appointment
    | undefined;
  if (!slot.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Slot');
  }
  if (scheduleOwner === undefined) {
    // this will be a 500 error
    throw new Error('Schedule owner not found');
  }
  if (appointment?.id) {
    throw APPOINTMENT_ALREADY_EXISTS_ERROR;
  }

  let serviceMode = getServiceModeFromSlot(slot);
  if (serviceMode === undefined) {
    serviceMode = getServiceModeFromScheduleOwner(scheduleOwner);
  }
  // todo: better error with link to docs here?
  if (serviceMode === undefined) {
    throw new Error('Service mode not found');
  }

  const questionnaireCanonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode, input.secrets);

  let visitType = getSlotIsPostTelemed(slot) ? VisitType.PostTelemed : VisitType.PreBook;
  if (getSlotIsWalkin(slot)) {
    visitType = VisitType.WalkIn;
  }

  if (serviceMode === ServiceMode.virtual && !locationState) {
    if (scheduleOwner.resourceType === 'Location' && isLocationVirtual(scheduleOwner as Location)) {
      const state = scheduleOwner.address?.state;
      const isValidLocationState = AllStates.some(
        (stateTemp) => state && stateTemp.value.toLowerCase() === state.toLowerCase()
      );
      if (isValidLocationState) {
        locationState = state;
      }
    }
  }

  if (serviceMode === ServiceMode.virtual && !locationState) {
    throw INVALID_INPUT_ERROR('"locationState" is required for virtual appointments');
  }

  return {
    slot,
    scheduleOwner,
    serviceMode,
    user,
    patient,
    questionnaireCanonical,
    visitType,
    locationState,
    appointmentMetadata,
  };
};
