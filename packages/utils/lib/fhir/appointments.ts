import Oystehr, { BatchInput, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Account,
  Appointment,
  AppointmentParticipant,
  Bundle,
  CodeableConcept,
  Coding,
  Coverage,
  DocumentReference,
  Encounter,
  Extension,
  InsurancePlan,
  List,
  Organization,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
  RelatedPerson,
  Resource,
  Slot,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  AppointmentType,
  assertDefined,
  CanonicalUrl,
  CreateAppointmentResponse,
  CREATED_BY_SYSTEM,
  createPatientDocumentLists,
  createUserResourcesForPatient,
  deduplicateUnbundledResources,
  diffInMinutes,
  EncounterVirtualServiceExtension,
  FhirAppointmentStatus,
  FhirEncounterStatus,
  FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG,
  FHIR_APPOINTMENT_TYPE_MAP,
  FHIR_EXTENSION,
  formatPhoneNumber,
  formatPhoneNumberDisplay,
  getAppointmentDurationFromSlot,
  getCanonicalQuestionnaire,
  getPatchBinary,
  getPatchOperationForNewMetaTag,
  getPatientResourceWithVerifiedPhoneNumber,
  getTaskResource,
  isValidUUID,
  makePrepopulatedItemsForPatient,
  normalizePhoneNumber,
  OrderedCoveragesWithSubscribers,
  OtherParticipantsExtension,
  OTTEHR_MODULE,
  PatientAccountAndCoverageResources,
  PatientAccountResponse,
  PatientInfo,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PATIENT_NOT_FOUND_ERROR,
  PUBLIC_EXTENSION_BASE_URL,
  removeTimeFromDate,
  ScheduleOwnerFhirResource,
  Secrets,
  ServiceMode,
  takeContainedOrFind,
  TaskIndicator,
  TelemedAppointmentStatusEnum,
  TelemedStatusHistoryElement,
  TELEMED_VIDEO_ROOM_CODE,
  User,
  VisitType,
} from 'utils';

