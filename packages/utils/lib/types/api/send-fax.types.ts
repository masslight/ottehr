export const FAX_DOCUMENT_TYPES = [
  'discharge-summary',
  'visit-note',
  'lab-results',
  'radiology-results',
  'prescriptions',
  'patient-instructions',
  'patient-education',
] as const;

export type FaxDocumentType = (typeof FAX_DOCUMENT_TYPES)[number];

export const FAX_DOCUMENT_TYPE_LABELS: Record<FaxDocumentType, string> = {
  'discharge-summary': 'Discharge Summary',
  'visit-note': 'Visit Note',
  'lab-results': 'Lab Results',
  'radiology-results': 'Radiology Results',
  prescriptions: 'Prescriptions',
  'patient-instructions': 'Patient Instructions',
  'patient-education': 'Patient Education',
};

export interface FaxRecipient {
  name?: string;
  organization?: string;
  faxNumber: string;
  phoneNumber?: string;
}

export interface SendFaxZambdaInput {
  appointmentId: string;
  documents: FaxDocumentType[];
  recipients: FaxRecipient[];
  timezone?: string;
}

export interface SendFaxZambdaOutput {
  message: string;
  faxesSent: number;
  /** Fax numbers (E.164) for which sending failed, if any. */
  failedFaxNumbers: string[];
}

export interface GetFaxDocumentsInput {
  appointmentId: string;
}

export interface GetFaxDocumentsOutput {
  availableDocuments: FaxDocumentType[];
}
