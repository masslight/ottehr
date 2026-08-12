/** Recipients a single request may carry; the "Add Recipient" form stops here. */
export const FAX_MAX_RECIPIENTS = 10;

/**
 * Faxes a single request may send (selected visits × recipients). Each one is a document assembly, a
 * Z3 upload and a provider call, so the request has to stay well inside the zambda's timeout.
 */
export const FAX_MAX_TRANSMISSIONS = 20;

/** A single fax destination, captured from the "Recipient Information" form. */
export interface FaxRecipient {
  faxNumber: string;
  name?: string;
  organization?: string;
  /** Follow-up voice number; printed on the cover page only. */
  phoneNumber?: string;
}

/**
 * What to fax. Each variant maps to one entry point in the EHR:
 * - `visit-note`: the signed visit note, from the Review & Sign page.
 * - `visit-documents`: every document of the selected visits, from "Fax Patient Docs".
 * - `medical-record`: the patient's whole record, from the Medical Record menu.
 * - `document`: one document, from the patient Docs table.
 */
export type SendFaxTarget =
  | { type: 'visit-note'; appointmentId: string }
  | { type: 'visit-documents'; patientId: string; appointmentIds: string[] }
  | { type: 'medical-record'; patientId: string }
  | { type: 'document'; patientId: string; documentReferenceId: string };

export interface SendFaxZambdaInput {
  target: SendFaxTarget;
  recipients: FaxRecipient[];
}

export interface SendFaxZambdaOutput {
  /** Ids of the outbound delivery attempts that reached the fax provider. */
  attemptIds: string[];
  /** How many faxes of the requested set failed; each failure is recorded as a failed attempt. */
  failureCount: number;
}