export async function cancelAppointmentResource(
  appointment: Appointment,
  cancellationReasonCoding: NonNullable<CodeableConcept['coding']>,
  oystehr: Oystehr
): Promise<Appointment> {
  if (!appointment.id) {
    throw Error('Appointment resource missing id');
  }

  try {
    const response: Appointment = await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: appointment.id,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
        {
          op: 'add',
          path: '/cancelationReason',
          value: {
            coding: cancellationReasonCoding,
          },
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to cancel Appointment: ${JSON.stringify(error)}`);
  }
}

export const isAppointmentVirtual = (appointment: Appointment): boolean => {
  return appointment.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM) || false;
};

export const getAppointmentWaitingTime = (statuses?: TelemedStatusHistoryElement[]): number | undefined => {
  if (!statuses) {
    return undefined;
  }

  const onVideoIndex = statuses?.findIndex((status) => status.status === TelemedAppointmentStatusEnum['on-video']);

  const statusesToWait = onVideoIndex === -1 ? statuses : statuses.slice(0, onVideoIndex);

  const start = statusesToWait.at(0)?.start;
  const end = statusesToWait.at(-1)?.end;

  if (!start)
    throw new Error(
      `Can't getAppointmentWaitingTime because start time of ${JSON.stringify(statusesToWait.at(0))} status is empty`
    );
  return end
    ? diffInMinutes(DateTime.fromISO(end), DateTime.fromISO(start))
    : diffInMinutes(DateTime.now(), DateTime.fromISO(start));
};

export async function getAppointmentResourceById(
  appointmentID: string,
  oystehr: Oystehr
): Promise<Appointment | undefined> {
  let response: Appointment | null = null;
  try {
    response = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}

export const getVirtualServiceResourceExtension = (
  resource: Appointment | Encounter,
  code: typeof TELEMED_VIDEO_ROOM_CODE | 'twilio-conversations'
): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  if (resource.resourceType === 'Appointment') {
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (resource.extension?.length ?? 0); index++) {
    const extension = resource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension?.valueCoding?.code === code) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const appointmentTypeForAppointment = (appointment: Appointment): AppointmentType => {
  // might as well default to walkin here
  // console.log('FHIR_APPOINTMENT_TYPE_MAP', FHIR_APPOINTMENT_TYPE_MAP, appointment.appointmentType?.text);
  return appointment.appointmentType?.text
    ? FHIR_APPOINTMENT_TYPE_MAP[appointment.appointmentType?.text] || 'walk-in'
    : 'walk-in';
};

export interface CreateAppointmentInput {
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
  unconfirmedDateOfBirth?: string;
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
    unconfirmedDateOfBirth,
    serviceMode,
    questionnaireCanonical: questionnaireUrl,
  } = input;

  const { verifiedPhoneNumber, listRequests, createPatientRequest, updatePatientRequest, isEHRUser, maybeFhirPatient } =
    await generatePatientRelatedRequests(user, patient, oystehr);

  let startTime = visitType === VisitType.WalkIn ? DateTime.now().setZone('UTC').toISO() || '' : slot?.start ?? '';
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: getAppointmentDurationFromSlot(slot) }).toISO() || '';
  const formattedUserNumber = formatPhoneNumberDisplay(user.name.replace('+1', ''));
  const createdBy = isEHRUser
    ? `Staff ${user?.email} via QRS`
    : `${visitType === VisitType.WalkIn ? 'QR - ' : ''}Patient${formattedUserNumber ? ` ${formattedUserNumber}` : ''}`;

  console.log('getting questionnaire ID to create blank questionnaire response');
  const currentQuestionnaire = await getCanonicalQuestionnaire(questionnaireUrl, oystehr);
  let verifiedFormattedPhoneNumber = verifiedPhoneNumber;

  if (!patient.id && !verifiedPhoneNumber) {
    console.log('Getting verifiedPhoneNumber for new patient');
    if (isEHRUser) {
      if (!patient.phoneNumber) {
        throw new Error('No phone number found for patient');
      }
      verifiedFormattedPhoneNumber = formatPhoneNumber(patient.phoneNumber);
    } else {
      // User is patient and auth0 already appends a +1 to the phone number
      verifiedFormattedPhoneNumber = formatPhoneNumber(user.name);
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
    visitType,
    secrets,
    verifiedPhoneNumber: verifiedFormattedPhoneNumber,
    contactInfo: { phone: verifiedFormattedPhoneNumber ?? 'not provided', email: patient.email ?? 'not provided' },
    questionnaire: currentQuestionnaire,
    oystehr: oystehr,
    updatePatientRequest,
    createPatientRequest,
    listRequests,
    unconfirmedDateOfBirth,
    newPatientDob: (createPatientRequest?.resource as Patient | undefined)?.birthDate,
    createdBy,
    slot,
  });

  let relatedPersonId = '';

  // Three cases:
  // New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
  // Returning user, new patient, get the user's conversation and add the participant RelatedPerson
  // Returning user, returning patient, get the user's conversation
  if (!patient.id && fhirPatient.id) {
    console.log('New patient');
    if (!verifiedFormattedPhoneNumber) {
      throw new Error('No phone number found for patient');
    }
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    // todo: this needs to happen transactionally with the other must-happen-for-this-request-to-succeed items
    const userResource = await createUserResourcesForPatient(oystehr, fhirPatient.id, verifiedFormattedPhoneNumber);
    relatedPersonId = userResource?.relatedPerson?.id || '';
    const person = userResource.person;

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
    }
  }

  console.log('success, here is the id: ', appointment.id);

  return {
    message: 'Successfully created an appointment and encounter',
    appointment: appointment.id || '',
    fhirPatientId: fhirPatient.id || '',
    questionnaireResponseId: questionnaireResponseId || '',
    encounterId: encounter.id || '',
    relatedPersonId: relatedPersonId,
    resources: {
      appointment,
      encounter,
      questionnaire,
      patient: fhirPatient,
    },
  };
}

