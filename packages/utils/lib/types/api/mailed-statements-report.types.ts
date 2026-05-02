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
  vendorLetterId: string;
  vendorLetterStatus: string;
  vendorSendDate: string;
  vendorLetterUrl: string;
  description: string;
}

export interface MailedStatementsReportZambdaOutput {
  message: string;
  statements: MailedStatementItem[];
}
