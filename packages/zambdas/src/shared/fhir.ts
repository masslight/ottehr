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
      active: true,
      birthDate: removeTimeFromDate(parameters.dateOfBirth ?? ''),
      extension: [
        {
          url: 'http://example.com/fhir/extensions#race',
          valueCodeableConcept: {
            coding: [
              {
                code: PatientRaceCode[parameters.race],
                display: parameters.race,
                system: 'http://hl7.org/fhir/v3/Race',
              },
            ],
          },
        },
        {
          url: 'http://example.com/fhir/extensions#ethnicity',
          valueCodeableConcept: {
            coding: [
              {
                code: PatientEthnicityCode[parameters.ethnicity],
                display: parameters.ethnicity,
                system: 'http://hl7.org/fhir/v3/Ethnicity',
              },
            ],
          },
        },
      ],
      gender: parameters.sex,
      name: [
        {
          family: parameters.lastName,
          given: [parameters.firstName],
        },
      ],
      resourceType: 'Patient',
    };

    const response: Patient = await fhirClient.createResource(patientResource);
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to create Patient: ${JSON.stringify(error)}`);
  }
}

export async function getPatientResource(patientId: string, fhirClient: FhirClient): Promise<any> {
  const response: Patient = await fhirClient.readResource({
    resourceId: patientId ?? '',
    resourceType: 'Patient',
  });

  console.log(5, response, patientId, response.extension?.[0].valueCodeableConcept);

  return response;
}

export async function getAppointmentResource(appointmentId: string, fhirClient: FhirClient): Promise<any> {
  const response: Appointment = await fhirClient.readResource({
    resourceId: appointmentId ?? '',
    resourceType: 'Appointment',
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
      operations: patchOperations,
      resourceId: patientId,
      resourceType: 'Patient',
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update Patient: ${JSON.stringify(error)}`);
  }
}

export async function getLocation(scheduleId: string, fhirClient: FhirClient): Promise<Location> {
  const schedule: Schedule = await fhirClient.readResource({
    resourceId: scheduleId,
    resourceType: 'Schedule',
  });

  const location: Location = await fhirClient.readResource({
    resourceId: schedule?.actor[0]?.reference?.split('/')[1] || '',
    resourceType: 'Location',
  });

  return location;
}

export async function getResponsiblePartyResource(responsiblePartyId: string, fhirClient: FhirClient): Promise<any> {
  const response: Patient = await fhirClient.readResource({
    resourceId: responsiblePartyId ?? '',
    resourceType: 'RelatedPerson',
  });

  return response;
}

export async function getPractitionerResource(practitionerId: string, fhirClient: FhirClient): Promise<Practitioner> {
  const response: Practitioner = await fhirClient.readResource({
    resourceId: practitionerId,
    resourceType: 'Practitioner',
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
      created: now.toISO() ?? '',
      description: reasonForVisit.join(','),
      end: endTime,
      extension: extension,
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
      resourceType: 'Appointment',
      start: startTime,
      status: 'booked',
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
      appointment: [
        {
          reference: `Appointment/${appointment.id}`,
        },
      ],
      // todo double check this is the correct classification
      class: {
        code: 'ACUTE',
        display: 'inpatient acute',
        system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
      },
      location: [
        {
          location: {
            reference: `Location/${location}`,
          },
        },
      ],
      resourceType: 'Encounter',
      status: 'planned',
      statusHistory: [
        {
          period: {
            start: DateTime.now().toISO() ?? '',
          },
          status: 'planned',
        },
      ],
      subject: { reference: `Patient/${patient.id}` },
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
                code: CancellationReasonCodes[cancellationReason],
                display: cancellationReason,
                system: 'http://terminology.hl7.org/CodeSystem/appointment-cancellation-reason',
              },
            ],
          },
        },
      ],
      resourceId: appointmentId,
      resourceType: 'Appointment',
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
      operations: patchOperations,
      resourceId: apptId,
      resourceType: 'Appointment',
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
      resourceId: appointmentId ?? '',
      resourceType: 'Appointment',
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
              operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
              resourceId: oldDoc.id || '',
              resourceType: 'DocumentReference',
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
          contentType: `image/${cardFrontUrl.split('.').slice(-1)}`,
          title: cardFrontTitle,
          url: cardFrontUrl,
        },
      });

    cardBackUrl &&
      content.push({
        attachment: {
          contentType: `image/${cardBackUrl.split('.').slice(-1)}`,
          title: cardBackTitle,
          url: cardBackUrl,
        },
      });

    const response = fhirClient.createResource<DocumentReference>({
      content: content,
      resourceType: 'DocumentReference',
      status: 'current',
      type: type,
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
      name: 'Self-Pay Account',
      resourceType: 'Account',
      status: 'active',
      subject: [
        {
          reference: `Patient/${patientId}`,
        },
      ],
      text: {
        div: `<div>Self-pay account for Patient ${patientId}</div>`,
        status: 'generated',
      },
      type: {
        coding: [
          {
            code: 'PBILLACCT',
            display: 'patient billing account',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
          },
        ],
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
      identifier: [
        {
          system: 'http://example.com/signature',
          value: forms.signature,
        },
      ],
      name: [
        {
          text: forms.fullName,
          use: 'official',
        },
      ],
      patient: {
        reference: `Patient/${patientId}`,
      },
      relationship: [
        {
          coding: [
            {
              code: forms.relationship,
              display: forms.relationship,
              system: 'http://example.com/relationship',
            },
          ],
        },
      ],
      resourceType: 'RelatedPerson',
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
      category: [
        {
          coding: [
            {
              code: 'hipaa-ack',
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
            },
          ],
        },
        {
          coding: [
            {
              code: 'treat-guarantee',
              system: 'http://terminology.hl7.org/CodeSystem/consentcategorycodes',
            },
          ],
        },
      ],
      dateTime: now.toISO() ?? '',
      patient: {
        reference: `Patient/${patientId}`,
      },
      performer: [{ reference: `RelatedPerson/${signer.id}` }],
      policy: [
        {
          uri: 'http://example.com/policies/consent-policy',
        },
      ],
      provision: {
        provision: [
          {
            type: forms.HIPAA && forms.consentToTreat ? 'permit' : 'deny',
          },
        ],
        type: 'deny',
      },
      resourceType: 'Consent',
      scope: {
        coding: [
          {
            code: 'patient-privacy',
            display: 'Patient Privacy',
            system: 'http://terminology.hl7.org/CodeSystem/consentscope',
          },
        ],
      },
      status: 'active',
    });
    return createdConsent;
  } catch (error: unknown) {
    throw new Error(`Failed to create Forms Consent Information: ${JSON.stringify(error)}`);
  }
}

export async function makeSlotStatusBusy(slotId: string, fhirClient: FhirClient): Promise<Slot> {
  const slot: Slot = await fhirClient.patchResource({
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: 'busy',
      },
    ],
    resourceId: slotId,
    resourceType: 'Slot',
  });

  if (slot.status !== 'busy') {
    throw new Error('slot status is not busy');
  }

  return slot;
}

export async function getAppointment(apptId: string, fhirClient: FhirClient): Promise<Appointment> {
  try {
    const appointment: Appointment = await fhirClient.readResource({
      resourceId: apptId,
      resourceType: 'Appointment',
    });
    return appointment;
  } catch (error: unknown) {
    throw new Error(`Failed to get Appointment: ${JSON.stringify(error)}`);
  }
}