interface TransactionInput {
  reasonForVisit: string;
  startTime: string;
  endTime: string;
  visitType: VisitType;
  scheduleOwner: ScheduleOwnerFhirResource;
  serviceMode: ServiceMode;
  questionnaire: Questionnaire;
  oystehr: Oystehr;
  secrets: Secrets | null;
  createdBy: string;
  verifiedPhoneNumber: string | undefined;
  contactInfo: { phone: string; email: string };
  additionalInfo?: string;
  unconfirmedDateOfBirth?: string;
  patient?: Patient;
  newPatientDob?: string;
  createPatientRequest?: BatchInputPostRequest<Patient>;
  listRequests: BatchInputRequest<List>[];
  updatePatientRequest?: BatchInputRequest<Patient>;
  formUser?: string;
  slot?: Slot;
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
    questionnaire,
    reasonForVisit,
    startTime,
    endTime,
    visitType,
    verifiedPhoneNumber,
    contactInfo,
    additionalInfo,
    unconfirmedDateOfBirth,
    createPatientRequest,
    listRequests,
    updatePatientRequest,
    newPatientDob,
    createdBy,
    serviceMode,
    slot,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl || '';

  const now = DateTime.now().setZone('UTC');
  const nowIso = now.toISO() ?? '';
  let initialAppointmentStatus: FhirAppointmentStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'booked' : 'arrived';
  let initialEncounterStatus: FhirEncounterStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'planned' : 'arrived';

  const apptExtensions: Extension[] = [];
  const encExtensions: Extension[] = [];

  if (serviceMode === ServiceMode.virtual) {
    initialAppointmentStatus = 'arrived';
    initialEncounterStatus = 'planned';

    const { encExtensions: telemedEncExtensions, apptExtensions: telemedApptExtensions } =
      getTelemedRequiredAppointmentEncounterExtensions(patientRef, nowIso);
    apptExtensions.push(...telemedApptExtensions);
    encExtensions.push(...telemedEncExtensions);
  }

  if (unconfirmedDateOfBirth) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
      valueString: unconfirmedDateOfBirth,
    });
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

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      tag: [
        { code: serviceMode === ServiceMode.virtual ? OTTEHR_MODULE.TM : OTTEHR_MODULE.IP },
        {
          system: CREATED_BY_SYSTEM,
          display: createdBy,
        },
      ],
    },
    participant: participants,
    start: startTime,
    end: endTime,
    slot: slotReference ? [slotReference] : undefined,
    appointmentType: {
      text: visitType,
    },
    description: reasonForVisit,
    status: initialAppointmentStatus,
    created: now.toISO() ?? '',
    extension: apptExtensions,
  };

  const encUrl = `urn:uuid:${uuid()}`;

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
    location:
      scheduleOwner.resourceType === 'Location'
        ? [
            {
              location: {
                reference: `Location/${scheduleOwner.id}`,
              },
            },
          ]
        : [],
    extension: encExtensions,
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
    unconfirmedDateOfBirth,
    appointmentStartTime: startTime,
    questionnaire,
    documents,
    accountInfo,
  });

  console.log(
    'prepopulated items for patient questionnaire response before adding previous response',
    JSON.stringify(item)
  );

  const questionnaireID = questionnaire.id;
  if (!questionnaireID) {
    throw new Error('Missing questionnaire id');
  }

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

  const confirmationTextTask = getTaskResource(TaskIndicator.confirmationMessages, apptUrl);
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

  const transactionInput: BatchInput<
    Appointment | Encounter | Patient | List | QuestionnaireResponse | Account | Task | Slot
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
    ],
  };
  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction(transactionInput);
  const resources = extractResourcesFromBundle(bundle);
  await oystehr.fhir.patch({
    resourceType: 'Appointment',
    id: resources.appointment.id!,
    operations: [getPatchOperationForNewMetaTag(resources.appointment, FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG)],
  });
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

  console.log('successfully obtained resources from bundle');
  return {
    appointment,
    encounter,
    patient,
    questionnaire: questionnaireResponse,
    questionnaireResponseId: questionnaireResponse.id || '',
  };
};

