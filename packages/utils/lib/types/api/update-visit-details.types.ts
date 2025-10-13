export interface BookingDetails {
  reasonForVisit?: string;
  authorizedNonLegalGuardians?: string;
  confirmedDob?: string;
  patientName?: {
    first?: string;
    middle?: string;
    last?: string;
    suffix?: string;
  };
}

export interface UpdateVisitDetailsInput {
  appointmentId: string;
  bookingDetails: BookingDetails;
}
