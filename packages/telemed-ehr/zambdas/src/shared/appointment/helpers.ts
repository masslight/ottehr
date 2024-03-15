import { FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4';
import { TelemedCallStatuses, mapStatusToTelemed } from 'ehr-utils';

export function getPatientFromAppointment(appointment: Appointment): string | undefined {
  return appointment.participant
    .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.split('/')[1];
}

export async function patchAppointmentResource(
  apptId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient,
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

export async function patchEncounterResource(
  encId: string,
  patchOperations: Operation[],
  fhirClient: FhirClient,
): Promise<Encounter> {
  try {
    const response: Encounter = await fhirClient.patchResource({
      resourceType: 'Encounter',
      resourceId: encId,
      operations: patchOperations,
    });
    return response;
  } catch (error: any) {
    console.log(`Failed to patch Encounter: ${JSON.stringify(error)}`);
    throw new Error(`Failed to patch Encounter: ${JSON.stringify(error)}`);
  }
}

export { mapStatusToTelemed };

export const telemedStatusToEncounter = (telemedStatus: TelemedCallStatuses): string => {
  switch (telemedStatus) {
    case 'ready':
      return 'planned';
    case 'pre-video':
      return 'arrived';
    case 'on-video':
      return 'in-progress';
    case 'unsigned':
      return 'finished';
    case 'complete':
      return 'finished';
  }
};

export const removePrefix = (prefix: string, text: string): string | undefined => {
  return text.includes(prefix) ? text.replace(prefix, '') : undefined;
};
