import { BatchInputPostRequest, BatchInputRequest, FhirClient, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Appointment,
  AppointmentParticipant,
  Bundle,
  Encounter,
  Extension,
  Location,
  Patient,
  Practitioner,
  Resource,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  CreateAppointmentUCTelemedParams,
  CreateAppointmentUCTelemedResponse,
  FHIR_EXTENSION,
  OtherParticipantsExtension,
  OTTEHR_MODULE,
  PRIVATE_EXTENSION_BASE_URL,
  PatientInfo,
  RequiredAllProps,
  Secrets,
  SecretsKeys,
  TELEMED_VIDEO_ROOM_CODE,
  ZambdaInput,
  ageIsInRange,
  createFhirClient,
  createUserResourcesForPatient,
  formatPhoneNumber,
  getPatchBinary,
  getPatientResourceWithVerifiedPhoneNumber,
  getSecret,
  removeTimeFromDate,
  topLevelCatch,
} from 'ottehr-utils';
import { getUser } from '../../shared/auth';
import { userHasAccessToPatient } from '../../shared/patients';

import { AuditableZambdaEndpoints, MAXIMUM_AGE, MINIMUM_AGE, createAuditEvent } from '../../shared';
import { checkOrCreateToken } from '../lib/utils';
import { validateCreateAppointmentParams } from './validateRequestParameters';

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
  const {
    slot,
    patient,
    scheduleType,
    visitType,
    visitService,
    locationID,
    providerID,
    timezone,
    unconfirmedDateOfBirth,
  } = params;
  const { secrets } = input;
  const fhirClient = createFhirClient(zapehrToken);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''));

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

  const { message, appointmentId, fhirPatientId } = await createAppointment(
    patient,
    fhirClient,
    scheduleType,
    slot,
    locationID,
    providerID,
    visitService,
    visitType,
    user,
    timezone,
    unconfirmedDateOfBirth,
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
  patient: PatientInfo,
  fhirClient: FhirClient,
  scheduleType: 'location' | 'provider',
  slot: string,
  locationID: string,
  providerID: string,
  visitService: 'in-person' | 'telemedicine',
  visitType: 'prebook' | 'now',
  user: User,
  timezone: string,
  unconfirmedDateOfBirth: string,
  secrets: Secrets | null,
): Promise<CreateAppointmentUCTelemedResponse> {
  const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);

  let maybeFhirPatient: Patient | undefined = undefined;
  let updatePatientRequest: BatchInputRequest | undefined = undefined;
  let createPatientRequest: BatchInputPostRequest | undefined = undefined;

  let verifiedPhoneNumber: string | undefined;
  // let relatedPersonRef: string | undefined;

  // if it is a returning patient
  if (patient.id) {
    const { patient: foundPatient, verifiedPhoneNumber: foundPhoneNumber } =
      await getPatientResourceWithVerifiedPhoneNumber(patient.id, fhirClient);
    maybeFhirPatient = foundPatient;
    verifiedPhoneNumber = foundPhoneNumber;

    if (!maybeFhirPatient) {
      throw new Error('Patient is not found');
      // return {
      //   statusCode: 500,
      //   body: JSON.stringify('Patient is not found'),
      // };
    }
    // if (relatedPerson) {
    //   relatedPersonRef = `RelatedPerson/${relatedPerson.id}`;
    // } else {
    //   relatedPersonRef = `Patient/${patient.id}`;
    // }

    updatePatientRequest = await creatingPatientUpdateRequest(patient, maybeFhirPatient);
  } else {
    createPatientRequest = await creatingPatientCreateRequest(patient, user);
  }

  /** !!! Start time should be the appointment creation time here,
   * cause the "Estimated waiting time" calulations are based on this,
   * and we can't search appointments by "created" prop
   **/
  const originalDate = DateTime.fromISO(slot);
  const endTime = originalDate.plus({ minutes: 15 });

  if (scheduleType === 'location') {
    const location = await getLocation(fhirClient, locationID);
    const locationId = location?.id;

    if (!locationId) {
      throw new Error(`Couldn't find location for id ${locationID}`);
    }
  } else if (scheduleType === 'provider') {
    const provider = await getProvider(fhirClient, providerID);
    const providerId = provider?.id;

    if (!providerId) {
      throw new Error(`Couldn't find provider for id ${providerID}`);
    }
  }
  console.log(slot, endTime);

  console.log('performing Transactional Fhir Requests for new appointment');
  const { appointment, patient: fhirPatient } = await performTransactionalFhirRequests({
    fhirClient,
    patient: maybeFhirPatient,
    startTime: originalDate,
    endTime,
    visitType,
    visitService,
    createPatientRequest,
    updatePatientRequest,
    scheduleType,
    locationID,
    providerID,
    unconfirmedDateOfBirth,
  });

  // if the patient does not have a phone number, try to use the user's phone number
  if (patient.phoneNumber === undefined || patient.phoneNumber === null) {
    patient.phoneNumber = (user as any).phoneNumber;
  }

  await createUpdateUserRelatedResources(fhirClient, patient, fhirPatient, user);

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

  console.log('patient extension', patientExtension);

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
  if (patient.dateOfBirth && !ageIsInRange(patient.dateOfBirth, MINIMUM_AGE, MAXIMUM_AGE).result) {
    throw new Error(`age not inside range of ${MINIMUM_AGE} to ${MAXIMUM_AGE}`);
  }
}

