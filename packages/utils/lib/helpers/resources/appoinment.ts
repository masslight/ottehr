import { FhirClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';

export async function getAppointmentResourceById(
  appointmentID: string,
  fhirClient: FhirClient
): Promise<Appointment | undefined> {
  let response: Appointment | null = null;
  try {
    response = await fhirClient.readResource<Appointment>({
      resourceType: 'Appointment',
      resourceId: appointmentID,
    });
  } catch (error: any) {
    if (error?.issue?.[0]?.code === 'not-found') {
      return undefined;
    } else {
      throw error;
    }
  }

  return response;
}
