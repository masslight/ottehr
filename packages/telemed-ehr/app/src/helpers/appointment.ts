import { getVisitTypeLabelForAppointment } from '@/types/types';
import { FhirClient } from '@zapehr/sdk';
import { OTTEHR_MODULE, getVisitStatusHistory } from 'ehr-utils';
import { Appointment } from 'fhir/r4';
import { Resource } from 'i18next';
import { DateTime } from 'luxon';
import { getVisitTotalTime } from './visitDurationUtils';

export interface SingleAppointmentRow {
  id: string | undefined;
  type: string | undefined;
  office: string | undefined;
  dateTime: string | undefined;
  length: number;
}

export async function getFirstAppointment(
  fhirClient: FhirClient,
  patientId: string,
): Promise<SingleAppointmentRow | null> {
  try {
    const resources = await fhirClient.searchResources<Resource>({
      resourceType: 'Appointment',
      searchParams: [
        { name: 'patient', value: patientId },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
        { name: '_include', value: 'Appointment:location' },
        {
          name: '_tag',
          value: `${OTTEHR_MODULE.UC},${OTTEHR_MODULE.TM}`,
        },
      ],
    });

    const appointment = resources.find((r) => r.resourceType === 'Appointment') as Appointment;
    if (!appointment) {
      return null;
    }

    const locationRef = appointment.participant
      .find((p) => p.actor?.reference?.startsWith('Location/'))
      ?.actor?.reference?.replace('Location/', '');

    const location = resources.find((r) => r.resourceType === 'Location' && r.id === locationRef) as Location;

    return {
      id: appointment.id,
      type: getVisitTypeLabelForAppointment(appointment),
      office:
        location?.address?.state && location?.name
          ? `${location.address.state.toUpperCase()} - ${location.name}`
          : undefined,
      dateTime: appointment.start,
      length: getVisitTotalTime(appointment, getVisitStatusHistory(appointment), DateTime.now()),
    };
  } catch (error) {
    console.error('Error fetching first appointment:', error);
    return null;
  }
}
