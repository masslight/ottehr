import { Appointment, EncounterStatusHistory } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ENV_LOCATION_ID } from './constants';

export interface AppointmentParams {
  patientId: string;
  locationId: string;
  startTime: string;
  endTime: string;
  description: string;
  status?: Appointment['status'];
  bookedBy?: string;
  dateOfBirth?: string;
  createdBy?: string;
}

export function createAppointment({
  patientId,
  locationId = ENV_LOCATION_ID,
  startTime,
  endTime,
  description,
  status = 'booked',
  bookedBy = 'Parent/Guardian',
  dateOfBirth,
  createdBy,
}: Omit<AppointmentParams, 'locationId'> & { locationId?: string }): Appointment {
  const NOW_DT = DateTime.now().setZone('America/New_York');
  const now = NOW_DT.toISO() || '';

  const statusHistory: EncounterStatusHistory[] = [];

  // add second status only if it's arrived
  if (status === 'arrived') {
    statusHistory.push(
      {
        status: 'planned',
        period: {
          start: NOW_DT.minus({ minutes: 30 }).toISO() || '',
          end: now,
        },
      },
      {
        status: 'arrived',
        period: {
          start: now,
        },
      }
    );
  } else {
    statusHistory.push({
      status: 'planned',
      period: {
        start: now,
      },
    });
  }

  return {
    resourceType: 'Appointment',
    meta: {
      tag: [
        {
          code: 'OTTEHR-IP',
        },
        {
          system: 'created-by',
          display: createdBy || 'System',
        },
      ],
    },
    participant: [
      {
        actor: {
          reference: `Patient/${patientId}`,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Location/${locationId}`,
        },
        status: 'accepted',
      },
    ],
    start: startTime,
    end: endTime,
    appointmentType: {
      text: 'prebook',
    },
    description: description,
    status: status,
    created: now,
    extension: [
      {
        url: 'https://fhir.zapehr.com/r4/StructureDefinitions/visit-booked-by',
        valueString: bookedBy,
      },
      ...(dateOfBirth
        ? [
            {
              url: 'https://fhir.zapehr.com/r4/StructureDefinitions/date-of-birth-not-confirmed',
              valueString: dateOfBirth,
            },
          ]
        : []),
    ],
  };
}

export function createTelemedAppointment({
  patientId,
  locationId = ENV_LOCATION_ID!,
  startTime,
  endTime,
  description,
  status = 'booked',
}: Pick<
  AppointmentParams,
  'patientId' | 'locationId' | 'startTime' | 'endTime' | 'description' | 'status'
>): Appointment {
  const NOW_DT = DateTime.now().setZone('America/New_York');
  const now = NOW_DT.toISO() || '';

  return {
    resourceType: 'Appointment',
    meta: {
      tag: [
        {
          code: 'OTTEHR-TM',
        },
        // {
        //   system: 'created-by',
        //   display: 'Staff aahmadli@masslight.com via QRS',
        // },
        {
          system: 'https://fhir.ottehr.com/r4/provider-notifications-tag',
          code: 'patient waiting',
        },
      ],
    },
    participant: [
      {
        actor: {
          reference: `Patient/${patientId}`,
        },
        status: 'accepted',
      },
      {
        actor: {
          reference: `Location/${locationId}`,
        },
        status: 'accepted',
      },
    ],
    start: startTime,
    end: endTime,
    appointmentType: {
      text: 'prebook',
    },
    description: description,
    status: status,
    created: now,
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/appointment-virtual-service-pre-release',
        extension: [
          {
            url: 'channelType',
            valueCoding: {
              system: 'https://fhir.zapehr.com/virtual-service-type',
              code: 'chime-video-meetings',
              display: 'Twilio Video Group Rooms',
            },
          },
        ],
      },
    ],
  };
}
