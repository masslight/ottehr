import Oystehr, { BatchInput, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  Appointment,
  AppointmentParticipant,
  Bundle,
  Condition,
  Encounter,
  Extension,
  List,
  Location,
  Patient,
  Practitioner,
  PractitionerRole,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
  Resource,
  Schedule,
  Slot,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  ACCIDENT_TYPE_SYSTEM,
  CanonicalUrl,
  CreateAppointmentResponse,
  CREATED_BY_SYSTEM,
  createUserResourcesForPatient,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG,
  FHIR_EXTENSION,
  FhirAppointmentStatus,
  FhirEncounterStatus,
  FOLLOWUP_SUBTYPE_SYSTEM,
  FOLLOWUP_SYSTEMS,
  formatPhoneNumber,
  formatPhoneNumberDisplay,
  getAppointmentDurationFromSlot,
  getCanonicalQuestionnaire,
  getCoding,
  getFullestAvailableName,
  getTaskResource,
  isValidUUID,
  makePrepopulatedItemsForPatient,
  OTTEHR_MODULE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PatientInfo,
  PRIVATE_EXTENSION_BASE_URL,
  RETURNING_PATIENT_META_TAG,
  ScheduleOwnerFhirResource,
  Secrets,
  SERVICE_CATEGORY_SYSTEM,
  ServiceMode,
  TaskIndicator,
  User,
  VisitType,
} from 'utils';
import {
  AuditableZambdaEndpoints,
  createAuditEvent,
  createOystehrClient,
  generatePatientRelatedRequests,
  getAuth0Token,
  getUser,
  isTestUser,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getEncounterClass, getRelatedResources, getTelemedRequiredAppointmentEncounterExtensions } from '../helpers';
import { createAppointmentComplexValidation, validateCreateAppointmentParams } from './validateRequestParameters';