export async function generatePatientRelatedRequests(
  user: User,
  patient: PatientInfo,
  oystehr: Oystehr
): Promise<{
  updatePatientRequest: BatchInputRequest<Patient> | undefined;
  createPatientRequest: BatchInputPostRequest<Patient> | undefined;
  listRequests: BatchInputRequest<List>[];
  verifiedPhoneNumber: string | undefined;
  isEHRUser: boolean;
  maybeFhirPatient: Patient | undefined;
}> {
  let maybeFhirPatient: Patient | undefined = undefined;
  let updatePatientRequest: BatchInputRequest<Patient> | undefined = undefined;
  let createPatientRequest: BatchInputPostRequest<Patient> | undefined = undefined;
  let verifiedPhoneNumber: string | undefined = undefined;
  const listRequests: BatchInputRequest<List>[] = [];
  // if the user is the ottehr staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = !user.name.startsWith('+');

  // if it is a returning patient
  if (patient.id) {
    console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);
    const { patient: foundPatient, verifiedPhoneNumber: foundPhoneNumber } =
      await getPatientResourceWithVerifiedPhoneNumber(patient.id, oystehr);
    maybeFhirPatient = foundPatient;
    verifiedPhoneNumber = foundPhoneNumber;
    if (!maybeFhirPatient) {
      throw PATIENT_NOT_FOUND_ERROR;
    }

    updatePatientRequest = creatingPatientUpdateRequest(patient, maybeFhirPatient);
  } else {
    createPatientRequest = creatingPatientCreateRequest(patient, isEHRUser);

    if (createPatientRequest?.fullUrl) {
      const patientLists = createPatientDocumentLists(createPatientRequest.fullUrl);
      listRequests.push(
        ...patientLists.map(
          (list): BatchInputPostRequest<List> => ({
            method: 'POST',
            url: '/List',
            resource: list,
          })
        )
      );
    }
  }

  return {
    updatePatientRequest,
    createPatientRequest,
    listRequests,
    verifiedPhoneNumber,
    isEHRUser,
    maybeFhirPatient,
  };
}

export async function createUpdateUserRelatedResources(
  oystehr: Oystehr,
  patientInfo: PatientInfo,
  fhirPatient: Patient,
  user: User
): Promise<{ relatedPersonRef: string | undefined; verifiedPhoneNumber: string | undefined }> {
  console.log('patient info: ' + JSON.stringify(patientInfo));

  let verifiedPhoneNumber: string | undefined = undefined;

  if (!patientInfo.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    verifiedPhoneNumber = checkUserPhoneNumber(patientInfo, user);
    const userResource = await createUserResourcesForPatient(oystehr, fhirPatient.id, verifiedPhoneNumber);
    const relatedPerson = userResource.relatedPerson;
    const person = userResource.person;

    console.log(5, person.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value);

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
    }

    return { relatedPersonRef: `RelatedPerson/${relatedPerson.id}`, verifiedPhoneNumber: verifiedPhoneNumber };
  }

  return { relatedPersonRef: undefined, verifiedPhoneNumber: verifiedPhoneNumber };
}

