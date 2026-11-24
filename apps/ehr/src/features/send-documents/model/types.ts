export type DeliveryChannel = 'fax' | 'email';

export interface RecipientFormValue {
  name: string;
  credential: string;
  organization: string;
  /** Which of `faxNumber` / `email` is in use; the other is kept blank. */
  channel: DeliveryChannel;
  faxNumber: string;
  email: string;
  phoneNumber: string;
  saveAsPcp: boolean;
}

export interface SendDocumentsFormValues {
  recipients: RecipientFormValue[];
  /** Only set when the dialog offered a choice of visits; otherwise the source stands as requested. */
  selectedAppointmentIds?: string[];
}

/** A visit the user can pick documents from; the picker only appears when there is a choice. */
export interface PacketVisitOption {
  appointmentId: string;
  label: string;
}
