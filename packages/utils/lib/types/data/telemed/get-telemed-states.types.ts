import { Schedule } from 'fhir/r4b';

export interface TelemedLocation {
  state: string;
  available: boolean;
  schedule: Schedule;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