export function creatingPatientUpdateRequest(
  patient: PatientInfo,
  maybeFhirPatient: Patient
): BatchInputRequest<Patient> | undefined {
  if (!patient.id) return undefined;
  console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);

  let updatePatientRequest: BatchInputRequest<Patient> | undefined = undefined;

  const patientPatchOperations: Operation[] = [];

  // store form user (aka emailUser)
  let patientExtension = maybeFhirPatient.extension || [];

  // Store weight
  const weightExtIndex = patientExtension.findIndex((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url);
  const weightLastUpdatedIndex = patientExtension.findIndex(
    (ext) => ext.url === FHIR_EXTENSION.Patient.weightLastUpdated.url
  );
  if (patient.weight) {
    const newWeight = String(patient.weight);
    const weight = {
      url: FHIR_EXTENSION.Patient.weight.url,
      valueString: newWeight,
    };
    const weightLastUpdated = {
      url: FHIR_EXTENSION.Patient.weightLastUpdated.url,
      valueString: DateTime.now().toFormat('yyyy-LL-dd'),
    };
    // Check if weight exists
    if (weightExtIndex >= 0) {
      // Update weight if supplied to update weightLastUpdated
      patientExtension[weightExtIndex] = weight;
      patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
    } else if (weightLastUpdatedIndex >= 0) {
      // Patient weight used to exist but has been removed, add to patch operations
      patientExtension.push(weight);
      patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
    } else {
      // Since no extensions exist, it must be added via patch operations
      patientExtension.push(weight);
      patientExtension.push(weightLastUpdated);
    }
  } else if (weightLastUpdatedIndex >= 0 && weightExtIndex >= 0) {
    // Weight removed but has been provided before
    patientExtension = [...patientExtension.slice(0, weightExtIndex), ...patientExtension.slice(weightExtIndex + 1)];
    // Do not update weight last updated date
  }

  console.log('patient extension', patientExtension);

  patientPatchOperations.push({
    op: maybeFhirPatient.extension ? 'replace' : 'add',
    path: '/extension',
    value: patientExtension,
  });

  const emailPatchOps = getPatientPatchOpsPatientEmail(maybeFhirPatient, patient.email);
  if (emailPatchOps.length >= 1) {
    patientPatchOperations.push(...emailPatchOps);
  }

  const fhirPatientName = assertDefined(maybeFhirPatient.name, 'patient.name');

  let fhirPatientOfficialNameIndex = fhirPatientName.findIndex((name) => name.use === 'official');

  if (fhirPatientOfficialNameIndex === -1) {
    fhirPatientOfficialNameIndex = 0;
  }

  const fhirPatientMiddleName = fhirPatientName[fhirPatientOfficialNameIndex].given?.[1];

  if (patient.middleName && !fhirPatientMiddleName) {
    console.log('adding patch op to add middle name', patient.middleName);
    patientPatchOperations.push({
      op: 'add',
      path: `/name/${fhirPatientOfficialNameIndex}/given/1`,
      value: patient.middleName,
    });
  }

  const fhirPatientPreferredName = maybeFhirPatient?.name?.find((name) => name.use === 'nickname');
  const fhirPatientPreferredNameIndex = maybeFhirPatient.name?.findIndex((name) => name.use === 'nickname');

  if (patient.chosenName) {
    if (fhirPatientPreferredName) {
      if (fhirPatientPreferredName.given?.[0] !== patient.chosenName) {
        patientPatchOperations.push({
          op: 'replace',
          path: `/name/${fhirPatientPreferredNameIndex}/given/0`,
          value: patient.chosenName,
        });
      }
    } else {
      patientPatchOperations.push({
        op: 'add',
        path: `/name/-`,
        value: {
          given: [patient.chosenName],
          use: 'nickname',
        },
      });
    }
  }

  if (patient.sex !== maybeFhirPatient.gender) {
    // a value exists in the gender path on the patient resource
    if (maybeFhirPatient.gender) {
      patientPatchOperations.push({
        op: 'replace',
        path: `/gender`,
        value: patient.sex,
      });
    } else {
      patientPatchOperations.push({
        op: 'add',
        path: `/gender`,
        value: patient.sex,
      });
    }
  }

  const patientDateOfBirth = removeTimeFromDate(patient.dateOfBirth ?? '');
  if (maybeFhirPatient.birthDate !== patientDateOfBirth) {
    patientPatchOperations.push({
      op: maybeFhirPatient.birthDate ? 'replace' : 'add',
      path: '/birthDate',
      value: patientDateOfBirth,
    });
  }

  if (patientPatchOperations.length >= 1) {
    console.log('getting patch binary for patient operations');
    updatePatientRequest = getPatchBinary({
      resourceType: 'Patient',
      resourceId: patient.id,
      patchOperations: patientPatchOperations,
    });
  }

  return updatePatientRequest;
}

