export const INVOICEABLE_PATIENTS_REPORTS_BUCKET_NAME = 'invoiceable-patients-reports';
export const INVOICEABLE_PATIENTS_REPORTS_FILE_NAME = `invoiceable-patients-report.json`;

export interface InvoiceablePatientReport {
  id: string;
  name: string;
  dob: string;
  appointmentDate: string;
  finalizationDate: string;
  responsiblePartyName: string;
  responsiblePartyRelationshipToPatient: string;
  amountInvoiceable: string;
  claimId: string;
}

export interface InvoiceablePatientReportFail {
  claimId: string;
  patientId: string;
  candidEncounterId: string;
  error: string;
}

export interface InvoiceablePatientsReport {
  date: string;
  claimsFound: number;
  patientsReports: InvoiceablePatientReport[];
  failedReports: InvoiceablePatientReportFail[];
}
