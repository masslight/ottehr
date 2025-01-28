import { FhirClient } from '@zapehr/sdk';
import { Appointment, CodeableConcept } from 'fhir/r4';

export async function cancelAppointmentResource(
  appointment: Appointment,
  cancellationReasonCoding: NonNullable<CodeableConcept['coding']>,
  fhirClient: FhirClient
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
            coding: cancellationReasonCoding,
          },
        },
      ],
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to cancel Appointment: ${JSON.stringify(error)}`);
  }
}
