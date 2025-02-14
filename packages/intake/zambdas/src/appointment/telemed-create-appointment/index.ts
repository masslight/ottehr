import Oystehr, { BatchInputPostRequest, BatchInputRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Appointment,
  Bundle,
  Encounter,
  List,
  Location,
  Patient,
  Questionnaire,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Resource,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  createOystehrClient,
  FHIR_EXTENSION,
  formatPhoneNumber,
  makePrepopulatedItemsForPatient,
  OTTEHR_MODULE,
  PatientInfo,
  PRIVATE_EXTENSION_BASE_URL,
  RequiredAllProps,
  ServiceMode,
  userHasAccessToPatient,
  VisitType,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, Secrets, SecretsKeys, topLevelCatch } from 'zambda-utils';
import { AuditableZambdaEndpoints, checkOrCreateM2MClientToken, createAuditEvent, getUser } from '../../shared';
import { createUpdateUserRelatedResources, generatePatientRelatedRequests } from '../../shared/appointment';
import {
  getCurrentQuestionnaireForServiceType,
  getEncounterClass,
  getTelemedRequiredAppointmentEncounterExtensions,
} from '../helpers';
import { validateCreateAppointmentParams } from './validateRequestParameters';

let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters = validateCreateAppointmentParams(input);

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, input.secrets);

    const response = await performEffect({ input, params: validatedParameters });

    return response;
  } catch (error: any) {
    await topLevelCatch('create-appointment', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

interface PerformEffectInputProps {
  input: ZambdaInput;
  params: RequiredAllProps<CreateAppointmentUCTelemedParams>;
}

async function performEffect(props: PerformEffectInputProps): Promise<APIGatewayProxyResult> {
  const { input, params } = props;
  const { locationState, patient, unconfirmedDateOfBirth } = params;
  const { secrets } = input;
  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
  const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);

  // If it's a returning patient, check if the user has
  // access to create appointments for this patient
  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, oystehr);
    if (!userAccess) {
      return {
        statusCode: 403,
        body: JSON.stringify({
          message: 'User does not have permission to access this patient',
        }),
      };
    }
  }
  console.log('creating appointment');

  const { message, appointmentId, patientId } = await createAppointment(
    { locationState, patient, user, unconfirmedDateOfBirth, secrets },
    oystehr
  );

  await createAuditEvent(AuditableZambdaEndpoints.appointmentCreate, oystehr, input, patientId, secrets);

  const response: CreateAppointmentUCTelemedResponse = { message, appointmentId, patientId };
  console.log(`fhirAppointment = ${JSON.stringify(response)}`, 'Telemed visit');
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}

interface CreateAppointmentInput {
  locationState: string;
  patient: PatientInfo;
  user: User;
  unconfirmedDateOfBirth: string;
  secrets: Secrets | null;
}

export async function createAppointment(
  input: CreateAppointmentInput,
  oystehr: Oystehr
): Promise<CreateAppointmentUCTelemedResponse> {
  const { locationState, patient, user, unconfirmedDateOfBirth, secrets } = input;

  const { listRequests, createPatientRequest, updatePatientRequest, maybeFhirPatient, verifiedPhoneNumber, isEHRUser } =
    await generatePatientRelatedRequests(user, patient, oystehr);

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

  /** !!! Start time should be the appointment creation time here,
   * cause the "Estimated waiting time" calulations are based on this,
   * and we can't search appointments by "created" prop
   **/
  let startTime = DateTime.utc().toISO() || '';
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: 15 }).toISO() || ''; // todo: should this be scraped from the Appointment?

  const location = await getTelemedLocation(oystehr, locationState);
  const locationId = location?.id;

  if (!locationId) {
    throw new Error(`Couldn't find telemed location for state ${locationState}`);
  }

  const questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode.virtual, secrets, oystehr);

  console.log('performing Transactional Fhir Requests for new appointment');
  const { appointment, patient: fhirPatient } = await performTransactionalFhirRequests({
    patient: maybeFhirPatient,
    reasonForVisit: patient?.reasonForVisit || '',
    questionnaire,
    startTime,
    endTime,
    oystehr,
    updatePatientRequest,
    createPatientRequest,
    listRequests,
    location,
    unconfirmedDateOfBirth,
    verifiedPhoneNumber: verifiedFormattedPhoneNumber,
    contactInfo: {
      phone: verifiedFormattedPhoneNumber || 'not provided',
      email: patient?.email || 'not provided',
    },
  });

  await createUpdateUserRelatedResources(oystehr, patient, fhirPatient, user);

  // verifiedPhoneNumber = phoneVerified ?? verifiedPhoneNumber;

  console.log('success, here is the id: ', appointment.id);
  return {
    message: 'Successfully created an appointment and encounter',
    appointmentId: appointment.id || '',
    patientId: fhirPatient.id || '',
  };
}

interface TransactionInput {
  startTime: string;
  endTime: string;
  oystehr: Oystehr;
  questionnaire: Questionnaire;
  additionalInfo?: string;
  patient?: Patient;
  createPatientRequest?: BatchInputPostRequest<Patient>;
  listRequests: BatchInputRequest<List>[];
  updatePatientRequest?: BatchInputRequest<Patient>;
  location: Location;
  unconfirmedDateOfBirth?: string;
  verifiedPhoneNumber: string | undefined;
  contactInfo: { phone: string; email: string };
  reasonForVisit: string;
}

interface TransactionOutput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
}

