import { ClientConfig, FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Coding, Encounter, Meta, Patient, RelatedPerson, Resource } from 'fhir/r4';
import {
  ConsentSigner,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
  createConsentResource,
  createDocumentReference,
  getLocationResource,
  getSecret,
} from 'ottehr-utils';

export async function getPatientResource(patientID: string, fhirClient: FhirClient): Promise<Patient> {
  const response: Patient = await fhirClient.readResource({
    resourceType: 'Patient',
    resourceId: patientID ?? '',
  });

  return response;
}

export async function updatePatientResource(
  patientId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient,
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

// Create consent PDFs, DocumentReferences, and Consent resources
export async function createConsentItems(
  dateTime: string,
  patient: Patient,
  consentSigner: ConsentSigner,
  appointmentID: string,
  locationID: string,
  ipAddress: string,
  fhirClient: FhirClient,
  token: string,
  secrets: Secrets | null,
  ottehrModule: OTTEHR_MODULE,
): Promise<void> {
  console.log('Creating consent PDFs');
  if (!patient.id) {
    throw new Error('No patient id found for consent items');
  }
  // Get timezone from location
  const locationResource = await getLocationResource(locationID, fhirClient);
  if (!locationResource) {
    throw new Error(`Location ${locationID} not found`);
  }

  const isVirtualLocation =
    locationResource.extension?.find(
      (ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release',
    )?.valueCoding?.code === 'vi';

  const timezone = locationResource.extension?.find(
    (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone',
  )?.valueString;

  const facilityName = isVirtualLocation
    ? 'Ottehr'
    : locationResource.identifier?.find(
        (identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/facility-name',
      )?.value;

  await createFhirResources(fhirClient, dateTime, patient.id, appointmentID, ottehrModule);
}

async function createFhirResources(
  fhirClient: FhirClient,
  dateTime: string,
  patientId: string,
  appointmentId: string,
  ottehrModule: OTTEHR_MODULE,
): Promise<void> {
  // Create DocumentReference for consent PDFs
  const consentDocumentReference = await createDocumentReference({
    fhirClient,
    docInfo: [
      {
        contentURL: 'todo',
        title: 'todo',
        mimeType: 'todo',
      },
    ],
    type: {
      coding: [
        {
          system: 'http://loinc.org',
          code: '59284-0',
          display: 'Consent Documents',
        },
      ],
      text: 'Consent forms',
    },
    dateCreated: dateTime,
    references: {
      subject: {
        reference: `Patient/${patientId}`,
      },
      context: {
        related: [
          {
            reference: `Appointment/${appointmentId}`,
          },
        ],
      },
    },
    ottehrModule,
  });
  if (!consentDocumentReference.id) {
    throw new Error('No consent document reference id found');
  }
  await createConsentResource(patientId ?? '', consentDocumentReference.id, dateTime, fhirClient);
}

export async function updateAppointmentResource(
  appointment: Appointment,
  patchOperations: Operation[],
  fhirClient: FhirClient,
): Promise<Appointment> {
  try {
    if (!appointment.id) {
      throw Error('Appointment resource missing id');
    }

    const response: Appointment = await fhirClient.patchResource<Appointment>({
      resourceType: 'Appointment',
      resourceId: appointment.id,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update appointment: ${JSON.stringify(error)}`);
  }
}

export async function updateEncounterResource(
  encounterId: Encounter['id'],
  patchOperations: Operation[],
  fhirClient: FhirClient,
): Promise<Encounter> {
  try {
    if (!encounterId) {
      throw Error('Encounter resource missing id');
    }

    const response: Encounter = await fhirClient.patchResource<Encounter>({
      resourceType: 'Encounter',
      resourceId: encounterId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to update encounter: ${JSON.stringify(error)}`);
  }
}

export function createFhirClient(token: string, secrets: Secrets | null): FhirClient {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const CLIENT_CONFIG: ClientConfig = {
    apiUrl: FHIR_API,
    accessToken: token,
  };
  console.log('creating fhir client');
  return new FhirClient(CLIENT_CONFIG);
}

export async function searchInvitedParticipantResourcesByEncounterId(
  encounterId: string,
  fhirClient: FhirClient,
): Promise<RelatedPerson[]> {
  const allResources: Resource[] = await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: '_id',
        value: encounterId,
      },
      {
        name: '_include',
        value: 'Encounter:participant',
      },
    ],
  });

  const relatedPersons: RelatedPerson[] = <RelatedPerson[]>(
    allResources.filter((r) => r.resourceType === 'RelatedPerson')
  );
  return relatedPersons.filter((r) => r.relationship?.[0].coding?.[0].code === 'WIT');
}
