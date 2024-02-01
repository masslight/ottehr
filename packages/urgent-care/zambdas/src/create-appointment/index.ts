import { APIGatewayProxyResult } from 'aws-lambda';
import { validateCreateAppointmentParams } from './validateRequestParameters';
import { VisitType, PatientInfo } from '../types';
import { Patient, Location, Bundle, Resource, Appointment, Encounter, Extension, RelatedPerson } from 'fhir/r4';
import { MAXIMUM_CHARACTER_LIMIT, MAXIMUM_AGE, MINIMUM_AGE, ageIsInRange } from '../shared/validation';
import { DateTime } from 'luxon';
import { createFhirClient, formatPhoneNumber } from '../shared/helpers';
import { getPatientResourceWithVerifiedPhoneNumber } from '../shared/fhir';
import {
  FHIR_EXTENSION,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  getPatchBinary,
  getPatientContactEmail,
  getPatientFirstName,
  Secrets,
  ZambdaInput,
  topLevelCatch,
  SecretsKeys,
  getSecret,
  removeTimeFromDate,
} from 'utils';
import { Operation } from 'fast-json-patch';
import { sendConfirmationEmail, sendMessage } from '../shared/communication';
import { formatDate } from '../shared/dateUtils';
import { FhirClient, BatchInputRequest, BatchInputPostRequest, User } from '@zapehr/sdk';
import { uuid } from 'short-uuid';
import {
  createUserResourcesForPatient,
  getAccessToken,
  getRelatedPersonsForPhoneNumber,
  getUser,
  userHasAccessToPatient,
} from '../shared/auth';
import { DATETIME_FULL_NO_YEAR } from '../shared';
import { AuditableZambdaEndpoints, createAuditEvent } from '../shared/userAuditLog';
import {
  makeOtherEHRVisitStatusExtension,
  makeOtherEHRVisitStatusExtensionEntry,
  mapOtherEHRVisitStatusToFhirAppointmentStatus,
  mapOtherEHRVisitStatusToFhirEncounterStatus,
} from '../shared/other-ehr';

export interface CreateAppointmentInput {
  slot: string;
  patient: PatientInfo;
  location: string;
  secrets: Secrets | null;
  visitType: VisitType;
  unconfirmedDateOfBirth?: string | undefined;
}