export function getPatientPatchOpsPatientEmail(maybeFhirPatient: Patient, email: string | undefined): Operation[] {
  const patientPatchOperations: Operation[] = [];
  // update email
  if (email) {
    const telecom = maybeFhirPatient.telecom;
    const curEmail = telecom?.find((tele) => tele.system === 'email');
    const curEmailidx = telecom?.findIndex((tele) => tele.system === 'email');
    // check email exists in telecom but is different
    if (telecom && curEmailidx && curEmailidx > -1 && email !== curEmail) {
      telecom[curEmailidx] = {
        system: 'email',
        value: email,
      };
      patientPatchOperations.push({
        op: 'replace',
        path: '/telecom',
        value: telecom,
      });
    }
    // check if telecom exists but without email
    if (telecom && !curEmail) {
      telecom.push({
        system: 'email',
        value: email,
      });
      patientPatchOperations.push({
        op: 'replace',
        path: '/telecom',
        value: telecom,
      });
    }
    // add if no telecom
    if (!telecom) {
      patientPatchOperations.push({
        op: 'add',
        path: '/telecom',
        value: [
          {
            system: 'email',
            value: email,
          },
        ],
      });
    }
  }
  return [];
}

export function creatingPatientCreateRequest(
  patient: PatientInfo,
  isEHRUser: boolean
): BatchInputPostRequest<Patient> | undefined {
  let createPatientRequest: BatchInputPostRequest<Patient> | undefined = undefined;

  if (!patient.firstName) {
    throw new Error('First name is undefined');
  }
  console.log('building patient resource');
  const patientResource: Patient = {
    resourceType: 'Patient',
    name: [
      {
        given: patient.middleName ? [patient.firstName, patient.middleName] : [patient.firstName],
        family: patient.lastName,
        use: 'official',
      },
    ],
    birthDate: removeTimeFromDate(patient.dateOfBirth ?? ''),
    gender: patient.sex,
    active: true,
  };
  if (patient.chosenName) {
    patientResource.name!.push({
      given: [patient.chosenName],
      use: 'nickname',
    });
  }
  if (patient.weight) {
    patientResource.extension?.push({
      url: FHIR_EXTENSION.Patient.weight.url,
      valueString: String(patient.weight),
    });
    patientResource.extension?.push({
      url: FHIR_EXTENSION.Patient.weightLastUpdated.url,
      valueString: DateTime.now().toFormat('yyyy-LL-dd'),
    });
  }

  if (patient.email) {
    if (isEHRUser) {
      patientResource.telecom = [
        {
          system: 'email',
          value: patient.email,
        },
        {
          system: 'phone',
          value: normalizePhoneNumber(patient.phoneNumber),
        },
      ];
    } else {
      patientResource.telecom = [
        {
          system: 'email',
          value: patient.email,
        },
      ];
    }
  }

  if (patient.address) {
    patientResource.address = patient.address;
  }

  console.log('creating patient request for new patient resource');
  createPatientRequest = {
    method: 'POST',
    url: '/Patient',
    fullUrl: `urn:uuid:${uuid()}`,
    resource: patientResource,
  };

  return createPatientRequest;
}

export const getTelemedRequiredAppointmentEncounterExtensions = (
  patientRef: string,
  dateTimeNow: string
): {
  apptExtensions: Extension[];
  encExtensions: Extension[];
} => {
  const apptVirtualServiceExtension: Extension = {
    url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
    extension: [
      {
        url: 'channelType',
        valueCoding: {
          system: 'https://fhir.zapehr.com/virtual-service-type',
          code: TELEMED_VIDEO_ROOM_CODE,
          display: 'Twilio Video Group Rooms',
        },
      },
    ],
  };
  const encExtensions: Extension[] = [
    {
      ...apptVirtualServiceExtension,
      url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
    },
    {
      url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
      extension: [
        {
          url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
          extension: [
            {
              url: 'period',
              valuePeriod: {
                start: dateTimeNow,
              },
            },
            {
              url: 'reference',
              valueReference: {
                reference: patientRef,
              },
            },
          ],
        },
      ],
    } as OtherParticipantsExtension,
  ];

  return {
    apptExtensions: [apptVirtualServiceExtension],
    encExtensions,
  };
};

