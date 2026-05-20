import Oystehr, { User } from '@oystehr/sdk';
import { Appointment, HealthcareService, Location, Practitioner, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AllStates,
  APPOINTMENT_ALREADY_EXISTS_ERROR,
  CanonicalUrl,
  CHARACTER_LIMIT_EXCEEDED_ERROR,
  CreateAppointmentInputParams,
  FHIR_RESOURCE_NOT_FOUND,
  getServiceModeFromScheduleOwner,
  getServiceModeFromSlot,
  getSlotIsPostTelemed,
  getSlotIsWalkin,
  INVALID_INPUT_ERROR,
  isLocationVirtual,
  MISSING_REQUIRED_PARAMETERS,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  parseQuestionnaireCanonicalExtension,
  PatientInfo,
  PersonSex,
  REASON_FOR_VISIT_SEPARATOR,
  REASON_MAXIMUM_CHAR_LIMIT,
  ScheduleOwnerFhirResource,
  Secrets,
  ServiceMode,
  SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL,
  SLUG_SYSTEM,
  VisitType,
} from 'utils';
import { checkIsEHRUser, isTestUser, phoneRegex, userHasAccessToPatient, ZambdaInput } from '../../../shared';
import { getCanonicalUrlForPrevisitQuestionnaire } from '../helpers';

export type CreateAppointmentBasicInput = CreateAppointmentInputParams & {
  secrets: Secrets | null;
  user: User;
  isEHRUser: boolean;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
};

