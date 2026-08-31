export interface FaxRecipientFormValue {
  name: string;
  organization: string;
  faxNumber: string;
  phoneNumber: string;
  saveAsPcp: boolean;
}

export interface FaxFormValues {
  recipients: FaxRecipientFormValue[];
  /** Only set when the dialog offered a choice of visits; otherwise the source stands as requested. */
  selectedAppointmentIds?: string[];
}

/** A visit the user can pick documents from; the picker only appears when there is a choice. */
export interface FaxVisitOption {
  appointmentId: string;
  label: string;
}
