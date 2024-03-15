import { BatchInputPostRequest, BatchInputRequest, FhirClient, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Bundle, Encounter, Extension, Location, Patient, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  FHIR_EXTENSION,
  OtherParticipantsExtension,
  PRIVATE_EXTENSION_BASE_URL,
  PatientInfo,
  RequiredAllProps,
  Secrets,
  SecretsKeys,
  VisitType,
  ZambdaInput,
  ageIsInRange,
  getPatchBinary,
  getSecret,
  removeTimeFromDate,
  topLevelCatch,
} from 'ottehr-utils';
import { createFhirClient, getAppointmentConfirmationMessage } from '../../../../../utils/lib/helpers/helpers';
import { getUser } from '../../shared/auth';
import { sendConfirmationEmail, sendMessage } from '../../shared/communication';
import { getPatientResource } from '../../shared/fhir';
import { userHasAccessToPatient } from '../../shared/patients';

import {
  AuditableZambdaEndpoints,
  MAXIMUM_AGE,
  MAXIMUM_CHARACTER_LIMIT,
  MINIMUM_AGE,
  createAuditEvent,
} from '../../shared';
import { checkOrCreateToken } from '../lib/utils';
import { validateCreateAppointmentParams } from './validateRequestParameters';
import { getConversationSIDForApptParticipants } from './logic/conversation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters = validateCreateAppointmentParams(input);

    // todo access check? or just let zapehr handle??
    validateInternalInformation(validatedParameters.patient);

    zapehrToken = await checkOrCreateToken(zapehrToken, input.secrets);

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
  const { locationState: location, patient } = params;
  const { secrets } = input;
  let locationState = location;
  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const fhirClient = createFhirClient(zapehrToken, fhirAPI);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  // If it's a returning patient, check if the user has
  // access to create appointments for this patient
  if (patient.id) {
    const userAccess = await userHasAccessToPatient(user, patient.id, fhirClient);
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

  // if no location provided - set it to be "CA"
  // only for draft implementation!!!
  if (!locationState) {
    locationState = 'CA';
  }

  const { message, appointmentId, fhirPatientId } = await createAppointment(
    locationState,
    patient,
    fhirClient,
    user,
    secrets,
  );

  await createAuditEvent(AuditableZambdaEndpoints.appointmentCreate, fhirClient, input, fhirPatientId, secrets);

  const response = { message, appointmentId };
  console.log(`fhirAppointment = ${JSON.stringify(response)}`, 'Telemed visit');
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
}

export async function createAppointment(
  locationState: string,
  patient: PatientInfo,
  fhirClient: FhirClient,
  user: User,
  secrets: Secrets | null,
): Promise<CreateAppointmentUCTelemedResponse> {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  let maybeFhirPatient: Patient | undefined = undefined;
  let updatePatientRequest: BatchInputRequest | undefined = undefined;
  let createPatientRequest: BatchInputPostRequest | undefined = undefined;

  // if it is a returning patient
  if (patient.id) {
    maybeFhirPatient = await getPatientResource(patient.id, fhirClient);
    if (!maybeFhirPatient) throw new Error('Patient is not found');

    updatePatientRequest = await creatingPatientUpdateRequest(patient, maybeFhirPatient);
  } else {
    createPatientRequest = await creatingPatientCreateRequest(patient, user);
  }

  /** !!! Start time should be the appointment creation time here,
   * cause the "Estimated waiting time" calulations are based on this,
   * and we can't search appointments by "created" prop
   **/
  let startTime = DateTime.utc().toISO();
  if (!startTime) {
    throw new Error('startTime is currently undefined');
  }
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO();
  if (!startTime) {
    throw new Error('startTime is currently undefined');
  }
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: 15 }).toISO(); // todo: should this be scraped from the Appointment?
  if (!endTime) {
    throw new Error('endTime is currently undefined');
  }

  const locationId = (await getTelemedLocation(fhirClient, locationState))?.id;

  if (!locationId) {
    throw new Error(`Couldn't find telemed location for state ${locationState}`);
  }

  console.log('performing Transactional Fhir Requests for new appointment');
  const { appointment, patient: fhirPatient } = await performTransactionalFhirRequests({
    patient: maybeFhirPatient,
    reasonForVisit: patient?.reasonForVisit || [],
    startTime,
    endTime,
    fhirClient,
    updatePatientRequest,
    createPatientRequest,
    locationId,
  });

  const conversationSID = await getConversationSIDForApptParticipants(
    fhirClient,
    patient,
    fhirPatient,
    user,
    secrets,
    zapehrToken,
  );
  if (conversationSID) {
    console.log('Conversation sid: ' + conversationSID);
    // const timezone = fhirLocation.extension?.find(
    //   (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
    // )?.valueString;
    // await sendMessages(
    //   getPatientContactEmail(fhirPatient),
    //   conversationSID,
    //   originalDate.setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
    //   secrets,
    //   fhirLocation,
    //   appointment.id || ''
    // );
  }

  console.log('success, here is the id: ', appointment.id);
  const response: CreateAppointmentUCTelemedResponse = {
    message: 'Successfully created an appointment and encounter',
    appointmentId: appointment.id || '',
    fhirPatientId: fhirPatient.id || '',
  };

  return response;
}

