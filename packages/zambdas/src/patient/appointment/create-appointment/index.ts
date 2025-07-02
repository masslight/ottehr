import Oystehr, { BatchInput, BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  Appointment,
  AppointmentParticipant,
  Bundle,
  Encounter,
  Extension,
  List,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
  Resource,
  Slot,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  CanonicalUrl,
  CreateAppointmentResponse,
  CREATED_BY_SYSTEM,
  createUserResourcesForPatient,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
  FHIR_APPOINTMENT_READY_FOR_PREPROCESSING_TAG,
  FHIR_EXTENSION,
  FhirAppointmentStatus,
  FhirEncounterStatus,
  formatPhoneNumber,
  formatPhoneNumberDisplay,
  getAppointmentDurationFromSlot,
  getCanonicalQuestionnaire,
  getSecret,
  getTaskResource,
  isValidUUID,
  makePrepopulatedItemsForPatient,
  OTTEHR_MODULE,
  PATIENT_BILLING_ACCOUNT_TYPE,
  PatientInfo,
  ScheduleOwnerFhirResource,
  Secrets,
  SecretsKeys,
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
  topLevelCatch,
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
  unconfirmedDateOfBirth?: string;
  appointmentMetadata?: Appointment['meta'];
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler('create-appointment', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    console.log('getting user');

    const token = input.headers.Authorization.replace('Bearer ', '');

    const user = await getUser(token, input.secrets);
    const validatedParameters = validateCreateAppointmentParams(input, user);
    const { secrets, unconfirmedDateOfBirth, language } = validatedParameters;
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
    } = effectInput;
    console.log('effectInput', effectInput);
    console.timeEnd('performing-complex-validation');

    const appointmentMetadata = injectMetadataIfNeeded(maybeMetadata);

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
        unconfirmedDateOfBirth,
        questionnaireCanonical,
        appointmentMetadata,
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
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-appointment', error, ENVIRONMENT, true);
  }
});

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
    appointmentMetadata,
  } = input;

  const { verifiedPhoneNumber, listRequests, createPatientRequest, updatePatientRequest, isEHRUser, maybeFhirPatient } =
    await generatePatientRelatedRequests(user, patient, oystehr);

  let startTime = visitType === VisitType.WalkIn ? DateTime.now().setZone('UTC').toISO() || '' : slot?.start ?? '';
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: getAppointmentDurationFromSlot(slot) }).toISO() || '';
  const formattedUserNumber = formatPhoneNumberDisplay(user.name.replace('+1', ''));
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
    performPreProcessing: !isTestUser(user),
    listRequests,
    unconfirmedDateOfBirth,
    newPatientDob: (createPatientRequest?.resource as Patient | undefined)?.birthDate,
    createdBy,
    slot,
    appointmentMetadata,
  });

  let relatedPersonId = '';

  // Three cases:
  // New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
  // Returning user, new patient, get the user's conversation and add the participant RelatedPerson
  // Returning user, returning patient, get the user's conversation
  if (!patient.id && fhirPatient.id) {
    console.log('New patient');
    if (!verifiedFormattedPhoneNumber) {
      throw new Error('No phone number found for patient 2');
    }
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    // todo: this needs to happen via a transactional with the other must-happen-for-this-request-to-succeed items
    const userResource = await createUserResourcesForPatient(oystehr, fhirPatient.id, verifiedFormattedPhoneNumber);
    relatedPersonId = userResource?.relatedPerson?.id || '';
    const person = userResource.person;

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
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
  performPreProcessing: boolean;
  updatePatientRequest?: BatchInputRequest<Patient>;
  formUser?: string;
  slot?: Slot;
  appointmentMetadata?: Appointment['meta'];
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
    performPreProcessing,
    listRequests,
    updatePatientRequest,
    newPatientDob,
    createdBy,
    serviceMode,
    slot,
    appointmentMetadata,
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
          code: `failsafe-${process.env.PLAYWRIGHT_SUITE_ID}`,
        },
      ],
    };
    console.log('using test metadata: ', JSON.stringify(appointmentMetadata, null, 2));
  }
  return appointmentMetadata;
};
