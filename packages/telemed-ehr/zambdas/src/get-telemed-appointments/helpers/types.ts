import { Appointment, Communication, Encounter, QuestionnaireResponse, RelatedPerson } from 'fhir/r4';
import { AppointmentLocation, TelemedCallStatuses, TelemedStatusHistoryElement } from 'ehr-utils';

export interface AppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
  location?: AppointmentLocation;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  paperwork?: QuestionnaireResponse;
}

export type LocationIdToAbbreviationMap = { [stateAbbreviation: string]: string };

export type AppointmentToLocationIdMap = { [locationId: string]: Appointment };

export type EstimatedTimeToLocationIdMap = { [locationId: string]: number };

export type RelatedPersonMaps = {
  rpsToPatientIdMap: Record<string, RelatedPerson[]>;
  commsToRpRefMap: Record<string, Communication[]>;
};
