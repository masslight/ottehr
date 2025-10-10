export const INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME = 'invoiceable-patients-reports';
export const INVOICEABLE_PATIENTS_REPORTS_FILE_NAME = `invoiceable-patients-report.json`;

export interface InvoiceablePatient {
  id: string;
  name: string;
  dob: string;
  serviceDate: string; // of what?
  responsiblePartyName: string;
  responsiblePartyRelationshipToPatient: string;
  amountInvoiceable: string;
}

export interface InvoiceablePatientsReport {
  date: string;
  claimsFound: string;
  patients: InvoiceablePatient[];
}