export const getEncounterClass = (serviceType: ServiceMode): Coding => {
  return serviceType === 'virtual'
    ? {
        system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
        code: 'VR',
        display: 'virtual',
      }
    : {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
      };
};

export async function getRelatedResources(
  oystehr: Oystehr,
  patientId?: string
): Promise<{
  documents: DocumentReference[];
  accountInfo: PatientAccountResponse | undefined;
}> {
  let documents: DocumentReference[] = [];
  let accountInfo: PatientAccountResponse | undefined = undefined;

  if (patientId) {
    console.log('get related resources to prepopulate paperwork');
    const [docsResponse, insuranceResponse] = await Promise.all([
      oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: 'related',
            value: `Patient/${patientId}`,
          },
          {
            name: 'status',
            value: 'current',
          },
        ],
      }),
      getAccountAndCoverageResourcesForPatient(patientId, oystehr),
    ]);

    const primaryCarePhysician = insuranceResponse.patient?.contained?.find(
      (resource) => resource.resourceType === 'Practitioner' && resource.active === true
    ) as Practitioner;

    documents = docsResponse.unbundle();
    accountInfo = {
      ...insuranceResponse,
      primaryCarePhysician,
      coverageChecks: [], // these aren't needed here
    };
  }

  return { documents, accountInfo };
}

export function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  // If the user is the ottehr staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = !user.name.startsWith('+');
  if (isEHRUser) {
    // User is ottehr staff
    if (!patient.phoneNumber) {
      throw new Error('No phone number found for patient');
    }
    patientNumberToText = formatPhoneNumber(patient.phoneNumber);
    if (!patientNumberToText) {
      throw new Error('Patient phone number has some wrong format');
    }
  } else {
    // User is patient and auth0 already appends a +1 to the phone number
    patientNumberToText = user.name;
  }
  return patientNumberToText;
}

export const getAccountAndCoverageResourcesForPatient = async (
  patientId: string,
  oystehr: Oystehr
): Promise<PatientAccountAndCoverageResources> => {
  console.time('querying for Patient account resources');
  const accountAndCoverageResources = (
    await oystehr.fhir.search<Account | Coverage | RelatedPerson | Patient | InsurancePlan | Organization>({
      resourceType: 'Patient',
      params: [
        {
          name: '_id',
          value: patientId,
        },
        {
          name: '_revinclude',
          value: 'Account:patient',
        },
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude',
          value: 'Coverage:patient',
        },
        {
          name: '_include:iterate',
          value: 'Coverage:subscriber',
        },
        {
          name: '_include:iterate',
          value: 'Coverage:payor',
        },
        {
          name: '_revinclude:iterate',
          value: 'InsurancePlan:owned-by',
        },
      ],
    })
  ).unbundle();
  console.timeEnd('querying for Patient account resources');

  const patientResource = accountAndCoverageResources.find(
    (r) => r.resourceType === 'Patient' && r.id === patientId
  ) as Patient;

  const resources = accountAndCoverageResources.filter((resource) => {
    if (resource.resourceType === 'Account') {
      return resource.status === 'active';
    }
    return true;
  });

  if (!patientResource) {
    throw PATIENT_NOT_FOUND_ERROR;
  }

  return getCoverageUpdateResourcesFromUnbundled({
    patient: patientResource,
    resources: [...resources],
  });
};

