import { Appointment, Encounter, Location, Practitioner, QuestionnaireResponse } from 'fhir/r4b';
import { AppointmentLocation, TelemedCallStatuses, TelemedStatusHistoryElement } from 'utils';

export interface AppointmentPackage {
  appointment: Appointment;
  encounter: Encounter;
  locationVirtual: AppointmentLocation;
  telemedStatus: TelemedCallStatuses;
  telemedStatusHistory: TelemedStatusHistoryElement[];
  paperwork?: QuestionnaireResponse;
  practitioner?: Practitioner;
}

export type LocationIdToStateAbbreviationMap = { [stateAbbreviation: string]: Location[] };
