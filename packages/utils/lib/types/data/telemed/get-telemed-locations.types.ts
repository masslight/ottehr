import { Schedule } from 'fhir/r4b';
import { AvailableLocationInformation } from '../../common';

export interface TelemedLocation {
  state: string;
  available: boolean;
  schedule: Schedule;
  locationInformation: AvailableLocationInformation;
}

export interface GetTelemedLocationsResponse {
  locations: TelemedLocation[];
}
