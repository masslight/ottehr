import Oystehr, { User } from '@oystehr/sdk';
import { Appointment, Location, Practitioner, PractitionerRole, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AllStates,
  APPOINTMENT_ALREADY_EXISTS_ERROR,
  CanonicalUrl,
  CHARACTER_LIMIT_EXCEEDED_ERROR,
  checkSlotAvailable,
  CreateAppointmentInputParams,
  FHIR_RESOURCE_NOT_FOUND,
  FollowUpOptions,
  getServiceModeFromScheduleOwner,
  getServiceModeFromSlot,
  getSlotIsPostTelemed,
  getSlotIsWalkin,
  INVALID_INPUT_ERROR,
  isLocationVirtual,
  makeSlotAtLocationExtensionEntry,
  MISSING_REQUIRED_PARAMETERS,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  parseQuestionnaireCanonicalExtension,
  PatientInfo,
  PersonSex,
  REASON_FOR_VISIT_SEPARATOR,
  REASON_MAXIMUM_CHAR_LIMIT,
  resolveServiceCategory,
  ScheduleOwnerFhirResource,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  ServiceMode,
  SLOT_FALLBACK_REROUTED_TAG,
  SLOT_QUESTIONNAIRE_CANONICAL_EXTENSION_URL,
  SLOT_UNAVAILABLE_ERROR,
  VisitType,
} from 'utils';
import {
  checkIsEHRUser,
  isTestUser,
  phoneRegex,
  resolveBookingLocationId,
  userHasAccessToPatient,
  ZambdaInput,
} from '../../../shared';
import { getCanonicalUrlForPrevisitQuestionnaire } from '../helpers';
import { tryGroupMemberFallback } from './groupMemberFallback';

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
  const { slotId, language, patient, locationState, appointmentMetadata, followUpOptions } = bodyJSON;
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

  const validatedFollowUpOptions = validateFollowUpOptions(followUpOptions);

  return {
    slotId,
    user,
    isEHRUser,
    patient,
    secrets: input.secrets,
    language,
    locationState,
    appointmentMetadata,
    followUpOptions: validatedFollowUpOptions,
  };
}

function validateFollowUpOptions(raw: unknown): FollowUpOptions | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw INVALID_INPUT_ERROR('"followUpOptions" must be an object');
  }
  const { parentEncounterId, skipPatientDiagnosis } = raw as Record<string, unknown>;
  if (typeof parentEncounterId !== 'string' || parentEncounterId.length === 0) {
    throw INVALID_INPUT_ERROR('"followUpOptions.parentEncounterId" must be a non-empty string');
  }
  if (skipPatientDiagnosis !== undefined && typeof skipPatientDiagnosis !== 'boolean') {
    throw INVALID_INPUT_ERROR('"followUpOptions.skipPatientDiagnosis" must be a boolean if provided');
  }
  return {
    parentEncounterId,
    ...(skipPatientDiagnosis !== undefined && { skipPatientDiagnosis }),
  };
}

export interface CreateAppointmentEffectInput {
  slot: Slot;
  /**
   * The Schedule that owns the slot. Forwarded so the capacity guard (and
   * any later fallback step) doesn't have to re-fetch it.
   */
  schedule: Schedule;
  scheduleOwner: ScheduleOwnerFhirResource;
  serviceMode: ServiceMode;
  patient: PatientInfo;
  user: User;
  questionnaireCanonical: CanonicalUrl;
  visitType: VisitType;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
  followUpOptions?: FollowUpOptions;
  /**
   * Unified booking-location resolution. Populated when the booking should be
   * attributed to a specific Location — either because the scheduleOwner IS
   * the Location (direct-location booking), because the scheduleOwner is a
   * group and the caller scoped the booking to one of its member Locations,
   * or because the scheduleOwner is a PractitionerRole that carries a
   * Location reference. When set, stamped onto Encounter.location[] and
   * Appointment.participant[].
   */
  bookingLocation?: ResolvedBookingLocation;
  /**
   * Resolved attending Practitioner for this booking. Populated when the
   * scheduleOwner is a PractitionerRole (the Practitioner on the role) so
   * downstream handlers can add them to Appointment.participant and know who
   * the pre-assigned provider is without re-resolving the PractitionerRole.
   */
  attendingPractitioner?: ResolvedAttendingPractitioner;
}

// `id` is optional on the FHIR TS types, but any persisted FHIR resource has
// one. These narrowed aliases let downstream code build `Location/${id}` /
// `Practitioner/${id}` reference strings without per-site `?.id` guards —
// the invariant is enforced once at the validation boundary.
export type ResolvedBookingLocation = Location & { id: string };
export type ResolvedAttendingPractitioner = Practitioner & { id: string };

