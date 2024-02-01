import { AvailableLocationInformation } from '..';

export interface GetLocationResponse {
  message: string;
  location: AvailableLocationInformation;
  available: string[];
  waitingMinutes: number;
}

export interface GetLocationRequestParams {
  locationSlug?: string;
}