export const performTransactionalFhirRequests = async (input: TransactionInput): Promise<TransactionOutput> => {
  const {
    oystehr,
    patient,
    reasonForVisit,
    questionnaire,
    startTime,
    endTime,
    additionalInfo,
    createPatientRequest,
    listRequests,
    updatePatientRequest,
    location,
    unconfirmedDateOfBirth,
    verifiedPhoneNumber,
    contactInfo,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl || '';

  const nowIso = DateTime.utc().toISO();

  const { encExtensions, apptExtensions } = getTelemedRequiredAppointmentEncounterExtensions(patientRef, nowIso);

  if (additionalInfo) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.additionalInfo.url,
      valueString: additionalInfo,
    });
  }

  if (unconfirmedDateOfBirth) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
      valueDate: unconfirmedDateOfBirth,
    });
  }

  const apptUrl = `urn:uuid:${uuid()}`;

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      tag: [{ code: OTTEHR_MODULE.TM }],
    },
    participant: [
      {
        actor: {
          reference: patientRef,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Location/${location.id}`,
        },
        status: 'accepted',
      },
    ],
    start: startTime,
    end: endTime,
    appointmentType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: VisitType.Virtual,
          display: VisitType.Virtual,
        },
      ],
      text: VisitType.Virtual,
    },
    // we have this status while the "create-paperwork" endpoint was not yet called
    status: 'proposed',
    created: nowIso,
    extension: apptExtensions,
    description: reasonForVisit,
  };

  const encounterUrl = `urn:uuid:${uuid()}`;
  const encResource: Encounter = {
    resourceType: 'Encounter',
    text: {
      status: 'generated',
      div: '<div xmlns="http://www.w3.org/1999/xhtml">Encounter for telemed room</div>',
    },
    status: 'planned',
    statusHistory: [
      {
        status: 'planned',
        period: {
          start: nowIso,
        },
      },
    ],
    class: getEncounterClass(ServiceMode.virtual),
    subject: { reference: patientRef },
    appointment: [
      {
        reference: apptUrl,
      },
    ],
    location: [
      {
        location: {
          reference: `Location/${location.id}`,
        },
      },
    ],
    extension: encExtensions,
  };

  const canonUrl = `${questionnaire.url}|${questionnaire.version}`;
  const patientToUse = createPatientRequest?.resource ?? patient ?? { resourceType: 'Patient' };
  const item: QuestionnaireResponseItem[] = makePrepopulatedItemsForPatient({
    patient: patientToUse,
    // location,
    isNewQrsPatient: createPatientRequest?.resource !== undefined,
    newPatientDob: createPatientRequest?.resource?.birthDate,
    unconfirmedDateOfBirth,
    appointmentStartTime: startTime,
    questionnaire,
    verifiedPhoneNumber: verifiedPhoneNumber,
    contactInfo: contactInfo,
  });

  const questionnaireResponse: QuestionnaireResponse = {
    resourceType: 'QuestionnaireResponse',
    questionnaire: canonUrl,
    encounter: { reference: encounterUrl },
    status: 'in-progress',
    item,
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
    fullUrl: encounterUrl,
  };

  const postQRRequest: BatchInputRequest<QuestionnaireResponse> = {
    method: 'POST',
    url: '/QuestionnaireResponse',
    resource: questionnaireResponse,
  };

  const patientRequests: BatchInputRequest<Patient>[] = [];
  if (updatePatientRequest) {
    patientRequests.push(updatePatientRequest);
  }
  if (createPatientRequest) {
    patientRequests.push(createPatientRequest);
  }

  const transactionInput = {
    requests: [...patientRequests, ...listRequests, postApptReq, postEncRequest, postQRRequest],
  };
  console.log('making transaction request');
  const bundle = await oystehr.fhir.transaction<Appointment | Encounter | Patient | List | QuestionnaireResponse>(
    transactionInput
  );
  return extractResourcesFromBundle(bundle, patient);
};

const extractResourcesFromBundle = (bundle: Bundle<Resource>, maybePatient?: Patient): TransactionOutput => {
  console.log('getting resources from bundle');
  const entry = bundle.entry ?? [];
  const appointment: Appointment = entry.find((appt) => {
    return appt.resource && appt.resource.resourceType === 'Appointment';
  })?.resource as Appointment;
  const encounter: Encounter = entry.find((enc) => {
    return enc.resource && enc.resource.resourceType === 'Encounter';
  })?.resource as Encounter;

  if (appointment === undefined) {
    throw new Error('Appointment could not be created');
  }
  if (encounter === undefined) {
    throw new Error('Encounter could not be created');
  }

  let patient = maybePatient;

  if (!patient) {
    patient = entry.find((enc) => {
      return enc.resource && enc.resource.resourceType === 'Patient';
    })?.resource as Patient;
  }

  if (patient === undefined) {
    throw new Error('Patient could not be created');
  }
  console.log('successfully obtained resources from bundle');
  return { appointment, encounter, patient };
};

export function getPatientContactEmail(patient: Patient): string | undefined {
  const formUser = patient.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`)?.valueString;
  if (formUser === 'Patient') {
    return patient.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }
  if (formUser === 'Parent/Guardian') {
    return patient.contact
      ?.find(
        (contactTemp) =>
          contactTemp.relationship?.find(
            (relationshipTemp) =>
              relationshipTemp.coding?.find(
                (codingTemp) => codingTemp.system === `${PRIVATE_EXTENSION_BASE_URL}/relationship`
              )
          )
      )
      ?.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }

  return undefined;
}

export async function getTelemedLocation(oystehr: Oystehr, state: string): Promise<Location | undefined> {
  const resources = (
    await oystehr.fhir.search<Location>({
      resourceType: 'Location',
      params: [
        {
          name: 'address-state',
          value: state,
        },
      ],
    })
  ).unbundle();

  return resources.find(
    (loca) =>
      loca.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release')
        ?.valueCoding?.code === 'vi'
  );
}

/***
Three cases:
New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
Returning user, new patient, get the user's conversation and add the participant RelatedPerson
Returning user, returning patient, get the user's conversation
 */