export function validateCreateAppointmentParams(input: ZambdaInput, user: User): CreateAppointmentBasicInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }
  const isEHRUser = user && checkIsEHRUser(user);

  const bodyJSON = JSON.parse(input.body);
  const { slotId, language, patient, locationState, appointmentMetadata, parentEncounterId, atLocationSlug } = bodyJSON;
  console.log('patient:', patient, 'slotId:', slotId);
  // Check existence of necessary fields
  if (patient === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['patient']);
  }
  if (slotId === undefined) {
    throw MISSING_REQUIRED_PARAMETERS(['slotId']);
  }

  console.log('patient input:', JSON.stringify(patient));
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
  if (Boolean(patient.sex) === false) {
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
    patient?.reasonAdditional ? `${REASON_FOR_VISIT_SEPARATOR}${patient?.reasonAdditional}` : ''
  }`;

  if (patient.reasonForVisit && patient.reasonForVisit.length > REASON_MAXIMUM_CHAR_LIMIT) {
    throw CHARACTER_LIMIT_EXCEEDED_ERROR('Reason for visit', REASON_MAXIMUM_CHAR_LIMIT);
  }

  if (language && ['en', 'es'].includes(language) === false) {
    throw INVALID_INPUT_ERROR('"language" must be one of: "en", "es"');
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

  if (patient.authorizedNonLegalGuardians != null && typeof patient.authorizedNonLegalGuardians !== 'string') {
    throw INVALID_INPUT_ERROR('if specified, "patient.authorizedNonLegalGuardians" must be a string');
  }

  if (atLocationSlug != null && typeof atLocationSlug !== 'string') {
    throw INVALID_INPUT_ERROR('if specified, "atLocationSlug" must be a string');
  }

  return {
    slotId,
    user,
    isEHRUser,
    patient,
    secrets: input.secrets,
    language,
    locationState,
    appointmentMetadata,
    parentEncounterId,
    atLocationSlug,
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
  parentEncounterId?: string;
  /**
   * Unified booking-location resolution. Populated when the booking should be
   * attributed to a specific Location — either because the scheduleOwner IS
   * the Location (direct-location booking), because the scheduleOwner is a
   * group and the caller scoped the booking to one of its member Locations,
   * or because the scheduleOwner is a PractitionerRole that carries a
   * Location reference. When set, stamped onto Encounter.location[] and
   * Appointment.participant[].
   */
  bookingLocation?: Location;
  /**
   * Resolved attending Practitioner for this booking. Populated when the
   * scheduleOwner is a PractitionerRole (the Practitioner on the role) so
   * downstream handlers can add them to Appointment.participant and know who
   * the pre-assigned provider is without re-resolving the PractitionerRole.
   */
  attendingPractitioner?: Practitioner;
}

export const createAppointmentComplexValidation = async (
  input: CreateAppointmentBasicInput,
  oystehrClient: Oystehr
): Promise<CreateAppointmentEffectInput> => {
  const { slotId, isEHRUser, user, patient, appointmentMetadata, atLocationSlug } = input;

  console.log('createAppointmentComplexValidation metadata:', appointmentMetadata);

  let locationState = input.locationState;

  // patient input complex validation
  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, oystehrClient);
    if (!user || (!userAccess && !isEHRUser && !isTestUser(user))) {
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

  // Check if the Slot has a questionnaire canonical extension
  // This allows slots to specify which questionnaire should be used for appointments booked on them
  let questionnaireCanonical: CanonicalUrl;
  const slotQuestionnaireExtension = slot.extension?.find(
    (ext) => ext.url === SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL
  );
  if (slotQuestionnaireExtension?.valueString) {
    questionnaireCanonical = parseQuestionnaireCanonicalExtension(slotQuestionnaireExtension.valueString);
    console.log('Using questionnaire canonical from slot extension:', questionnaireCanonical);
  } else {
    // Fall back to service-mode-based questionnaire selection
    questionnaireCanonical = getCanonicalUrlForPrevisitQuestionnaire(serviceMode);
  }

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

  // Resolve the unified bookingLocation (and, when relevant, the attending
  // Practitioner).
  //   - Direct Location booking → owner IS the Location.
  //   - Group booking with atLocationSlug → resolve the Location by slug and
  //     verify it's actually a member of the group.
  //   - PractitionerRole booking → fetch the role, use its first location as
  //     bookingLocation and its practitioner as attendingPractitioner.
  let bookingLocation: Location | undefined;
  let attendingPractitioner: Practitioner | undefined;
  if (scheduleOwner.resourceType === 'Location') {
    bookingLocation = scheduleOwner as Location;
  } else if (scheduleOwner.resourceType === 'HealthcareService' && atLocationSlug) {
    const candidateLocations = (
      await oystehrClient.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: 'identifier', value: `${SLUG_SYSTEM}|${atLocationSlug}` }],
      })
    ).unbundle();
    const candidate = candidateLocations[0];
    if (!candidate) {
      throw INVALID_INPUT_ERROR(`"atLocationSlug" did not match any Location: ${atLocationSlug}`);
    }
    const group = scheduleOwner as HealthcareService;
    const isMember = (group.location || []).some((ref) => ref.reference === `Location/${candidate.id}`);
    if (!isMember) {
      throw INVALID_INPUT_ERROR(
        `"atLocationSlug" resolves to a Location that is not a member of the group: ${atLocationSlug}`
      );
    }
    bookingLocation = candidate;
  } else if (scheduleOwner.resourceType === 'PractitionerRole') {
    const role = scheduleOwner as PractitionerRole;
    const practitionerId = role.practitioner?.reference?.split('/')[1];
    const locationId = role.location?.[0]?.reference?.split('/')[1];
    const [practitionerHit, locationHit] = await Promise.all([
      practitionerId
        ? oystehrClient.fhir
            .search<Practitioner>({
              resourceType: 'Practitioner',
              params: [{ name: '_id', value: practitionerId }],
            })
            .then((b) => b.unbundle()[0])
            .catch(() => undefined)
        : Promise.resolve(undefined),
      locationId
        ? oystehrClient.fhir
            .search<Location>({
              resourceType: 'Location',
              params: [{ name: '_id', value: locationId }],
            })
            .then((b) => b.unbundle()[0])
            .catch(() => undefined)
        : Promise.resolve(undefined),
    ]);
    attendingPractitioner = practitionerHit;
    bookingLocation = locationHit;
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
    parentEncounterId: input.parentEncounterId,
    bookingLocation,
    attendingPractitioner,
  };
};
