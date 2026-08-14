export interface FaxRecipientFormValue {
  name: string;
  organization: string;
  faxNumber: string;
  phoneNumber: string;
  saveAsPcp: boolean;
}

export interface FaxFormValues {
  recipients: FaxRecipientFormValue[];
}