interface CreateAppointmentInput {
  slot: Slot;
  scheduleOwner: ScheduleOwnerFhirResource;
  serviceMode: ServiceMode;
  patient: PatientInfo;
  user: User;
  questionnaireCanonical: CanonicalUrl;
  secrets: Secrets | null;
  visitType: VisitType;
  language?: string;
  locationState?: string;
  appointmentMetadata?: Appointment['meta'];
  parentEncounterId?: string;
  /** Resolved Location for this booking (direct or via group member / role). */
  bookingLocation?: Location;
  /** Resolved attending Practitioner (populated for PractitionerRole bookings). */
  attendingPractitioner?: Practitioner;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler('create-appointment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  // Step 1: Validate input
  console.log('getting user');

  const token = input.headers.Authorization.replace('Bearer ', '');

  const user = await getUser(token, input.secrets);
  const validatedParameters = validateCreateAppointmentParams(input, user);
  const { secrets, language } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

  if (!oystehrToken) {
    console.log('getting token');
    oystehrToken = await getAuth0Token(input.secrets);
  } else {
    console.log('already have token');
  }
  const oystehr = createOystehrClient(oystehrToken, input.secrets);

  console.time('performing-complex-validation');
  const effectInput = await createAppointmentComplexValidation(validatedParameters, oystehr);
  const {
    slot,
    scheduleOwner,
    serviceMode,
    patient,
    questionnaireCanonical,
    visitType,
    appointmentMetadata: maybeMetadata,
    parentEncounterId,
    bookingLocation,
    attendingPractitioner,
  } = effectInput;
  console.log('effectInput', effectInput);
  console.timeEnd('performing-complex-validation');

  let appointmentMetadata = injectMetadataIfNeeded(maybeMetadata);

  if (patient.patientBeenSeenBefore) {
    if (!appointmentMetadata) {
      appointmentMetadata = {
        tag: [RETURNING_PATIENT_META_TAG()],
      };
    } else if (!appointmentMetadata.tag) {
      appointmentMetadata.tag = [RETURNING_PATIENT_META_TAG()];
    } else {
      appointmentMetadata.tag.push(RETURNING_PATIENT_META_TAG());
    }
  }

  console.log('creating appointment with metadata: ', JSON.stringify(appointmentMetadata));

  const data_appointment = await createAppointment(
    {
      slot,
      scheduleOwner,
      patient,
      serviceMode,
      user,
      language,
      secrets,
      visitType,
      questionnaireCanonical,
      appointmentMetadata,
      parentEncounterId,
      bookingLocation,
      attendingPractitioner,
    },
    oystehr
  );

  console.log('appointment created');

  const { message, appointmentId, fhirPatientId, questionnaireResponseId, encounterId, resources, relatedPersonId } =
    data_appointment;

  await createAuditEvent(
    AuditableZambdaEndpoints.appointmentCreate,
    oystehr,
    input,
    fhirPatientId,
    validatedParameters.secrets
  );

  const response: CreateAppointmentResponse = {
    message,
    appointmentId,
    fhirPatientId,
    questionnaireResponseId,
    encounterId,
    resources,
    relatedPersonId,
  };

  console.log(`fhirAppointment = ${JSON.stringify(response)}`, visitType);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

/**
 * Resolve the list of FHIR Schedules owned by a group's members
 * (Locations on HealthcareService.location[] and Practitioners linked via
 * PractitionerRole.healthcareService).
 */
// todo: reconnect this or delete. not clear why this would be needed in create appointment when a slot is passed in that should resolve much of this
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function resolveGroupMemberSchedules(
  oystehr: Oystehr,
  group: { id?: string; location?: Array<{ reference?: string }> }
): Promise<Schedule[]> {
  if (!group.id) return [];
  const locationRefs = (group.location || []).map((r) => r.reference).filter((r): r is string => !!r);

  const practitionerRoles = (
    await oystehr.fhir.search<PractitionerRole>({
      resourceType: 'PractitionerRole',
      params: [{ name: 'service', value: `HealthcareService/${group.id}` }],
    })
  ).unbundle();
  const practitionerRefs = practitionerRoles.map((pr) => pr.practitioner?.reference).filter((r): r is string => !!r);

  const memberRefs = [...locationRefs, ...practitionerRefs];
  if (memberRefs.length === 0) return [];

  // Search Schedule by actor. Oystehr's search doesn't support OR across
  // different resource types cleanly, so query per-ref and union.
  const all: Schedule[] = [];
  for (const ref of memberRefs) {
    try {
      const results = (
        await oystehr.fhir.search<Schedule>({
          resourceType: 'Schedule',
          params: [{ name: 'actor', value: ref }],
        })
      ).unbundle();
      all.push(...results);
    } catch (err) {
      console.warn(`Failed to fetch schedules for member ${ref}:`, err);
    }
  }
  return all;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  oystehr: Oystehr
): Promise<CreateAppointmentResponse> {
  const {
    slot,
    scheduleOwner,
    patient,
    user,
    secrets,
    visitType,
    serviceMode,
    questionnaireCanonical: questionnaireUrl,
    appointmentMetadata,
    bookingLocation,
    attendingPractitioner,
  } = input;

  const { verifiedPhoneNumber, listRequests, createPatientRequest, updatePatientRequest, isEHRUser, maybeFhirPatient } =
    await generatePatientRelatedRequests(user, patient, oystehr);

  let startTime: string | null; // iso string in UTC
  if (visitType === VisitType.WalkIn) {
    startTime = DateTime.now().setZone('UTC').toISO();
  } else {
    if (slot?.start) {
      startTime = DateTime.fromISO(slot.start).setZone('UTC').toISO();
    } else {
      throw new Error('Slot start time is required for pre-book appointments');
    }
  }

  if (!startTime) {
    throw new Error('startTime must be set by this point');
  }

  const endTime = DateTime.fromISO(startTime)
    .plus({ minutes: getAppointmentDurationFromSlot(slot) })
    .setZone('UTC')
    .toISO();

  if (!endTime) {
    throw new Error('endTime could not be calculated');
  }

  const formattedUserNumber = formatPhoneNumberDisplay(user?.name?.replace('+1', ''));
  const createdBy = isEHRUser
    ? `Staff ${user?.email}`
    : `${visitType === VisitType.WalkIn ? 'QR - ' : ''}Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;

  console.log('getting questionnaire ID to create blank questionnaire response');
  const currentQuestionnaire = await getCanonicalQuestionnaire(questionnaireUrl, oystehr);
  let verifiedFormattedPhoneNumber = verifiedPhoneNumber;

  if (!patient.id && !verifiedPhoneNumber) {
    console.log('Getting verifiedPhoneNumber for new patient', patient.phoneNumber);
    if (isEHRUser) {
      if (!patient.phoneNumber) {
        throw new Error('No phone number found for patient');
      }
      verifiedFormattedPhoneNumber = formatPhoneNumber(patient.phoneNumber);
    } else {
      // User is patient and auth0 already appends a +1 to the phone number
      verifiedFormattedPhoneNumber = user?.name ? formatPhoneNumber(user.name) : undefined;
    }
  }

  console.time('performing Transactional Fhir Requests for new appointment');

  const {
    appointment,
    patient: fhirPatient,
    questionnaireResponseId,
    encounter,
    questionnaire,
  } = await performTransactionalFhirRequests({
    patient: maybeFhirPatient,
    reasonForVisit: patient?.reasonForVisit || '',
    startTime,
    endTime,
    serviceMode,
    scheduleOwner,
    bookingLocation,
    attendingPractitioner,
    visitType,
    secrets,
    verifiedPhoneNumber: verifiedFormattedPhoneNumber,
    contactInfo: { phone: verifiedFormattedPhoneNumber ?? 'not provided', email: patient.email ?? 'not provided' },
    questionnaire: currentQuestionnaire,
    oystehr: oystehr,
    updatePatientRequest,
    createPatientRequest,
    performPreProcessing: user && !isTestUser(user),
    listRequests,
    newPatientDob: (createPatientRequest?.resource as Patient | undefined)?.birthDate,
    createdBy,
    slot,
    appointmentMetadata,
    parentEncounterId: input.parentEncounterId,
  });

  let relatedPersonId = '';

  // Three cases:
  // New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
  // Returning user, new patient, get the user's conversation and add the participant RelatedPerson
  // Returning user, returning patient, get the user's conversation
  let patientToReturn: Patient = fhirPatient;

  if (!patient.id && fhirPatient.id) {
    console.log('New patient');
    if (!verifiedFormattedPhoneNumber) {
      throw new Error('No phone number found for patient 2');
    }
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    // todo: this needs to happen via a transactional with the other must-happen-for-this-request-to-succeed items
    const [userResource, patientWithFriendlyId] = await Promise.all([
      createUserResourcesForPatient(oystehr, fhirPatient.id, verifiedFormattedPhoneNumber),
      oystehr.fhir.generateFriendlyPatientId({ id: fhirPatient.id }).catch((error) => {
        console.error(`Failed to generate friendly patient ID for Patient/${fhirPatient.id}:`, error);
        return undefined;
      }),
    ]);
    relatedPersonId = userResource?.relatedPerson?.id || '';
    const person = userResource.person;

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
    }

    if (patientWithFriendlyId) {
      patientToReturn = patientWithFriendlyId as Patient;
    }
  }

  if (appointment.id === undefined) {
    throw new Error('Appointment resource does not have an ID');
  }

  if (fhirPatient.id === undefined) {
    throw new Error('Patient resource does not have an ID');
  }

  if (encounter.id === undefined) {
    throw new Error('Encounter resource does not have an ID');
  }

  console.log('success, here is the id: ', appointment.id);

  return {
    message: 'Successfully created an appointment and encounter',
    appointmentId: appointment.id,
    fhirPatientId: fhirPatient.id,
    questionnaireResponseId: questionnaireResponseId,
    encounterId: encounter.id,
    relatedPersonId: relatedPersonId,
    resources: {
      appointment,
      encounter,
      questionnaire,
      patient: patientToReturn,
    },
  };
}

interface TransactionInput {
  reasonForVisit: string;
  startTime: string;
  endTime: string;
  visitType: VisitType;
  scheduleOwner: ScheduleOwnerFhirResource;
  bookingLocation?: Location;
  attendingPractitioner?: Practitioner;
  serviceMode: ServiceMode;
  questionnaire: Questionnaire;
  oystehr: Oystehr;
  secrets: Secrets | null;
  createdBy: string;
  verifiedPhoneNumber: string | undefined;
  contactInfo: { phone: string; email: string };
  additionalInfo?: string;
  patient?: Patient;
  newPatientDob?: string;
  createPatientRequest?: BatchInputPostRequest<Patient>;
  listRequests: BatchInputRequest<List>[];
  performPreProcessing: boolean;
  updatePatientRequest?: BatchInputRequest<Patient>;
  formUser?: string;
  slot?: Slot;
  appointmentMetadata?: Appointment['meta'];
  parentEncounterId?: string;
}
interface TransactionOutput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  questionnaire: QuestionnaireResponse;
  questionnaireResponseId: string;
  account?: Account;
}

export const performTransactionalFhirRequests = async (input: TransactionInput): Promise<TransactionOutput> => {
  const {
    oystehr,
    patient,
    scheduleOwner,
    bookingLocation,
    attendingPractitioner,
    questionnaire,
    reasonForVisit,
    startTime,
    endTime,
    visitType,
    verifiedPhoneNumber,
    contactInfo,
    additionalInfo,
    createPatientRequest,
    performPreProcessing,
    listRequests,
    updatePatientRequest,
    newPatientDob,
    createdBy,
    serviceMode,
    slot,
    appointmentMetadata,
    parentEncounterId,
  } = input;

  // Validate parent encounter for scheduled follow-ups — no nesting allowed.
  // Also collect the parent encounter's diagnoses so they can be carried over to the follow-up.
  let carriedOverDiagnoses: { condition: Condition; rank?: number }[] = [];
  if (parentEncounterId) {
    const parentEncounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: parentEncounterId,
    });
    if (parentEncounter.partOf) {
      throw new Error('Cannot create a follow-up of a follow-up. Please select a top-level encounter as the parent.');
    }

    const parentDiagnosisEntries = (parentEncounter.diagnosis ?? []).filter((entry) => {
      const ref = entry.condition?.reference;
      return typeof ref === 'string' && ref.startsWith('Condition/');
    });
    if (parentDiagnosisEntries.length > 0) {
      const fetchedConditions = await Promise.all(
        parentDiagnosisEntries.map((entry) =>
          oystehr.fhir.get<Condition>({
            resourceType: 'Condition',
            id: entry.condition!.reference!.split('/')[1],
          })
        )
      );
      carriedOverDiagnoses = parentDiagnosisEntries.map((entry, idx) => ({
        condition: fetchedConditions[idx],
        rank: entry.rank,
      }));
    }
  }

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl || '';

  const now = DateTime.now().setZone('UTC');
  const nowIso = now.toISO() ?? '';
  const initialAppointmentStatus: FhirAppointmentStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'booked' : 'arrived';
  const initialEncounterStatus: FhirEncounterStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'planned' : 'arrived';

  const apptExtensions: Extension[] = [];
  const encExtensions: Extension[] = [];

  if (serviceMode === ServiceMode.virtual) {
    const { encExtensions: telemedEncExtensions, apptExtensions: telemedApptExtensions } =
      getTelemedRequiredAppointmentEncounterExtensions(patientRef, nowIso);
    apptExtensions.push(...telemedApptExtensions);
    encExtensions.push(...telemedEncExtensions);
  }

  if (additionalInfo) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.additionalInfo.url,
      valueString: additionalInfo,
    });
  }

  const apptUrl = `urn:uuid:${uuid()}`;
  const participants: AppointmentParticipant[] = [];
  participants.push({
    actor: {
      reference: patientRef,
    },
    status: 'accepted',
  });
  participants.push({
    actor: {
      reference: `${scheduleOwner.resourceType}/${scheduleOwner.id}`,
    },
    status: 'accepted',
  });
  // When the booking is scoped to a Location (either directly or via a group
  // member), add it as a participant so consumers that filter by Location
  // (tracking board, reports) see the booking. Skip if the scheduleOwner
  // already IS the location — we would just be duplicating the same reference.
  if (bookingLocation && scheduleOwner.resourceType !== 'Location') {
    participants.push({
      actor: {
        reference: `Location/${bookingLocation.id}`,
      },
      status: 'accepted',
    });
  }
  // When the scheduleOwner is a PractitionerRole, add the underlying
  // Practitioner as a participant too. This keeps Appointment.participant-based
  // provider readers consistent with direct-Practitioner bookings.
  if (attendingPractitioner && scheduleOwner.resourceType !== 'Practitioner') {
    participants.push({
      actor: {
        reference: `Practitioner/${attendingPractitioner.id}`,
      },
      status: 'accepted',
    });
  }

  let slotReference: Reference | undefined;
  const postSlotRequests: BatchInputPostRequest<Slot>[] = [];
  const patchSlotRequests: BatchInputRequest<Slot>[] = [];
  if (isValidUUID(slot?.id ?? '') && slot?.meta !== undefined) {
    // assume slot already persisted
    slotReference = {
      reference: `Slot/${slot.id}`,
    };
    patchSlotRequests.push({
      method: 'PATCH',
      url: `/Slot/${slot.id}`,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'busy',
        },
      ],
    });
  } else if (slot) {
    postSlotRequests.push({
      method: 'POST',
      url: '/Slot',
      resource: {
        ...slot,
        resourceType: 'Slot',
        id: undefined,
        status: 'busy',
      },
      fullUrl: `urn:uuid:${uuid()}`,
    });
    slotReference = {
      reference: postSlotRequests[0].fullUrl,
    };
  }

  const otherMetaTags = performPreProcessing ? [FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG] : [];
  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      ...(appointmentMetadata ?? {}),
      tag: [
        { code: serviceMode === ServiceMode.virtual ? OTTEHR_MODULE.TM : OTTEHR_MODULE.IP },
        {
          system: CREATED_BY_SYSTEM,
          display: createdBy,
        },
        ...otherMetaTags,
        ...(appointmentMetadata?.tag ?? []),
      ],
    },
    participant: participants,
    start: startTime,
    end: endTime,
    slot: slotReference ? [slotReference] : undefined,
    appointmentType: {
      text: visitType,
    },
    serviceCategory: slot?.serviceCategory,
    description: reasonForVisit,
    status: initialAppointmentStatus,
    created: now.toISO() ?? '',
    extension: apptExtensions,
  };

  const encUrl = `urn:uuid:${uuid()}`;

  /*

  todo sort out his merge conflict later 

  <<<<<<< HEAD
  // Capacity guard + group-member fallback. Before touching the busy Slot,
  // verify that the target Schedule can absorb one more booking in the
  // requested window. If it can't and this is a group booking, reroute to
  // another group member with capacity. Only fail if every member is saturated.
  let slotScheduleRef: string | undefined = slot.schedule?.reference;
  let memberScheduleForAssignment: Schedule | undefined;

  if (slotScheduleRef) {
    let targetScheduleId = slotScheduleRef.replace('Schedule/', '');
    let targetSchedule = await oystehr.fhir.get<Schedule>({ resourceType: 'Schedule', id: targetScheduleId });

    // Exclude the patient's own just-reserved Slot from the busy count —
    // create-slot persists it with status=busy before create-appointment runs,
    // so without this exclusion the guard would always see the slot as "taken
    // by itself".
    let available = await checkSlotAvailable({ slot, schedule: targetSchedule, excludeSlotId: slot.id }, oystehr);

    if (!available && scheduleOwner.resourceType === 'HealthcareService') {
      // Group fallback: walk other member Schedules, pick the first free one.
      const memberSchedules = await resolveGroupMemberSchedules(oystehr, scheduleOwner);
      for (const memberSchedule of memberSchedules) {
        if (!memberSchedule.id || memberSchedule.id === targetScheduleId) continue;
        const candidateSlot = { ...slot, schedule: { reference: `Schedule/${memberSchedule.id}` } };
        const memberOk = await checkSlotAvailable(
          { slot: candidateSlot, schedule: memberSchedule, excludeSlotId: slot.id },
          oystehr
        );
        if (memberOk) {
          targetSchedule = memberSchedule;
          targetScheduleId = memberSchedule.id;
          slotScheduleRef = `Schedule/${memberSchedule.id}`;
          slot.schedule = { reference: slotScheduleRef };
          // If the patient submitted a specific Slot id, we must now create
          // a fresh Slot on the new Schedule instead of patching the stale one.
          slot.id = undefined;
          available = true;
          break;
        }
      }
    }

    if (!available) {
      throw new Error('This time slot is no longer available. Please pick another time.');
    }
    memberScheduleForAssignment = targetSchedule;
  }

  // Group provider-assignment mode: if scheduleOwner is a HealthcareService
  // (group) with characteristic `group-assignment-mode=provider`, and the
  // (possibly fallback-redirected) member is a Practitioner, stamp them on
  // Encounter.participant[ATND]. `anonymous` (default) leaves Encounter
  // participants empty — tracking board shows the visit as unassigned until
  // the front desk runs assign-practitioner.
  let encounterParticipants: Encounter['participant'] = undefined;
  try {
    if (scheduleOwner.resourceType === 'HealthcareService' && memberScheduleForAssignment) {
      const groupMode = (scheduleOwner.characteristic || [])
        .flatMap((c) => c.coding || [])
        .find((c) => c.system === 'https://fhir.ottehr.com/CodeSystem/group-assignment-mode')?.code;
      if (groupMode === 'provider') {
        const memberRef = memberScheduleForAssignment.actor?.[0]?.reference;
        if (memberRef && memberRef.startsWith('Practitioner/')) {
          encounterParticipants = [
            {
              type: [
                {
                  coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }],
                },
              ],
              individual: { reference: memberRef },
              period: { start: nowIso },
            },
          ];
        }
      }
    }
  } catch (err) {
    console.warn('Unable to resolve group assignment mode; falling back to unassigned Encounter:', err);
  }

  // Direct PractitionerRole booking: the attending is known at book time (the
  // role's Practitioner). Stamp Encounter.participant[ATND] so the tracking
  // board and progress note pick them up immediately. Skip if the group-mode
  // block above already set participants.
  if (!encounterParticipants && attendingPractitioner && scheduleOwner.resourceType === 'PractitionerRole') {
    encounterParticipants = [
      {
        type: [
          {
            coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType', code: 'ATND' }],
          },
        ],
        individual: { reference: `Practitioner/${attendingPractitioner.id}` },
        period: { start: nowIso },
      },
    ];
=======
  // Carry over diagnoses from the parent encounter to the follow-up by cloning each Dx Condition
  // and attaching it to the new encounter's diagnosis array (preserving rank/primary).
  const followUpDiagnosisRequests: BatchInputPostRequest<Condition>[] = [];
  const followUpDiagnosisEntries: NonNullable<Encounter['diagnosis']> = [];
  for (const { condition: parentCondition, rank } of carriedOverDiagnoses) {
    const newConditionUrl = `urn:uuid:${uuid()}`;
    const newCondition: Condition = {
      resourceType: 'Condition',
      subject: { reference: patientRef },
      encounter: { reference: encUrl },
      code: parentCondition.code,
      clinicalStatus: parentCondition.clinicalStatus,
      verificationStatus: parentCondition.verificationStatus,
      meta: {
        tag: [
          {
            code: 'diagnosis',
            system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis`,
          },
        ],
      },
    };
    followUpDiagnosisRequests.push({
      method: 'POST',
      url: '/Condition',
      resource: newCondition,
      fullUrl: newConditionUrl,
    });
    followUpDiagnosisEntries.push({
      condition: { reference: newConditionUrl },
      ...(rank !== undefined && { rank }),
    });
