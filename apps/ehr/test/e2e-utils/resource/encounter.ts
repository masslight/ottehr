import { Encounter } from 'fhir/r4b';
import { ENV_LOCATION_ID } from './constants';

interface EncounterParams {
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
