import { FhirClient, SearchParam } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import {
  Account,
  Appointment,
  CodeableConcept,
  Consent,
  DocumentReference,
  DocumentReferenceContent,
  Encounter,
  Extension,
  Location,
  Patient,
  Practitioner,
  RelatedPerson,
  Resource,
  Schedule,
  Slot,
} from 'fhir/r4';
import { DateTime } from 'luxon';
import { removeTimeFromDate } from './dateUtils';
import {
  CancellationReasonCodes,
  CancellationReasonOptions,
  PatientEthnicityCode,
  PatientInfo,
  PatientRaceCode,
} from '../types';

export async function createPatientResource(parameters: PatientInfo, fhirClient: FhirClient): Promise<any> {
  try {
    if (!parameters.firstName) {
      throw new Error('First name is undefined');
    }
    if (!parameters.ethnicity) {
      throw new Error('Ethnicity is undefined');
    }
    if (!parameters.race) {
      throw new Error('Race is undefined');
    }
    const patientResource: Patient = {
      resourceType: 'Patient',
      name: [
        {
          given: [parameters.firstName],
          family: parameters.lastName,
        },
      ],
      birthDate: removeTimeFromDate(parameters.dateOfBirth ?? ''),
      gender: parameters.sex,
      active: true,
      extension: [
        {
          url: 'http://example.com/fhir/extensions#race',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://hl7.org/fhir/v3/Race',
                code: PatientRaceCode[parameters.race],
                display: parameters.race,
              },
            ],
          },
        },
        {
          url: 'http://example.com/fhir/extensions#ethnicity',
          valueCodeableConcept: {
            coding: [
              {
                system: 'http://hl7.org/fhir/v3/Ethnicity',
                code: PatientEthnicityCode[parameters.ethnicity],
                display: parameters.ethnicity,
              },
            ],
          },
        },
      ],
    };

    const response: Patient = await fhirClient.createResource(patientResource);
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to create Patient: ${JSON.stringify(error)}`);
  }
}

export async function getPatientResource(patientId: string, fhirClient: FhirClient): Promise<any> {
  const response: Patient = await fhirClient.readResource({
    resourceType: 'Patient',
    resourceId: patientId ?? '',
  });

  console.log(5, response, patientId, response.extension?.[0].valueCodeableConcept);

  return response;
}

export async function getAppointmentResource(appointmentId: string, fhirClient: FhirClient): Promise<any> {
  const response: Appointment = await fhirClient.readResource({
    resourceType: 'Appointment',
    resourceId: appointmentId ?? '',
  });

  return response;
}

export async function updatePatientResource(
  patientId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient
): Promise<Patient> {
  try {
    const response: Patient = await fhirClient.patchResource({
      resourceType: 'Patient',
      resourceId: patientId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update Patient: ${JSON.stringify(error)}`);
  }
}

export async function getLocation(scheduleId: string, fhirClient: FhirClient): Promise<Location> {
  const schedule: Schedule = await fhirClient.readResource({
    resourceType: 'Schedule',
    resourceId: scheduleId,
  });

  const location: Location = await fhirClient.readResource({
    resourceType: 'Location',
    resourceId: schedule?.actor[0]?.reference?.split('/')[1] || '',
  });

  return location;
}

export async function getResponsiblePartyResource(responsiblePartyId: string, fhirClient: FhirClient): Promise<any> {
  const response: Patient = await fhirClient.readResource({
    resourceType: 'RelatedPerson',
    resourceId: responsiblePartyId ?? '',
  });

  return response;
}

export async function getPractitionerResource(practitionerId: string, fhirClient: FhirClient): Promise<Practitioner> {
  const response: Practitioner = await fhirClient.readResource({
    resourceType: 'Practitioner',
    resourceId: practitionerId,
  });

  return response;
}

