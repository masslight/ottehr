import { AvailableLocationInformation } from '../../common';

export interface GetAppointmentDetailsResponse {
  appointment: {
    start: string;
    location: AvailableLocationInformation;
    visitType: string;
    status?: string;
  };
  availableSlots: string[];
  displayTomorrowSlotsAtHour: number;
}
