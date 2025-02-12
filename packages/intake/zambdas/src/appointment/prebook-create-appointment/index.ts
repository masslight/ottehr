import Oystehr, { BatchInput, BatchInputPostRequest, BatchInputRequest, User } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  AppointmentParticipant,
  Bundle,
  Encounter,
  Extension,
  HealthcareService,
  List,
  Location,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  CanonicalUrl,
  CHARACTER_LIMIT_EXCEEDED_ERROR,
  CreateAppointmentResponse,
  CREATED_BY_SYSTEM,
  createUserResourcesForPatient,
  deleteSpecificBusySlot,
  FHIR_EXTENSION,
  FhirAppointmentStatus,
  FhirEncounterStatus,
  formatPhoneNumber,
  formatPhoneNumberDisplay,
  getCanonicalQuestionnaire,
  makePrepopulatedItemsForPatient,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  OTTEHR_MODULE,
  PatientInfo,
  REASON_MAXIMUM_CHAR_LIMIT,
  ScheduleType,
  ServiceMode,
  userHasAccessToPatient,
  VisitType,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import '../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../../shared';
import { generatePatientRelatedRequests } from '../../shared/appointment';
import { getUser } from '../../shared/auth';
import { createOystehrClient } from '../../shared/helpers';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/userAuditLog';
import {
  getCanonicalUrlForPrevisitQuestionnaire,
  getEncounterClass,
  getTelemedRequiredAppointmentEncounterExtensions,
} from '../helpers';
import { CreateAppointmentValidatedInput, validateCreateAppointmentParams } from './validateRequestParameters';

interface CreateAppointmentInput extends Omit<CreateAppointmentValidatedInput, 'currentCanonicalQuestionnaireUrl'> {
  user: User;
  questionnaireCanonical: CanonicalUrl;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('create-appointment', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), input.secrets);
    const isEHRUser = !user.name.startsWith('+');
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(input.secrets);
    } else {
      console.log('already have token');
    }
    const oystehr = createOystehrClient(zapehrToken, input.secrets);
    const validatedParameters = await validateCreateAppointmentParams(input, isEHRUser, oystehr);

    const { slot, schedule, language, patient, secrets, scheduleType, visitType, unconfirmedDateOfBirth, serviceType } =
      validatedParameters;
    const questionnaireCanonical = getCanonicalUrlForPrevisitQuestionnaire(ServiceMode[serviceType], input.secrets);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));

    // todo access check? or just let zapehr handle??
    // * Validate internal information *
    validateInternalInformation(patient);
    // If it's a returning patient, check if the user has
    // access to create appointments for this patient
    if (patient.id) {
      const userAccess = await userHasAccessToPatient(user, patient.id, oystehr);
      if (!userAccess && !isEHRUser) {
        throw NO_READ_ACCESS_TO_PATIENT_ERROR;
      } else if (isEHRUser) {
        console.log('user is flagged as an EHR User, therefore has access to create appointment');
      }
    }
    console.log('creating appointment');
    const { message, appointment, fhirPatientId, questionnaireResponseId, encounterId } = await createAppointment(
      {
        slot,
        scheduleType,
        schedule,
        patient,
        serviceType,
        user,
        language,
        secrets,
        visitType,
        unconfirmedDateOfBirth,
        questionnaireCanonical,
      },
      oystehr
    );

    await createAuditEvent(AuditableZambdaEndpoints.appointmentCreate, oystehr, input, fhirPatientId, secrets);

    const response = { message, appointment, fhirPatientId, questionnaireResponseId, encounterId };

    console.log(`fhirAppointment = ${JSON.stringify(response)}`, visitType);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    return topLevelCatch('create-appointment', error, input.secrets, captureSentryException);
  }
});

export async function createAppointment(
  input: CreateAppointmentInput,
  oystehr: Oystehr
): Promise<CreateAppointmentResponse> {
  const {
    slot,
    schedule,
    scheduleType,
    patient,
    user,
    secrets,
    visitType,
    unconfirmedDateOfBirth,
    serviceType,
    questionnaireCanonical: questionnaireUrl,
  } = input;

  const { verifiedPhoneNumber, listRequests, createPatientRequest, updatePatientRequest, isEHRUser, maybeFhirPatient } =
    await generatePatientRelatedRequests(user, patient, oystehr);

  let startTime = visitType === VisitType.WalkIn ? DateTime.now().setZone('UTC').toISO() || '' : slot;
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: 15 }).toISO() || ''; // todo: should this be scraped from the Appointment?
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
  } = await performTransactionalFhirRequests({
    patient: maybeFhirPatient,
    reasonForVisit: patient?.reasonForVisit || '',
    startTime,
    endTime,
    serviceType,
    visitType,
    schedule,
    scheduleType,
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
  });

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
  };
}

