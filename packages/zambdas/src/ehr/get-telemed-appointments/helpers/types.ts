import { Appointment, Encounter, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { AppointmentLocation, TelemedCallStatuses, TelemedStatusHistoryElement } from 'utils';

export interface AppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
  location?: AppointmentLocation;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  paperwork?: QuestionnaireResponse;
  practitioner?: Practitioner;
}

export type LocationIdToAbbreviationMap = { [stateAbbreviation: string]: string };

export type AppointmentToLocationIdMap = { [locationId: string]: Appointment };
