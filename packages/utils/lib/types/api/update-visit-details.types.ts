export interface BookingDetails {
  reasonForVisit?: string;
  additionalDetails?: string;
  authorizedNonLegalGuardians?: string;
  confirmedDob?: string;
  patientName?: {
    first?: string;
    middle?: string;
    last?: string;
    suffix?: string;
  };
  consentForms?: {
    consentAttested: boolean;
  };
}

export interface UpdateVisitDetailsInput {
  appointmentId: string;
  bookingDetails: BookingDetails;
}