export async function createAppointmentResource(
  patient: Patient,
  reasonForVisit: string[],
  startTime: string,
  endTime: string,
  location: string,
  fhirClient: FhirClient,
  additionalInfo?: string
): Promise<any> {
  try {
    const now = DateTime.now();
    const extension: Extension[] = [
      {
        url: 'https://zapehr.com/appointment-sent-to-redox',
        valueBoolean: false,
      },
    ];

    if (additionalInfo) {
      extension.push({
        url: 'http://example.com/extensions#additionalInformation',
        valueString: additionalInfo,
      });
    }

    const appointment: Appointment = await fhirClient.createResource({
      resourceType: 'Appointment',
      participant: [
        {
          actor: {
            reference: `Patient/${patient.id}`,
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
      description: reasonForVisit.join(','),
      status: 'booked',
      created: now.toISO() ?? '',
      extension: extension,
    });
    const encounter = await createEncounter(appointment, patient, location, fhirClient);
    console.log('encounter: ', encounter);
    return { appointment, encounter };
  } catch (error: unknown) {
    throw new Error(`Failed to create Appointment: ${JSON.stringify(error)}`);
  }
}

export async function createEncounter(
  appointment: Appointment,
  patient: Patient,
  location: string,
  fhirClient: FhirClient
): Promise<Encounter> {
  try {
    const encounter: Encounter = await fhirClient.createResource({
      resourceType: 'Encounter',
      status: 'planned',
      statusHistory: [
        {
          status: 'planned',
          period: {
            start: DateTime.now().toISO() ?? '',
          },
        },
      ],
      // todo double check this is the correct classification
      class: {
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
        code: 'ACUTE',
        display: 'inpatient acute',
      },
      subject: { reference: `Patient/${patient.id}` },
      appointment: [
        {
          reference: `Appointment/${appointment.id}`,
        },
      ],
      location: [
        {
          location: {
            reference: `Location/${location}`,
          },
        },
      ],
    });
    return encounter;
  } catch (error: unknown) {
    throw new Error(`Failed to create Encounter: ${JSON.stringify(error)}`);
  }
}

export async function cancelAppointmentResource(
  appointmentId: string,
  cancellationReason: CancellationReasonOptions,
  fhirClient: FhirClient
): Promise<Resource> {
  try {
    const response = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: appointmentId,
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
            coding: [
              {
                // todo reassess codes and reasons, just using custom codes atm
                system: 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason',
                code: CancellationReasonCodes[cancellationReason],
                display: cancellationReason,
              },
            ],
          },
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to cancel Appointment: ${JSON.stringify(error)}`);
  }
}

export async function patchAppointmentResource(
  apptId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient
): Promise<Appointment> {
  try {
    const response: Appointment = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: apptId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to patch Appointment: ${JSON.stringify(error)}`);
  }
}

// todo maybe refactor use case to use patchAppt instead and get rid of this and rename above
export async function updateAppointmentResource(
  appointmentId: string,
  startTime: string,
  endTime: string,
  fhirClient: FhirClient
): Promise<Appointment> {
  try {
    const json: Appointment = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: appointmentId ?? '',
      operations: [
        {
          op: 'replace',
          path: '/start',
          value: startTime,
        },
        {
          op: 'replace',
          path: '/end',
          value: endTime,
        },
      ],
    });
    return json;
  } catch (error: unknown) {
    throw new Error(`Failed to update Appointment: ${JSON.stringify(error)}`);
  }
}

export async function createCardsDocumentReference(
  cardFrontUrl: string | undefined,
  cardBackUrl: string | undefined,
  cardFrontTitle: string,
  cardBackTitle: string,
  type: CodeableConcept,
  referenceParam: object,
  searchParams: SearchParam[],
  fhirClient: FhirClient
): Promise<DocumentReference | null> {
  try {
    const docsResponse = fhirClient.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        {
          name: 'status',
          value: 'current',
        },
        ...searchParams,
      ],
    });

    const docsJson = await docsResponse;
    // console.log('old cards:', docsJson);

    // Check if cards have changed
    if (docsJson.length > 0) {
      let currentCardsIndex = null;
      const docsUpdated = docsJson.map((oldDoc, index) => {
        const frontIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardFrontTitle);
        const backIndex = oldDoc.content.findIndex((card) => card.attachment.title === cardBackTitle);
        const frontUpdated = oldDoc.content?.[frontIndex]?.attachment?.url !== (cardFrontUrl || undefined);
        const backUpdated = oldDoc.content?.[backIndex]?.attachment?.url !== (cardBackUrl || undefined);

        if (frontUpdated || backUpdated) {
          fhirClient
            .patchResource({
              resourceType: 'DocumentReference',
              resourceId: oldDoc.id || '',
              operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
            })
            .catch((error) => {
              throw new Error(`Failed to update document reference status: ${JSON.stringify(error)}`);
            });
          console.log(`DocumentReference ${oldDoc.id} status changed to superseded`);
          return true;
        } else {
          // console.log('No change in cards');
          currentCardsIndex = index;
          return false;
        }
      });

      if (docsUpdated.includes(false) && currentCardsIndex !== null) {
        return docsJson[currentCardsIndex];
      }
    }

    const content: DocumentReferenceContent[] = [];
    if (!cardFrontUrl && !cardBackUrl) {
      // console.log('No cards provided');
      return null;
    }

    cardFrontUrl &&
      content.push({
        attachment: {
          url: cardFrontUrl,
          contentType: `image/${cardFrontUrl.split('.').slice(-1)}`,
          title: cardFrontTitle,
        },
      });

    cardBackUrl &&
      content.push({
        attachment: {
          url: cardBackUrl,
          contentType: `image/${cardBackUrl.split('.').slice(-1)}`,
          title: cardBackTitle,
        },
      });

    const response = fhirClient.createResource<DocumentReference>({
      resourceType: 'DocumentReference',
      status: 'current',
      type: type,
      content: content,
      ...referenceParam,
    });
    const json = await response;
    return json;
  } catch (error: unknown) {
    throw new Error(`Failed to create cards DocumentReference resource: ${JSON.stringify(error)}`);
  }
}

