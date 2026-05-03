export interface MailedStatementsReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface MailedStatementItem {
  communicationId: string;
  patientId: string;
  patientName: string;
  encounterId: string;
  recipientName: string;
  sentDate: string;
  appointmentDate: string;
  appointmentId: string;
  vendorLetterId: string;
  vendorLetterStatus: string;
  vendorSendDate: string;
  vendorLetterUrl: string;
  vendorMailingClass: string;
  vendorPageCount: string;
  vendorEnvelopeType: string;
  vendorStatusSyncedAt: string;
  description: string;
  htmlContent: string;
}

export interface MailedStatementsReportZambdaOutput {
  message: string;
  statements: MailedStatementItem[];
}

export interface SyncMailedStatementStatusesOutput {
  total: number;
  updated: number;
  alreadyTerminal: number;
  errors: { communicationId: string; error: string }[];
}