function validateInternalInformation(patient: PatientInfo): void {
  if (patient.reasonForVisit && patient.reasonForVisit.length > REASON_MAXIMUM_CHAR_LIMIT) {
    throw CHARACTER_LIMIT_EXCEEDED_ERROR('Reason for visit', REASON_MAXIMUM_CHAR_LIMIT);
  }
}

interface TransactionInput {
  reasonForVisit: string;
  startTime: string;
  endTime: string;
  visitType: VisitType;
  scheduleType: ScheduleType;
  serviceType: ServiceMode;
  schedule: Location | Practitioner | HealthcareService;
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
}
interface TransactionOutput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  questionnaireResponseId: string;
}

export const performTransactionalFhirRequests = async (input: TransactionInput): Promise<TransactionOutput> => {
  const {
    oystehr,
    patient,
    schedule,
    scheduleType,
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
    serviceType,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl || '';

  const now = DateTime.now().setZone('UTC');
  let initialAppointmentStatus: FhirAppointmentStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'booked' : 'arrived';
  let initialEncounterStatus: FhirEncounterStatus =
    visitType === VisitType.PreBook || visitType === VisitType.PostTelemed ? 'planned' : 'arrived';

  if (serviceType === ServiceMode.virtual) {
    initialAppointmentStatus = 'arrived';
    initialEncounterStatus = 'planned';
  }

  const extension: Extension[] = [];

  if (unconfirmedDateOfBirth) {
    extension.push({
      url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
      valueString: unconfirmedDateOfBirth,
    });
  }

  if (additionalInfo) {
    extension.push({
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
  if (scheduleType === 'location') {
    participants.push({
      actor: {
        reference: `Location/${schedule.id}`,
      },
      status: 'accepted',
    });
  }
  if (scheduleType === 'provider') {
    participants.push({
      actor: {
        reference: `Practitioner/${schedule.id}`,
      },
      status: 'accepted',
    });
  }
  if (scheduleType === 'group') {
    participants.push({
      actor: {
        reference: `HealthcareService/${schedule.id}`,
      },
      status: 'accepted',
    });
  }

  const nowIso = DateTime.now().setZone('UTC').toISO() ?? '';

  const { encExtensions: telemedEncExtensions, apptExtensions: telemedApptExtensions } =
    getTelemedRequiredAppointmentEncounterExtensions(patientRef, nowIso);

  const isVirtual = serviceType === ServiceMode['virtual'];

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      tag: [
        { code: isVirtual ? OTTEHR_MODULE.TM : OTTEHR_MODULE.IP },
        {
          system: CREATED_BY_SYSTEM,
          display: createdBy,
        },
      ],
    },
    participant: participants,
    start: startTime,
    end: endTime,
    appointmentType: {
      text: visitType,
    },
    description: reasonForVisit,
    status: initialAppointmentStatus,
    created: now.toISO() ?? '',
    extension: [...extension, ...(isVirtual ? telemedApptExtensions : [])],
  };

  // if prebook, link a busy slot
  if (visitType === VisitType.PreBook) {
    await deleteSpecificBusySlot(startTime, schedule.id ?? '', oystehr);
  }

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
    class: getEncounterClass(serviceType),
    subject: { reference: patientRef },
    appointment: [
      {
        reference: apptUrl,
      },
    ],
    location:
      scheduleType === 'location'
        ? [
            {
              location: {
                reference: `Location/${schedule.id}`,
              },
            },
          ]
        : [],
    extension: [...(isVirtual ? telemedEncExtensions : [])],
  };

  const patientToUse = patient ?? (createPatientRequest?.resource as Patient);

  const item: QuestionnaireResponseItem[] = makePrepopulatedItemsForPatient({
    patient: patientToUse,
    isNewQrsPatient: createPatientRequest?.resource !== undefined,
    verifiedPhoneNumber,
    contactInfo,
    newPatientDob,
    unconfirmedDateOfBirth,
    appointmentStartTime: startTime,
    questionnaire,
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

  const transactionInput: BatchInput<Appointment | Encounter | Patient | List | QuestionnaireResponse> = {
    requests: [...patientRequests, ...listRequests, postApptReq, postEncRequest, postQuestionnaireResponseRequest],
  };
  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction(transactionInput);
  return extractResourcesFromBundle(bundle);
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
  return { appointment, encounter, patient, questionnaireResponseId: questionnaireResponse.id || '' };
};
