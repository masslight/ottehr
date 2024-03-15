import { ClientConfig, FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Coding, Meta, Patient, QuestionnaireResponse, Resource } from 'fhir/r4';
import { Secrets, getSecret, SecretsKeys } from 'ottehr-utils';
import { CancellationReasonCodes, CancellationReasonOptions } from '../types';

export const OTTEHR_TELEMED_METATAG = 'OTTEHR-TELEMED';

export const isTelemedAppointment = (appointment: Appointment): boolean => {
  const tags = appointment.meta?.tag ?? [];

  return tags.some((tag) => {
    return tag.code === OTTEHR_TELEMED_METATAG;
  });
};

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

export async function cancelAppointmentResource(
  appointment: Appointment,
  cancellationReason: CancellationReasonOptions,
  fhirClient: FhirClient,
): Promise<Appointment> {
  if (!appointment.id) {
    throw Error('Appointment resource missing id');
  }

  try {
    const response: Appointment = await fhirClient.patchResource({
      resourceType: 'Appointment',
      resourceId: appointment.id,
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

export async function getQuestionnaireResponse(
  questionnaireID: string,
  encounterID: string,
  fhirClient: FhirClient,
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'encounter',
        value: `Encounter/${encounterID}`,
      },
    ],
  });

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
}

export async function getRecentQuestionnaireResponse(
  questionnaireID: string,
  patientID: string,
  fhirClient: FhirClient,
): Promise<QuestionnaireResponse | undefined> {
  const questionnaireResponse: QuestionnaireResponse[] = await fhirClient.searchResources({
    resourceType: 'QuestionnaireResponse',
    searchParams: [
      {
        name: 'questionnaire',
        value: `Questionnaire/${questionnaireID}`,
      },
      {
        name: 'subject',
        value: `Patient/${patientID}`,
      },
      {
        name: '_sort',
        value: '-_lastUpdated',
      },
      {
        name: '_count',
        value: '1',
      },
    ],
  });

  if (questionnaireResponse.length === 1) {
    return questionnaireResponse[0];
  }
  return undefined;
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