type UnbundledAccountResources = (Account | Coverage | RelatedPerson | Patient | InsurancePlan | Organization)[];
interface UnbundledAccountResourceWithInsuranceResources {
  patient: Patient;
  resources: UnbundledAccountResources;
}
// this function is exported for testing purposes
export const getCoverageUpdateResourcesFromUnbundled = (
  input: UnbundledAccountResourceWithInsuranceResources
): PatientAccountAndCoverageResources => {
  const { patient, resources: unfilteredResources } = input;
  const resources = deduplicateUnbundledResources(unfilteredResources);
  const accountResources = resources.filter((res): res is Account => res.resourceType === 'Account');
  const coverageResources = resources.filter((res): res is Coverage => res.resourceType === 'Coverage');

  let existingAccount: Account | undefined;
  let existingGuarantorResource: RelatedPerson | Patient | undefined;

  if (accountResources.length >= 0) {
    existingAccount = accountResources[0];
  }

  const existingCoverages: OrderedCoveragesWithSubscribers = {};
  if (existingAccount) {
    const guarantorReference = existingAccount.guarantor?.find((gref) => {
      return gref.period?.end === undefined;
    })?.party?.reference;
    if (guarantorReference) {
      existingGuarantorResource = takeContainedOrFind(guarantorReference, resources, existingAccount);
    }
    existingAccount.coverage?.forEach((cov) => {
      const coverage = coverageResources.find((c) => c.id === cov.coverage?.reference?.split('/')[1]);
      if (coverage) {
        if (cov.priority === 1) {
          existingCoverages.primary = coverage;
        } else if (cov.priority === 2) {
          existingCoverages.secondary = coverage;
        }
      }
    });
  } else {
    // find the free-floating existing coverages
    const primaryCoverages = coverageResources
      .filter((cov) => cov.order === 1 && cov.status === 'active')
      .sort((cova, covb) => {
        const covALastUpdate = cova.meta?.lastUpdated;
        const covBLastUpdate = covb.meta?.lastUpdated;
        if (covALastUpdate && covBLastUpdate) {
          const covALastUpdateDate = DateTime.fromISO(covALastUpdate);
          const covBLastUpdateDate = DateTime.fromISO(covBLastUpdate);
          if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
            return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
          }
        }
        return 0;
      });
    const secondaryCoverages = coverageResources
      .filter((cov) => cov.order === 2 && cov.status === 'active')
      .sort((cova, covb) => {
        const covALastUpdate = cova.meta?.lastUpdated;
        const covBLastUpdate = covb.meta?.lastUpdated;
        if (covALastUpdate && covBLastUpdate) {
          const covALastUpdateDate = DateTime.fromISO(covALastUpdate);
          const covBLastUpdateDate = DateTime.fromISO(covBLastUpdate);
          if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
            return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
          }
        }
        return 0;
      });

    if (primaryCoverages.length) {
      existingCoverages.primary = primaryCoverages[0];
    }
    if (secondaryCoverages.length) {
      existingCoverages.secondary = secondaryCoverages[0];
    }
  }

  const primarySubscriberReference = existingCoverages.primary?.subscriber?.reference;
  if (primarySubscriberReference && existingCoverages.primary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      primarySubscriberReference,
      resources,
      existingCoverages.primary
    );
    // console.log('checked primary subscriber reference:', subscriberResult);
    existingCoverages.primarySubscriber = subscriberResult;
  }

  const secondarySubscriberReference = existingCoverages.secondary?.subscriber?.reference;
  if (secondarySubscriberReference && existingCoverages.secondary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      secondarySubscriberReference,
      resources,
      existingCoverages.secondary
    );
    // console.log('checked secondary subscriber reference:', subscriberResult);
    existingCoverages.secondarySubscriber = subscriberResult;
  }

  const insurancePlans: InsurancePlan[] = resources.filter(
    (res): res is InsurancePlan => res.resourceType === 'InsurancePlan'
  );
  const insuranceOrgs: Organization[] = resources.filter(
    (res): res is Organization => res.resourceType === 'Organization'
  );

  return {
    patient,
    account: existingAccount,
    coverages: existingCoverages,
    insuranceOrgs,
    insurancePlans,
    guarantorResource: existingGuarantorResource,
  };
};
