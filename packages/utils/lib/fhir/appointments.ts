import { FhirClient } from '@zapehr/sdk';
import { Appointment } from 'fhir/r4';
import { CancellationReasonCodes, CancellationReasonOptions } from '../types/urgent-care';

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