>>>>>>> c6ed511e429c3cf6d025face3740ce71fdb39d29
  }
*/

  // Carry over diagnoses from the parent encounter to the follow-up by cloning each Dx Condition
  // and attaching it to the new encounter's diagnosis array (preserving rank/primary).
  const followUpDiagnosisRequests: BatchInputPostRequest<Condition>[] = [];
  const followUpDiagnosisEntries: NonNullable<Encounter['diagnosis']> = [];
  for (const { condition: parentCondition, rank } of carriedOverDiagnoses) {
    const newConditionUrl = `urn:uuid:${uuid()}`;
    const newCondition: Condition = {
      resourceType: 'Condition',
      subject: { reference: patientRef },
      encounter: { reference: encUrl },
      code: parentCondition.code,
      clinicalStatus: parentCondition.clinicalStatus,
      verificationStatus: parentCondition.verificationStatus,
      meta: {
        tag: [
          {
            code: 'diagnosis',
            system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis`,
          },
        ],
      },
    };
    followUpDiagnosisRequests.push({
      method: 'POST',
      url: '/Condition',
      resource: newCondition,
      fullUrl: newConditionUrl,
    });
    followUpDiagnosisEntries.push({
      condition: { reference: newConditionUrl },
      ...(rank !== undefined && { rank }),
    });
  }

  const encResource: Encounter = {
    resourceType: 'Encounter',
    status: initialEncounterStatus,
    statusHistory: [
      {
        status: initialEncounterStatus,
        period: {
          start: nowIso,
        },
      },
    ],
    // todo double check this is the correct classification
    class: getEncounterClass(serviceMode),
    subject: { reference: patientRef },
    appointment: [
      {
        reference: apptUrl,
      },
    ],
    location: bookingLocation
      ? [
          {
            location: {
              reference: `Location/${bookingLocation.id}`,
            },
          },
        ]
      : [],
    //...(encounterParticipants ? { participant: encounterParticipants } : {}), todo: related to merge conflict above
    extension: encExtensions,
    ...(followUpDiagnosisEntries.length > 0 && { diagnosis: followUpDiagnosisEntries }),
    ...(parentEncounterId && {
      partOf: { reference: `Encounter/${parentEncounterId}` },
      type: [
        {
          coding: [
            {
              system: FOLLOWUP_SYSTEMS.type.url,
              code: FOLLOWUP_SYSTEMS.type.code,
              display: 'Follow-up Encounter',
            },
            {
              system: FOLLOWUP_SUBTYPE_SYSTEM,
              code: 'scheduled',
              display: 'scheduled',
            },
          ],
          text: 'Follow-up Encounter',
        },
      ],
    }),
  };

  const { documents, accountInfo } = await getRelatedResources(oystehr, patient?.id);

  const patientToUse = patient ?? (createPatientRequest?.resource as Patient);

  let currentPatientAccount: Account | undefined;
  if (patient !== undefined) {
    currentPatientAccount = accountInfo?.account;
  }

  const item: QuestionnaireResponseItem[] = makePrepopulatedItemsForPatient({
    patient: patientToUse,
    isNewQrsPatient: createPatientRequest?.resource !== undefined,
    verifiedPhoneNumber,
    contactInfo,
    newPatientDob,
    appointmentStartTime: startTime,
    appointmentServiceCategory: getCoding(slot?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code ?? '',
    reasonForVisit,
    questionnaire,
    documents,
    accountInfo,
  });

  console.log(
    'prepopulated items for patient questionnaire response before adding previous response',
    JSON.stringify(item)
  );

  const questionnaireResponseResource: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: 'in-progress',
    subject: { reference: patientRef },
    encounter: { reference: encUrl },
    item, // contains the pre-populated answers for the Patient
  };

  const postQuestionnaireResponseRequest: BatchInputPostRequest<QuestionnaireResponse> = {
    method: 'POST',
    url: '/QuestionnaireResponse',
    resource: questionnaireResponseResource,
  };

  const postApptReq: BatchInputRequest<Appointment> = {
    method: 'POST',
    url: '/Appointment',
    resource: apptResource,
    fullUrl: apptUrl,
  };

  const postEncRequest: BatchInputRequest<Encounter> = {
    method: 'POST',
    url: '/Encounter',
    resource: encResource,
    fullUrl: encUrl,
  };

  const patientRequests: BatchInputRequest<Patient>[] = [];
  if (updatePatientRequest) {
    patientRequests.push(updatePatientRequest);
  }
  if (createPatientRequest) {
    patientRequests.push(createPatientRequest);
  }

  const confirmationTextTask = getTaskResource(
    TaskIndicator.confirmationMessages,
    `Send confirmation text to ${getFullestAvailableName(patientToUse)}`,
    apptUrl
  );
  const taskRequest: BatchInputPostRequest<Task> = {
    method: 'POST',
    url: '/Task',
    resource: confirmationTextTask,
  };

  const postAccountRequests: BatchInputPostRequest<Account>[] = [];
  if (createPatientRequest?.fullUrl) {
    const accountResource: Account = {
      resourceType: 'Account',
      status: 'active',
      type: { ...PATIENT_BILLING_ACCOUNT_TYPE },
      subject: [{ reference: createPatientRequest.fullUrl }],
    };
    postAccountRequests.push({
      method: 'POST',
      url: '/Account',
      resource: accountResource,
    });
  } else if (patient && currentPatientAccount === undefined) {
    const accountResource: Account = {
      resourceType: 'Account',
      status: 'active',
      type: { ...PATIENT_BILLING_ACCOUNT_TYPE },
      subject: [{ reference: `Patient/${patient.id}` }],
    };
    postAccountRequests.push({
      method: 'POST',
      url: '/Account',
      resource: accountResource,
    });
  }

  const postAccidentConditionRequests: BatchInputPostRequest<Condition>[] = [];
  const serviceCategoryCode = getCoding(slot?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
  if (serviceCategoryCode === 'workers-comp') {
    postAccidentConditionRequests.push({
      method: 'POST',
      url: '/Condition',
      resource: {
        resourceType: 'Condition',
        subject: { reference: patientRef },
        encounter: { reference: encUrl },
        code: {
          coding: [
            {
              system: ACCIDENT_TYPE_SYSTEM,
              code: 'EM',
            },
          ],
        },
        meta: {
          tag: [
            {
              code: 'accident',
              system: `${PRIVATE_EXTENSION_BASE_URL}/accident`,
            },
          ],
        },
      },
    });
  }

  const transactionInput: BatchInput<
    Appointment | Encounter | Patient | List | QuestionnaireResponse | Account | Task | Slot | Condition
  > = {
    requests: [
      ...patientRequests,
      ...listRequests,
      ...postAccountRequests,
      ...postSlotRequests,
      ...patchSlotRequests,
      postApptReq,
      postEncRequest,
      postQuestionnaireResponseRequest,
      taskRequest,
      ...postAccidentConditionRequests,
      ...followUpDiagnosisRequests,
    ],
  };
  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction(transactionInput);
  const resources = extractResourcesFromBundle(bundle);
  return resources;
};

const extractResourcesFromBundle = (bundle: Bundle<Resource>): TransactionOutput => {
  console.log('getting resources from bundle');
  const entry = bundle.entry ?? [];

  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;

  const encounter: Encounter = entry.find((enc) => {
    return enc.resource && enc.resource.resourceType === 'Encounter';
  })?.resource as Encounter;

  const patient: Patient = entry.find((enc) => {
    return enc.resource && enc.resource.resourceType === 'Patient';
  })?.resource as Patient;

  const questionnaireResponse: QuestionnaireResponse = entry.find((entry) => {
    return entry.resource && entry.resource.resourceType === 'QuestionnaireResponse';
  })?.resource as QuestionnaireResponse;

  if (appointment === undefined) {
    throw new Error('Appointment could not be created');
  }
  if (encounter === undefined) {
    throw new Error('Encounter could not be created');
  }
  if (patient === undefined) {
    throw new Error('Patient could not be found');
  }
  if (questionnaireResponse === undefined) {
    throw new Error('QuestionnaireResponse could not be created');
  }

  if (questionnaireResponse.id === undefined) {
    throw new Error('QuestionnaireResponse does not have an ID');
  }

  console.log('successfully obtained resources from bundle');
  return {
    appointment,
    encounter,
    patient,
    questionnaire: questionnaireResponse,
    questionnaireResponseId: questionnaireResponse.id,
  };
};

const injectMetadataIfNeeded = (maybeMetadata: Appointment['meta']): Appointment['meta'] => {
  let appointmentMetadata: Appointment['meta'] = maybeMetadata;
  console.log('PLAYWRIGHT_SUITE_ID: ', process.env.PLAYWRIGHT_SUITE_ID);
  let shouldInjectTestMetadata = process.env.PLAYWRIGHT_SUITE_ID ?? false;
  if (maybeMetadata && shouldInjectTestMetadata) {
    const hasTestTagAlready =
      maybeMetadata.tag?.some((coding) => {
        return coding.system === E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM;
      }) ?? false;
    shouldInjectTestMetadata = !hasTestTagAlready;
  }
  if (shouldInjectTestMetadata) {
    appointmentMetadata = {
      tag: [
        {
          system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
          code: process.env.PLAYWRIGHT_SUITE_ID,
        },
      ],
    };
    console.log('using test metadata: ', JSON.stringify(appointmentMetadata, null, 2));
  }
  return appointmentMetadata;
};
