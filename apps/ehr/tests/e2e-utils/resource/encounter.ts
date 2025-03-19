import { Encounter } from 'fhir/r4b';
import { ENV_LOCATION_ID } from './constants';

export interface EncounterParams {
  startTime: string;
  patientId: string;
  locationId?: string;
  appointmentId?: string;
  status?: Encounter['status'];
  encounterClass?: {
    system: string;
    code: string;
    display: string;
  };
}

export function createEncounter({
  startTime,
  patientId,
  locationId = ENV_LOCATION_ID,
  appointmentId,
  status = 'planned',
  encounterClass = {
    system: 'http://hl7.org/fhir/R4/v3/ActEncounterCode/vs.html',
    code: 'ACUTE',
    display: 'inpatient acute',
  },
}: EncounterParams): Encounter {
  return {
    resourceType: 'Encounter',
    status: status,
    statusHistory: [
      {
        status: status,
        period: {
          start: startTime,
        },
      },
    ],
    class: encounterClass,
    subject: {
      reference: `Patient/${patientId}`,
    },
    appointment: [
      {
        reference: `Appointment/${appointmentId}`,
      },
    ],
    location: [
      {
        location: {
          reference: `Location/${locationId}`,
        },
      },
    ],
  };
}

export function createTelemedEncounter({
  startTime,
  patientId,
  locationId = ENV_LOCATION_ID,
  appointmentId,
  status = 'planned',
}: Pick<EncounterParams, 'startTime' | 'patientId' | 'locationId' | 'appointmentId' | 'status'>): Encounter {
  return {
    resourceType: 'Encounter',
    status: status,
    statusHistory: [
      {
        status: status,
        period: {
          start: startTime,
        },
      },
    ],
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'VR',
      display: 'virtual',
    },
    subject: {
      reference: `Patient/${patientId}`,
    },
    appointment: [
      {
        reference: `Appointment/${appointmentId}`,
      },
    ],
    location: [
      {
        location: {
          reference: `Location/${locationId}`,
        },
      },
    ],
    extension: [
      {
        url: 'https://extensions.fhir.zapehr.com/encounter-virtual-service-pre-release',
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
      {
        url: 'https://extensions.fhir.zapehr.com/encounter-other-participants',
        extension: [
          {
            url: 'https://extensions.fhir.zapehr.com/encounter-other-participant',
            extension: [
              {
                url: 'period',
                valuePeriod: {
                  start: startTime,
                },
              },
              {
                url: 'reference',
                valueReference: {
                  reference: `Patient/${patientId}`,
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