/**
 * Whether the prebook-grid capacity guard should run for this slot. The
 * guard is meant to prevent forward-looking overbooking on slots vended
 * from the prebook cadence grid. Three slot shapes are outside that
 * model and bypass the guard:
 *
 *   1. **Fully-elapsed slots.** The time period is over; no resource can
 *      be reallocated, and the guard's forward-looking purpose no longer
 *      applies. Covers historical/back-fill bookings (admin entering
 *      past visits, test data populating past appointments).
 *   2. **Walk-in slots.** Managed by a first-come-at-the-clinic model
 *      rather than the cadence-grid one. The slot's start is whatever
 *      `DateTime.now()` produced and won't align with cadence
 *      candidates, so the guard's exact-equality match would always
 *      reject. Walk-in busy slots are already segregated at the FHIR
 *      query layer via `appointment-type:not WALKIN` in getSlotsInWindow.
 *   3. **Post-telemed slots.** A continuation flow from a telemed
 *      visit, not a fresh prebook. The slot-vending logic explicitly
 *      filters out post-telemed slots when generating available starts
 *      (see scheduleUtils.ts) so a post-telemed slot would never match
 *      a generated candidate and the guard would always reject.
 */
const capacityGuardApplies = (slot: Slot): boolean => {
  const slotEnd = slot.end ? DateTime.fromISO(slot.end) : undefined;
  const slotHasFullyElapsed = slotEnd?.isValid === true && slotEnd <= DateTime.now();
  if (slotHasFullyElapsed) return false;
  if (getSlotIsWalkin(slot)) return false;
  if (getSlotIsPostTelemed(slot)) return false;
  return true;
};

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
  const initialSchedule = fhirResources.find((resource) => resource.resourceType === 'Schedule') as
    | Schedule
    | undefined;
  const initialScheduleOwner = fhirResources.find((resource) => {
    const asRef = `${resource.resourceType}/${resource.id}`;
    return initialSchedule?.actor?.some((actor) => actor.reference === asRef);
  }) as ScheduleOwnerFhirResource | undefined;
  const appointment = fhirResources.find((resource) => resource.resourceType === 'Appointment') as
    | Appointment
    | undefined;
  if (!slot.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Slot');
  }
  if (!initialSchedule?.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Schedule');
  }
  if (initialScheduleOwner === undefined) {
    // this will be a 500 error
    throw new Error('Schedule owner not found');
  }
  if (appointment?.id) {
    throw APPOINTMENT_ALREADY_EXISTS_ERROR;
  }

  // Capacity guard. Reject the booking before any FHIR writes if the
  // Schedule's bucket for this start time is already exhausted (e.g., a
  // concurrent booking from another patient won the race after the
  // patient reserved this slot, OR the Schedule's hours-of-operation
  // changed between vending and booking). Peer-aware: cross-PR conflicts
  // for the same Practitioner are caught too.
  //
  // The patient's own just-reserved Slot is persisted by create-slot
  // with status=busy before this zambda runs; exclude it from the busy
  // count so it doesn't count against itself.
  //
  // Bypassed for slot shapes the prebook-grid model doesn't apply to —
  // see capacityGuardApplies.
  let schedule: Schedule = initialSchedule;
  let scheduleOwner: ScheduleOwnerFhirResource = initialScheduleOwner;

  // Pre-resolve the slot's service-category cadence once and forward into
  // both the initial check and (when triggered) the per-candidate checks
  // inside tryGroupMemberFallback. The slot's serviceCategory is invariant
  // across candidate schedules, so resolving once avoids N catalog fetches
  // during anonymous-mode group fallback. The resolver returns undefined for
  // BOOKING_CONFIG-only categories (no FHIR catalog hit), so this is free
  // for compiled-in production paths.
  let resolvedCadenceMinutes: number | undefined;
  if (capacityGuardApplies(slot)) {
    const slotCategoryCode = (slot.serviceCategory ?? [])
      .flatMap((cc) => cc.coding ?? [])
      .find((c) => c.system === SERVICE_CATEGORY_SYSTEM)?.code;
    if (slotCategoryCode) {
      const resolved = await resolveServiceCategory(slotCategoryCode, oystehrClient);
      resolvedCadenceMinutes = resolved?.cadenceMinutes;
    }
  }

  const available = capacityGuardApplies(slot)
    ? await checkSlotAvailable(
        { slot, schedule, excludeSlotId: slot.id, cadenceMinutes: resolvedCadenceMinutes },
        oystehrClient
      )
    : true;
  if (!available) {
    // Anonymous-mode group fallback: if the originally-targeted member is
    // saturated, attempt to reroute to another member of the same group at
    // the same Location. Gated on the slot being booked-via-group AND the
    // group HS being in anonymous assignment mode AND a candidate having
    // capacity at the originating Location — see groupMemberFallback.ts.
    const fallback = await tryGroupMemberFallback({
      slot,
      schedule,
      scheduleOwner,
      oystehrClient,
      cadenceMinutes: resolvedCadenceMinutes,
    });
    if (!fallback) {
      throw SLOT_UNAVAILABLE_ERROR;
    }
    schedule = fallback.schedule;
    scheduleOwner = fallback.scheduleOwner;
    slot.schedule = { reference: `Schedule/${fallback.schedule.id}` };
    slot.meta = {
      ...(slot.meta ?? {}),
      tag: [...(slot.meta?.tag ?? []), SLOT_FALLBACK_REROUTED_TAG],
    };
    if (fallback.locationStampNeeded) {
      slot.extension = [...(slot.extension ?? []), makeSlotAtLocationExtensionEntry(fallback.locationStampNeeded)];
    }
    // Persist the swap before downstream code runs. The main create-appointment
    // transaction only PATCHes the slot's status; without this update, the
    // schedule swap + rerouted tag + at-location stamp would live only in
    // memory for the rest of this request and never reach disk — leaving
    // the persisted Slot pointing at the originally-saturated Schedule,
    // which would corrupt analytics, audit trails, and any downstream
    // reader that walks Slot → Schedule.
    await oystehrClient.fhir.update<Slot>(slot);
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

  // Resolve the unified bookingLocation (and, when relevant, the attending
  // Practitioner). The resolution-rule logic lives in
  // resolveBookingLocationId as a pure helper so it's exhaustively unit-
  // testable; this function just materialises the resolved id into a
  // Location resource and handles the PR-actor → Practitioner side, which
  // is independent of where the Location came from.
  //
  // Resolved before the virtual-appointment locationState check below, because
  // group bookings derive their state from the (virtual) member Location
  // resolved here — the schedule owner is a HealthcareService or
  // PractitionerRole and carries no state of its own.
  let bookingLocation: ResolvedBookingLocation | undefined;
  let attendingPractitioner: ResolvedAttendingPractitioner | undefined;

  const bookingLocationId = resolveBookingLocationId({ scheduleOwner, slot });
  if (bookingLocationId) {
    let resolved: Location | undefined;
    if (scheduleOwner.resourceType === 'Location' && scheduleOwner.id === bookingLocationId) {
      // The Location resource is already in hand as the schedule owner; no
      // need to round-trip the server to re-fetch it.
      resolved = scheduleOwner as Location;
    } else {
      resolved = await oystehrClient.fhir
        .search<Location>({
          resourceType: 'Location',
          params: [{ name: '_id', value: bookingLocationId }],
        })
        .then((b) => b.unbundle()[0])
        .catch(() => undefined);
    }
    if (resolved && !resolved.id) {
      throw INVALID_INPUT_ERROR(`Resolved booking Location is missing an id (expected ${bookingLocationId})`);
    }
    bookingLocation = resolved as ResolvedBookingLocation | undefined;
  }

  // When the caller didn't pass locationState explicitly, derive it from a virtual
  // Location, otherwise the resolved booking Location (group bookings,
  // where the virtual member Location is identified by the slot's
  // at-location stamp).
  if (serviceMode === ServiceMode.virtual && !locationState) {
    const virtualLocationForState = [scheduleOwner, bookingLocation].find(
      (loc): loc is Location => !!loc && loc.resourceType === 'Location' && isLocationVirtual(loc as Location)
    );
    const state = virtualLocationForState?.address?.state;
    if (state && AllStates.some((stateTemp) => stateTemp.value.toLowerCase() === state.toLowerCase())) {
      locationState = state;
    }
  }

  if (serviceMode === ServiceMode.virtual && !locationState) {
    throw INVALID_INPUT_ERROR('"locationState" is required for virtual appointments');
  }

  if (scheduleOwner.resourceType === 'PractitionerRole') {
    const role = scheduleOwner as PractitionerRole;
    const practitionerId = role.practitioner?.reference?.split('/')[1];
    if (practitionerId) {
      const resolved = await oystehrClient.fhir
        .search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_id', value: practitionerId }],
        })
        .then((b) => b.unbundle()[0])
        .catch(() => undefined);
      if (resolved && !resolved.id) {
        throw INVALID_INPUT_ERROR(`Resolved attending Practitioner is missing an id (expected ${practitionerId})`);
      }
      attendingPractitioner = resolved as ResolvedAttendingPractitioner | undefined;
    }
  }

  return {
    slot,
    schedule,
    scheduleOwner,
    serviceMode,
    user,
    patient,
    questionnaireCanonical,
    visitType,
    locationState,
    appointmentMetadata,
    followUpOptions: input.followUpOptions,
    bookingLocation,
    attendingPractitioner,
  };
};
