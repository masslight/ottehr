import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import { TelemedCallStatuses, mapStatusToTelemed } from 'utils';
import { AppointmentInsuranceRelatedResourcesExtension } from 'utils';

export function getPatientFromAppointment(appointment: Appointment): string | undefined {
  return appointment.participant
    .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.split('/')[1];
}

export async function patchAppointmentResource(
  apptId: string,
  patchOperations: Operation[],
  oystehr: Oystehr
): Promise<Appointment> {
  try {
    const response: Appointment = await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: apptId,
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
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    const response: Encounter = await oystehr.fhir.patch({
      resourceType: 'Encounter',
      id: encId,
      operations: patchOperations,
    });
    return response;
  } catch (error: any) {
    console.log(`Failed to patch Encounter: ${JSON.stringify(error)}`);
    throw new Error(`Failed to patch Encounter: ${JSON.stringify(error)}`);
  }
}

export { mapStatusToTelemed };

export const telemedStatusToEncounter = (telemedStatus: TelemedCallStatuses): Encounter['status'] => {
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
    case 'cancelled':
      return 'cancelled';
  }
};

export { removePrefix } from 'utils';

export interface AppointmentInsuranceRelatedResRefs {
  primaryCoverage?: string;
  primaryCoverageEligibilityRequest?: string;
  primaryCoverageEligibilityResponse?: string;
  secondaryCoverage?: string;
  secondaryCoverageEligibilityRequest?: string;
  secondaryCoverageEligibilityResponse?: string;
}

export function getInsuranceRelatedRefsFromAppointmentExtension(
  appointment: Appointment
): AppointmentInsuranceRelatedResRefs {
  const result: AppointmentInsuranceRelatedResRefs = {};
  const mainExtension = appointment.extension?.find(
    (ext) => ext.url === AppointmentInsuranceRelatedResourcesExtension.extensionUrl
  );
  mainExtension?.extension?.forEach((ext) => {
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.coverage.url)
      result.primaryCoverage = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityRequest.url)
      result.primaryCoverageEligibilityRequest = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityResponse.url)
      result.primaryCoverageEligibilityResponse = ext.valueReference?.reference;

    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.coverage.url)
      result.secondaryCoverage = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityRequest.url)
      result.secondaryCoverageEligibilityRequest = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityResponse.url)
      result.secondaryCoverageEligibilityResponse = ext.valueReference?.reference;
  });
  return result;
}