export interface CreateAppointmentRes {
  message: string;
  appointment: string | null;
  fhirPatientId: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
let zapehrMessagingToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    // Step 1: Validate input
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), input.secrets);
    const isEHRUser = !user.name.startsWith('+');
    const validatedParameters = validateCreateAppointmentParams(input, isEHRUser);
    const { slot, location, patient, secrets, visitType, unconfirmedDateOfBirth } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // todo access check? or just let zapehr handle??
    // * Validate internal information *
    validateInternalInformation(patient);
    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);
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
    const { message, appointment, fhirPatientId } = await createAppointment(
      slot,
      location,
      patient,
      fhirClient,
      user,
      secrets,
      visitType,
      unconfirmedDateOfBirth,
    );

    await createAuditEvent(AuditableZambdaEndpoints.appointmentCreate, fhirClient, input, fhirPatientId, secrets);

    const response = { message: message, appointment: appointment };

    console.log(`fhirAppointment = ${JSON.stringify(response)}`, visitType);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    await topLevelCatch('create-appointment', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

export async function createAppointment(
  slot: string,
  location: string,
  patient: PatientInfo,
  fhirClient: FhirClient,
  user: User,
  secrets: Secrets | null,
  visitType: VisitType,
  unconfirmedDateOfBirth: string | undefined,
): Promise<CreateAppointmentRes> {
  const getLocationRequest: BatchInputRequest = {
    method: 'GET',
    url: `/Location/${location}`,
  };

  let maybeFhirPatient: Patient | undefined = undefined;
  let updatePatientRequest: BatchInputRequest | undefined = undefined;
  let createPatientRequest: BatchInputPostRequest | undefined = undefined;
  const patientPatchOperations: Operation[] = [];

  let verifiedPhoneNumber: string | undefined;
  const isEHRUser = !user.name.startsWith('+');

  // if it is a returning patient
  if (patient.id) {
    console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);
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
      // check email exists in telecom but is different
      if (telecom && curEmail && patient.email !== curEmail) {
        const curEmailidx = telecom?.findIndex((tele) => tele.system === 'email');
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
      if (telecom && !curEmail && patient.email) {
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
      if (!telecom && patient.email) {
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

    if (patientPatchOperations.length >= 1) {
      console.log('getting patch binary for patient operations');
      updatePatientRequest = getPatchBinary({
        resourceType: 'Patient',
        resourceId: patient.id,
        patchOperations: patientPatchOperations,
      });
    }
  } else {
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
      gender: isEHRUser ? patient.sex : undefined,
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
      if (isEHRUser) {
        patientResource.telecom = [
          {
            system: 'phone',
            value: patient.phoneNumber,
          },
        ];

        if (patient.email) {
          patientResource.telecom.push({
            system: 'email',
            value: patient.email,
          });
        }
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
  }

  let startTime: string = visitType === VisitType.WalkIn ? DateTime.now().setZone('UTC').toISO() || '' : slot;
  startTime = DateTime.fromISO(startTime).setZone('UTC').toISO() || '';
  const originalDate = DateTime.fromISO(startTime).setZone('UTC');
  const endTime = originalDate.plus({ minutes: 15 }).toISO() || ''; // todo: should this be scraped from the Appointment?

  console.log('performing Transactional Fhir Requests for new appointment');
  const {
    appointment,
    location: fhirLocation,
    patient: fhirPatient,
  } = await performTransactionalFhirRequests({
    patient: maybeFhirPatient,
    reasonForVisit: patient?.reasonForVisit || [],
    startTime,
    endTime,
    visitType,
    location,
    fhirClient,
    updatePatientRequest,
    getLocationRequest,
    createPatientRequest,
    unconfirmedDateOfBirth,
  });

  // Three cases:
  // New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
  // Returning user, new patient, get the user's conversation and add the participant RelatedPerson
  // Returning user, returning patient, get the user's conversation
  let conversationSID: string | undefined = undefined;
  if (!patient.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    if (isEHRUser) {
      if (!patient.phoneNumber) {
        throw new Error('No phone number found for patient');
      }
      verifiedPhoneNumber = formatPhoneNumber(patient.phoneNumber);
    } else {
      // User is patient and auth0 already appends a +1 to the phone number
      verifiedPhoneNumber = user.name;
    }
    const userResource = await createUserResourcesForPatient(fhirClient, fhirPatient.id, verifiedPhoneNumber);
    const relatedPerson = userResource.relatedPerson;
    const person = userResource.person;
    const newUser = userResource.newUser;

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
    }

    // If it's a new user, create a zapEHR conversation
    if (newUser) {
      // Create Encounter
      console.log('New user, creating an Encounter for a conversation');
      const encounter = await fhirClient.createResource<Encounter>({
        resourceType: 'Encounter',
        status: 'in-progress',
        class: {
          system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          code: 'VR', // Virtual
        },
        participant: [
          {
            individual: {
              reference: `RelatedPerson/${relatedPerson.id}`,
            },
          },
        ],
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
            extension: [
              {
                url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
                extension: [
                  {
                    url: 'reference',
                    valueReference: {
                      reference: `Device/${getSecret(SecretsKeys.MESSAGING_DEVICE_ID, secrets)}`,
                    },
                  },
                ],
              },
            ],
          },
        ],
      });

      // Create conversation
      // console.log('Creating a conversation');
      // const conversation = await fetch(`${getSecret(SecretsKeys.PROJECT_API, secrets)}/messaging/conversation`, {
      //   method: 'POST',
      //   headers: {
      //     Authorization: `Bearer ${zapehrToken}`,
      //   },
      //   body: JSON.stringify({
      //     encounter: encounter,
      //   }),
      // });
      // const conversationResponse: any = await conversation.json();
      // const conversationEncounter = conversationResponse.encounter as Encounter;
      // conversationSID = getConversationSIDFromEncounter(conversationEncounter);
      // console.log(`Conversation SID is ${conversationSID}`);

      // // Add participants
      // console.log('Adding participants to the conversation');
      // await fetch(
      //   `${getSecret(SecretsKeys.PROJECT_API, secrets)}/messaging/conversation/${conversationSID}/participant`,
      //   {
      //     method: 'POST',
      //     headers: {
      //       Authorization: `Bearer ${zapehrToken}`,
      //     },
      //     body: JSON.stringify({
      //       encounterReference: `Encounter/${encounter.id}`,
      //       participants: [
      //         {
      //           participantReference: `Device/${getSecret(SecretsKeys.MESSAGING_DEVICE_ID, secrets)}`,
      //           channel: 'chat',
      //         },
      //         {
      //           participantReference: `RelatedPerson/${relatedPerson.id}`,
      //           channel: 'sms',
      //           phoneNumber: user.name.startsWith('+')
      //             ? person.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value
      //             : patient.phoneNumber,
      //         },
      //       ],
      //     }),
      //   },
      // );
    } else {
      console.log('Returning user');
      // If it's a returning user we will find an encounter with any RelatedPerson for the user
      const relatedPersons = await getRelatedPersonsForPhoneNumber(verifiedPhoneNumber, fhirClient);
      if (relatedPersons) {
        const relatedPersonIDs = relatedPersons?.map((relatedPersonTemp) => `RelatedPerson/${relatedPersonTemp.id}`);
        // Get an encounter with any RelatedPerson the user has access to
        console.log('Getting an encounter for user');
        const conversationEncounterResults: Encounter[] = await fhirClient.searchResources({
          resourceType: 'Encounter',
          searchParams: [
            {
              name: 'participant',
              value: relatedPersonIDs.join(','),
            },
            {
              name: 'class',
              value: 'VR',
            },
          ],
        });

        if (conversationEncounterResults.length === 1 && conversationEncounterResults[0].id) {
          console.log(
            `Adding this patient's RelatedPerson ${relatedPerson.id} to Encounter ${conversationEncounterResults[0].id}`,
          );
          await fhirClient.patchResource({
            resourceType: 'Encounter',
            resourceId: conversationEncounterResults[0].id,
            operations: [
              {
                op: 'add',
                path: '/participant/0',
                value: {
                  individual: {
                    reference: `RelatedPerson/${relatedPerson.id}`,
                  },
                },
              },
            ],
          });

          conversationSID = (conversationEncounterResults[0] as Encounter).extension
            ?.find(
              (extensionTemp) =>
                extensionTemp.url === `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
            )
            ?.extension?.find((extensionTemp) => extensionTemp.url === 'addressString')?.valueString;
        }
      }
    }
  } else {
    console.log('Returning patient');
    conversationSID = await getConversationSIDForUser(user, fhirClient);
  }

  if (conversationSID) {
    const timezone = fhirLocation.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
    )?.valueString;
    await sendMessages(
      getPatientContactEmail(fhirPatient),
      getPatientFirstName(fhirPatient),
      conversationSID,
      originalDate.setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
      secrets,
      fhirLocation,
      appointment.id || '',
      appointment.appointmentType?.text || '',
    );
  }

  console.log('success, here is the id: ', appointment.id);
  const response = {
    message: 'Successfully created an appointment and encounter',
    appointment: appointment.id || '',
    fhirPatientId: fhirPatient.id || '',
  };

  return response;
}

function validateInternalInformation(patient: PatientInfo): void {
  if (patient.dateOfBirth && !ageIsInRange(patient.dateOfBirth)) {
    throw new Error(`age not inside range of ${MINIMUM_AGE} to ${MAXIMUM_AGE}`);
  }

  if (patient.reasonForVisit && patient.reasonForVisit.join(', ').length > MAXIMUM_CHARACTER_LIMIT) {
    throw new Error(`all visit reasons must be less than ${MAXIMUM_CHARACTER_LIMIT} characters`);
  }
}

export function createMinimumAndMaximumTime(date: DateTime): string[] {
  const minimum = formatDate(date.plus({ days: 1 }));
  // Could do #plus({ months: 1 }), but 30 days is easier to test
  const maximum = formatDate(date.plus({ days: 30 }));
  return [minimum, maximum];
}

export async function sendMessages(
  email: string | undefined,
  firstName: string | undefined,
  conversationSID: string,
  startTime: string,
  secrets: Secrets | null,
  location: Location,
  appointmentID: string,
  appointmentType: string,
): Promise<void> {
  if (email) {
    await sendConfirmationEmail({
      email,
      startTime,
      appointmentID,
      secrets,
      location,
      appointmentType,
    });
  } else {
    console.log('email undefined');
  }

  if (!zapehrMessagingToken) {
    zapehrMessagingToken = await getAccessToken(secrets, 'messaging');
  }
  const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
  const message = `You're confirmed! Thanks for choosing Ottehr Urgent Care! Your check-in time for ${firstName} at ${
    location.name
  } is on ${startTime}. To edit your paperwork${
    appointmentType === 'walkin' ? '' : ` or modify/cancel your check-in`
  }, please visit: ${WEBSITE_URL}/appointment/${appointmentID}`;
  await sendMessage(message, conversationSID, zapehrMessagingToken, secrets);
}

interface TransactionInput {
  getLocationRequest: BatchInputRequest;
  reasonForVisit: string[];
  startTime: string;
  endTime: string;
  visitType: VisitType;
  location: string;
  fhirClient: FhirClient;
  additionalInfo?: string;
  unconfirmedDateOfBirth?: string;
  patient?: Patient;
  createPatientRequest?: BatchInputPostRequest;
  updatePatientRequest?: BatchInputRequest;
}
interface TransactionOutput {
  appointment: Appointment;
  encounter: Encounter;
  patient: Patient;
  location: Location;
}

export const performTransactionalFhirRequests = async (input: TransactionInput): Promise<TransactionOutput> => {
  const {
    fhirClient,
    patient,
    location,
    reasonForVisit,
    startTime,
    endTime,
    visitType,
    additionalInfo,
    unconfirmedDateOfBirth,
    createPatientRequest,
    updatePatientRequest,
    getLocationRequest,
  } = input;

  if (!patient && !createPatientRequest?.fullUrl) {
    throw new Error('Unexpectedly have no patient and no request to make one');
  }
  const patientRef = patient ? `Patient/${patient.id}` : createPatientRequest?.fullUrl;

  const now: string = DateTime.now().setZone('UTC').toISO() || '';
  const initialStatus = visitType === VisitType.PreBook ? 'PENDING' : 'ARRIVED';
  const initialAppointmentStatus = mapOtherEHRVisitStatusToFhirAppointmentStatus(initialStatus);
  const initialEncounterStatus = mapOtherEHRVisitStatusToFhirEncounterStatus(initialStatus);
  const extension: Extension[] = [makeOtherEHRVisitStatusExtension(initialStatus, now)];

  if (unconfirmedDateOfBirth) {
    extension.push({
      url: 'http://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
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

  const apptResource: Appointment = {
    resourceType: 'Appointment',
    participant: [
      {
        actor: {
          reference: patientRef,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Location/${location}`,
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
          code: visitType === VisitType.WalkIn ? 'WALKIN' : 'PREBOOK',
          display: visitType,
        },
      ],
      text: visitType,
    },
    description: reasonForVisit.join(','),
    status: initialAppointmentStatus,
    created: now ?? '',
    extension: extension,
  };

  const encResource: Encounter = {
    resourceType: 'Encounter',
    status: initialEncounterStatus,
    statusHistory: [
      {
        status: initialEncounterStatus,
        period: {
          start: DateTime.now().setZone('UTC').toISO() ?? '',
        },
      },
    ],
    // todo double check this is the correct classification
    class: {
      system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
      code: 'ACUTE',
      display: 'inpatient acute',
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
          reference: `Location/${location}`,
        },
      },
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
    requests: [...patientRequests, postApptReq, postEncRequest, getLocationRequest],
  };
  console.log('making transaction request');
  const bundle = await fhirClient.transactionRequest(transactionInput);
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
  const location: Location = entry.find((enc) => {
    return enc.resource && enc.resource.resourceType === 'Location';
  })?.resource as Location;
  const patient: Patient = entry.find((enc) => {
    return enc.resource && enc.resource.resourceType === 'Patient';
  })?.resource as Patient;

  if (appointment === undefined) {
    throw new Error('Appointment could not be created');
  }
  if (encounter === undefined) {
    throw new Error('Encounter could not be created');
  }
  if (location === undefined) {
    throw new Error('Location could not be found');
  }
  if (patient === undefined) {
    throw new Error('Patient could not be found');
  }

  if (!location.name) {
    throw new Error(`Location ${location.id} does not have a name`);
  }

  console.log('successfully obtained resources from bundle');
  return { appointment, encounter, location, patient };
};