export async function createAccountResourceForSelfPay(patientId: string, fhirClient: FhirClient): Promise<Account> {
  try {
    const response: Account = await fhirClient.createResource({
      resourceType: 'Account',
      status: 'active',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'PBILLACCT',
            display: 'patient billing account',
          },
        ],
      },
      name: 'Self-Pay Account',
      subject: [
        {
          reference: `Patient/${patientId}`,
        },
      ],
      text: {
        status: 'generated',
        div: `<div>Self-pay account for Patient ${patientId}</div>`,
      },
    });
    const json = await response;
    return json;
  } catch (error: unknown) {
    throw new Error(`Failed to create Account for patient: ${JSON.stringify(error)}`);
  }
}

export async function createRelatedPersonConsentInformation(
  patientId: string,
  forms: any,
  fhirClient: FhirClient
): Promise<RelatedPerson> {
  try {
    const response = await fhirClient.createResource<RelatedPerson>({
      resourceType: 'RelatedPerson',
      identifier: [
        {
          system: 'http://example.com/signature',
          value: forms.signature,
        },
      ],
      name: [
        {
          use: 'official',
          text: forms.fullName,
        },
      ],
      patient: {
        reference: `Patient/${patientId}`,
      },
      relationship: [
        {
          coding: [
            {
              system: 'http://example.com/relationship',
              code: forms.relationship,
              display: forms.relationship,
            },
          ],
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to create Related Person Consent Information: ${JSON.stringify(error)}`);
  }
}

export async function createFormsConsentInformation(
  patientId: string,
  forms: any,
  signer: RelatedPerson,
  fhirClient: FhirClient
): Promise<Consent> {
  try {
    const now = DateTime.now();
    const createdConsent: Consent = await fhirClient.createResource({
      resourceType: 'Consent',
      status: 'active',
      scope: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
            code: 'patient-privacy',
            display: 'Patient Privacy',
          },
        ],
      },
      category: [
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'hipaa-ack',
            },
          ],
        },
        {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
              code: 'treat-guarantee',
            },
          ],
        },
      ],
      patient: {
        reference: `Patient/${patientId}`,
      },
      performer: [{ reference: `RelatedPerson/${signer.id}` }],
      dateTime: now.toISO() ?? '',
      provision: {
        type: 'deny',
        provision: [
          {
            type: forms.HIPAA && forms.consentToTreat ? 'permit' : 'deny',
          },
        ],
      },
      policy: [
        {
          uri: 'http://example.com/policies/consent-policy',
        },
      ],
    });
    return createdConsent;
  } catch (error: unknown) {
    throw new Error(`Failed to create Forms Consent Information: ${JSON.stringify(error)}`);
  }
}

export async function makeSlotStatusBusy(slotId: string, fhirClient: FhirClient): Promise<Slot> {
  const slot: Slot = await fhirClient.patchResource({
    resourceType: 'Slot',
    resourceId: slotId,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'busy',
      },
    ],
  });

  if (slot.status !== 'busy') {
    throw new Error('slot status is not busy');
  }

  return slot;
}

export async function getAppointment(apptId: string, fhirClient: FhirClient): Promise<Appointment> {
  try {
    const appointment: Appointment = await fhirClient.readResource({
      resourceType: 'Appointment',
      resourceId: apptId,
    });
    return appointment;
  } catch (error: unknown) {
    throw new Error(`Failed to get Appointment: ${JSON.stringify(error)}`);
  }
}