interface TransactionInput {
  fhirClient: FhirClient;
  patient?: Patient;
  startTime: DateTime;
  endTime: DateTime;
  visitType?: 'prebook' | 'now';
  visitService?: 'in-person' | 'telemedicine';
  additionalInfo?: string;
  createPatientRequest?: BatchInputPostRequest;
  updatePatientRequest?: BatchInputRequest;
  scheduleType: 'location' | 'provider';
  locationID: string;
  providerID: string;
  unconfirmedDateOfBirth?: string | undefined;
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
    startTime,
    endTime,
    visitType,
    visitService,
    additionalInfo,
    createPatientRequest,
    updatePatientRequest,
    scheduleType,
    locationID,
    providerID,
    unconfirmedDateOfBirth,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl;

  const nowIso = DateTime.utc().toISO();

  const apptVirtualServiceExt: Extension = {
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

  const encounterVirtualServiceExt: Extension = {
    ...apptVirtualServiceExt,
    url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
  };

  const apptExtensions: Extension[] = [];
  const encounterExtensions: Extension[] = [];

  if (visitService === 'telemedicine') {
    apptExtensions.push(apptVirtualServiceExt);
    encounterExtensions.push(encounterVirtualServiceExt);
    encounterExtensions.push({
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
    } as OtherParticipantsExtension);
  }

  if (additionalInfo) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.additionalInfo.url,
      valueString: additionalInfo,
    });
  }

  if (unconfirmedDateOfBirth) {
    apptExtensions.push({
      url: FHIR_EXTENSION.Appointment.unconfirmedDateOfBirth.url,
      valueString: unconfirmedDateOfBirth,
    });
  }

  apptExtensions.push({
    url: FHIR_EXTENSION.Appointment.visitHistory.url,
    extension: [makeVisitStatusExtensionEntry('pending')],
  });

  const startTimeToISO = startTime.toISO();
  const endTimeToISO = endTime.toISO();

  if (startTimeToISO == null) {
    console.log('startTimeToISO is not defined', startTime);
    throw new Error('startTimeToISO is not defined');
  }
  if (endTimeToISO == null) {
    console.log('endTimeToISO is not defined', endTime);
    throw new Error('endTimeToISO is not defined');
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
        reference: `Location/${locationID}`,
      },
      status: 'accepted',
    });
  }
  if (scheduleType === 'provider') {
    participants.push({
      actor: {
        reference: `Practitioner/${providerID}`,
      },
      status: 'accepted',
    });
  }

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    meta: {
      tag: [{ code: OTTEHR_MODULE.TM }],
    },
    participant: participants,
    start: startTimeToISO,
    end: endTimeToISO,
    serviceType: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/service-type',
            code: visitService,
            display: visitService,
          },
        ],
        text: visitService,
      },
    ],
    appointmentType: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/v2-0276',
          code: visitType,
          display: visitType,
        },
      ],
      text: visitType,
    },
    status: 'proposed',
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
    location:
      scheduleType === 'location'
        ? [
            {
              location: {
                reference: `Location/${locationID}`,
              },
            },
          ]
        : [],
    extension: encounterExtensions,
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

export function makeVisitStatusExtensionEntry(statusCode: string): any {
  return {
    url: 'status',
    extension: [
      { url: 'status', valueString: statusCode },
      {
        url: 'period',
        valuePeriod: { start: DateTime.now().setZone('UTC').toISO() },
      },
    ],
  };
}

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
async function getLocation(fhirClient: FhirClient, locationID: string): Promise<Location | undefined> {
  console.log('Searching for location with id', locationID);
  const location: Location = await fhirClient.readResource({
    resourceType: 'Location',
    resourceId: locationID,
  });

  return location;
}

async function getProvider(fhirClient: FhirClient, providerID: string): Promise<Practitioner | undefined> {
  console.log('Searching for provider with id', providerID);
  const provider: Practitioner = await fhirClient.readResource({
    resourceType: 'Practitioner',
    resourceId: providerID,
  });

  return provider;
}

/***
Three cases:
New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
Returning user, new patient, get the user's conversation and add the participant RelatedPerson
Returning user, returning patient, get the user's conversation
 */
export async function createUpdateUserRelatedResources(
  fhirClient: FhirClient,
  patientInfo: PatientInfo,
  fhirPatient: Patient,
  user: User,
): Promise<{ relatedPersonRef: string | undefined; verifiedPhoneNumber: string | undefined }> {
  console.log('patient info: ' + JSON.stringify(patientInfo));

  let verifiedPhoneNumber: string | undefined = undefined;

  if (!patientInfo.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    verifiedPhoneNumber = checkUserPhoneNumber(patientInfo, user);
    const userResource = await createUserResourcesForPatient(fhirClient, fhirPatient.id, verifiedPhoneNumber);
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

export function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  // If the user is the staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = !user.name.startsWith('+');
  if (isEHRUser) {
    // User is the staff
    if (!patient.phoneNumber) {
      throw new Error('No phone number found for patient');
    }
    patientNumberToText = formatPhoneNumber(patient.phoneNumber);
  } else {
    // User is patient and auth0 already appends a +1 to the phone number
    patientNumberToText = user.name;
  }
  return patientNumberToText;
}