export async function getConversationSIDForUser(user: User, fhirClient: FhirClient): Promise<string | undefined> {
  const relatedPersons = await getRelatedPersonsForPhoneNumber(user.name, fhirClient);
  if (relatedPersons) {
    return getConversationSIDForRelatedPersons(relatedPersons, fhirClient);
  }
  return undefined;
}

export async function getConversationSIDForRelatedPersons(
  relatedPersons: RelatedPerson[],
  fhirClient: FhirClient,
): Promise<string | undefined> {
  const relatedPersonIDs = relatedPersons?.map((relatedPersonTemp) => `RelatedPerson/${relatedPersonTemp.id}`);
  // Get an encounter with any RelatedPerson the user has access to
  console.log('Getting an encounter for user');
  const conversationEncounterResults: Encounter[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: 'participant',
        value: relatedPersonIDs.join(','),
      },
      {
        name: 'class',
        value: 'VR',
      },
    ],
  });
  if (conversationEncounterResults.length !== 1) {
    return undefined;
  }
  const conversationSID = getConversationSIDFromEncounter(conversationEncounterResults[0]);
  return conversationSID;
}

function getConversationSIDFromEncounter(encounter: Encounter): string | undefined {
  const conversationSID = encounter.extension
    ?.find(
      (extensionTemp) => extensionTemp.url === `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
    )
    ?.extension?.find((extensionTemp) => extensionTemp.url === 'addressString')?.valueString;
  return conversationSID;
}