async function creatingPatientUpdateRequest(
  patient: PatientInfo,
  maybeFhirPatient: Patient,
): Promise<BatchInputRequest | undefined> {
  if (!patient.id) return undefined;
  console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);

  let updatePatientRequest: BatchInputRequest | undefined = undefined;

  const patientPatchOperations: Operation[] = [];

  // store form user (aka emailUser)
  const formUser = {
    url: FHIR_EXTENSION.Patient.formUser.url,
    valueString: patient.emailUser,
  };
  const patientExtension = maybeFhirPatient.extension || [];
  if (patientExtension.length > 0) {
    const formUserExt = patientExtension.find((ext) => ext.url === FHIR_EXTENSION.Patient.formUser.url);
    // check if formUser exists and needs to be updated and if so, update
    if (formUserExt && formUserExt.valueString !== patient.emailUser) {
      const formUserExtIndex = patientExtension.findIndex((ext) => ext.url === FHIR_EXTENSION.Patient.formUser.url);
      patientExtension[formUserExtIndex] = formUser;
    } else if (!formUserExt) {
      // if form user does not exist within the extension
      // push to patientExtension array
      patientExtension.push(formUser);
    }
  } else {
    // since no extensions exist, it must be added via patch operations
    patientExtension.push(formUser);
  }

  patientPatchOperations.push({
    op: maybeFhirPatient.extension ? 'replace' : 'add',
    path: '/extension',
    value: patientExtension,
  });

  // update email
  if (patient.emailUser === 'Patient') {
    const telecom = maybeFhirPatient.telecom;
    const curEmail = telecom?.find((tele) => tele.system === 'email');
    const curEmailidx = telecom?.findIndex((tele) => tele.system === 'email');
    // check email exists in telecom but is different
    if (telecom && curEmailidx && curEmailidx > -1 && patient.email !== curEmail) {
      telecom[curEmailidx] = {
        system: 'email',
        value: patient.email,
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
        value: patient.email,
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
            value: patient.email,
          },
        ],
      });
    }
  }

  if (patient.emailUser === 'Parent/Guardian') {
    const patientContacts = maybeFhirPatient.contact;
    if (!patientContacts) {
      // no existing contacts, add email
      patientPatchOperations.push({
        op: 'add',
        path: '/contact',
        value: [
          {
            relationship: [
              {
                coding: [
                  // todo: this does not look like valid fhir...
                  {
                    system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
                    code: patient.emailUser,
                    display: patient.emailUser,
                  },
                ],
              },
            ],
            telecom: [{ system: 'email', value: patient.email }],
          },
        ],
      });
    } else {
      // check if different
      const guardianContact = patientContacts.find((contact) =>
        contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
      );
      const guardianContactIdx = patientContacts.findIndex((contact) =>
        contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
      );
      const guardianEmail = guardianContact?.telecom?.find((telecom) => telecom.system === 'email')?.value;
      const guardianEmailIdx = guardianContact?.telecom?.findIndex((telecom) => telecom.system === 'email');
      if (patient.email !== guardianEmail) {
        patientPatchOperations.push({
          op: 'replace',
          path: `/contact/${guardianContactIdx}/telecom/${guardianEmailIdx}`,
          value: { system: 'email', value: patient.email },
        });
      }
    }
  }

  if (patient.sex !== maybeFhirPatient.gender) {
    patientPatchOperations.push({
      op: maybeFhirPatient.gender ? 'replace' : 'add',
      path: '/gender',
      value: patient.sex,
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

async function creatingPatientCreateRequest(
  patient: PatientInfo,
  user: User,
): Promise<BatchInputPostRequest | undefined> {
  let createPatientRequest: BatchInputPostRequest | undefined = undefined;

  if (!patient.firstName) {
    throw new Error('First name is undefined');
  }
  console.log('building patient resource');
  const patientResource: Patient = {
    resourceType: 'Patient',
    name: [
      {
        given: [patient.firstName],
        family: patient.lastName,
      },
    ],
    birthDate: removeTimeFromDate(patient.dateOfBirth ?? ''),
    gender: patient.sex,
    active: true,
    extension: [
      {
        url: FHIR_EXTENSION.Patient.formUser.url,
        valueString: patient.emailUser,
      },
    ],
  };
  if (patient.emailUser === 'Parent/Guardian') {
    patientResource.contact = [
      {
        relationship: [
          {
            coding: [
              // todo: this does not look like valid fhir...
              {
                system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
                code: patient.emailUser,
                display: patient.emailUser,
              },
            ],
          },
        ],
        telecom: [{ system: 'email', value: patient.email }],
      },
    ];
  }
  if (patient.emailUser === 'Patient') {
    // if the user is the staff, which happens when using the add-patient page,
    // user.name will not be a phone number, like it would be for a patient. In this
    // case, we must insert the patient's phone number using patient.phoneNumber
    // we use .startsWith('+') because the user's phone number will start with "+"
    if (!user.name.startsWith('+')) {
      patientResource.telecom = [
        {
          system: 'email',
          value: patient.email,
        },
        {
          system: 'phone',
          value: patient.phoneNumber,
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
  console.log('creating patient request for new patient resource');
  createPatientRequest = {
    method: 'POST',
    url: '/Patient',
    fullUrl: `urn:uuid:${uuid()}`,
    resource: patientResource,
  };

  return createPatientRequest;
}

function validateInternalInformation(patient: PatientInfo): void {
  if (patient.dateOfBirth && !ageIsInRange(patient.dateOfBirth, MINIMUM_AGE, MAXIMUM_AGE)) {
    throw new Error(`age not inside range of ${MINIMUM_AGE} to ${MAXIMUM_AGE}`);
  }

  if (patient.reasonForVisit && patient.reasonForVisit.join(', ').length > MAXIMUM_CHARACTER_LIMIT) {
    throw new Error(`all visit reasons must be less than ${MAXIMUM_CHARACTER_LIMIT} characters`);
  }
}

export async function sendMessages(
  email: string | undefined,
  conversationSID: string,
  startTime: string,
  secrets: Secrets | null,
  location: Location,
  appointmentID: string,
): Promise<void> {
  if (email) {
    await sendConfirmationEmail({
      email,
      startTime,
      appointmentID,
      secrets,
      location,
    });
  } else {
    console.log('email undefined');
  }

  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const message = getAppointmentConfirmationMessage(appointmentID, location.name || 'Unknown', startTime, WEBSITE_URL);
  await sendMessage(message, conversationSID, zapehrToken, secrets);
}

interface TransactionInput {
  reasonForVisit: string[];
  startTime: string;
  endTime: string;
  fhirClient: FhirClient;
  additionalInfo?: string;
  patient?: Patient;
  createPatientRequest?: BatchInputPostRequest;
  updatePatientRequest?: BatchInputRequest;
  locationId: string;
}

interface TransactionOutput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
}

export const performTransactionalFhirRequests = async (input: TransactionInput): Promise<TransactionOutput> => {
  const {
    fhirClient,
    patient,
    reasonForVisit,
    startTime,
    endTime,
    additionalInfo,
    createPatientRequest,
    updatePatientRequest,
    locationId,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl;

  const nowIso = DateTime.utc().toISO();
  if (!nowIso) {
    throw new Error('nowIso is currently undefined');
  }

  const apptVirtualServiceExt: Extension = {
    url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
    extension: [
      {
        url: 'channelType',
        valueCoding: {
          system: 'https://fhir.zapehr.com/virtual-service-type',
          code: 'twilio-video-group-rooms',
          display: 'Twilio Video Group Rooms',
        },
      },
    ],
  };

  const encounterVirtualServiceExt: Extension = {
    ...apptVirtualServiceExt,
    url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
  };

  const apptExtensions: Extension[] = [apptVirtualServiceExt];

  if (additionalInfo) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.additionalInfo.url,
      valueString: additionalInfo,
    });
  }

  const apptUrl = `urn:uuid:${uuid()}`;

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      tag: [{ code: 'OTTEHR-TELEMED' }],
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
          reference: `Location/${locationId}`,
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
          code: VisitType.WalkIn.toUpperCase(),
          display: VisitType.WalkIn,
        },
      ],
      text: VisitType.WalkIn,
    },
    description: reasonForVisit.join(','),
    status: 'arrived',
    created: nowIso,
    extension: apptExtensions,
  };

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
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR',
      display: 'virtual',
    },
    subject: { reference: patientRef },
    appointment: [
      {
        reference: apptUrl,
      },
    ],
    location: [
      {
        location: {
          reference: `Location/${locationId}`,
        },
      },
    ],
    extension: [
      encounterVirtualServiceExt,
      {
        url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
            extension: [
              {
                url: 'period',
                valuePeriod: {
                  start: nowIso,
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
    ],
  };

  const postApptReq: BatchInputRequest = {
    method: 'POST',
    url: '/Appointment',
    resource: apptResource,
    fullUrl: apptUrl,
  };

  const postEncRequest: BatchInputRequest = {
    method: 'POST',
    url: '/Encounter',
    resource: encResource,
  };

  const patientRequests: BatchInputRequest[] = [];
  if (updatePatientRequest) {
    patientRequests.push(updatePatientRequest);
  }
  if (createPatientRequest) {
    patientRequests.push(createPatientRequest);
  }

  const transactionInput = {
    requests: [...patientRequests, postApptReq, postEncRequest],
  };
  console.log('making transaction request');
  const bundle = await fhirClient.transactionRequest(transactionInput);
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
      ?.find((contactTemp) =>
        contactTemp.relationship?.find((relationshipTemp) =>
          relationshipTemp.coding?.find(
            (codingTemp) => codingTemp.system === `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
          ),
        ),
      )
      ?.telecom?.find((telecomTemp) => telecomTemp.system === 'email')?.value;
  }

  return undefined;
}

// Just for testing
async function getTelemedLocation(fhirClient: FhirClient, state: string): Promise<Location | undefined> {
  const resources = await fhirClient.searchResources({
    resourceType: 'Location',
    searchParams: [
      {
        name: 'address-state',
        value: state,
      },
    ],
  });

  return (resources as Location[]).find(
    (loca) =>
      loca.extension?.find((ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release')
        ?.valueCoding?.code === 'vi',
  );
}
