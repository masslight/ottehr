import { Appointment, QuestionnaireResponse } from 'fhir/r4';
import { AppointmentLocation, TelemedCallStatuses, TelemedStatusHistoryElement } from 'ehr-utils';

export interface AppointmentPackage {
  appointment: Appointment;
  location?: AppointmentLocation;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  paperwork?: QuestionnaireResponse;
}

export type LocationIdToAbbreviationMap = { [stateAbbreviation: string]: string };

export type AppointmentToLocationIdMap = { [locationId: string]: Appointment };

export type EstimatedTimeToLocationIdMap = { [locationId: string]: number };
