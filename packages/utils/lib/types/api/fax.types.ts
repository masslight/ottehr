import { z } from 'zod';

/**
 * Outbound fax packet contract.
 *
 * A "fax packet" is the single PDF that is actually transmitted: a generated cover sheet followed by the
 * selected visit documents merged together. Oystehr's fax service accepts exactly one document per call,
 * so everything the provider selects has to be merged into one file before sending.
 */

/** Documents that can be selected for a fax packet. Prescriptions and patient instructions are not listed
 * here on purpose: they are sections of the visit/progress note and travel with it. */
export const FaxDocumentKindSchema = z.enum([
  'progress-note',
  'discharge-summary',
  'lab-results',
  'radiology-results',
  'patient-education',
]);
export type FaxDocumentKind = z.infer<typeof FaxDocumentKindSchema>;

/** Merge order inside the packet. */
export const FAX_DOCUMENT_ORDER: FaxDocumentKind[] = [
  'progress-note',
  'discharge-summary',
  'lab-results',
  'radiology-results',
  'patient-education',
];

export const FAX_DOCUMENT_LABELS: Record<FaxDocumentKind, string> = {
  'progress-note': 'Visit/Progress Note',
  'discharge-summary': 'Discharge Summary',
  'lab-results': 'Lab Results',
  'radiology-results': 'Radiology Results',
  'patient-education': 'Patient Education',
};

/**
 * Rows rendered underneath "Visit/Progress Note" in the document selector. They are always checked and always
 * disabled: the content is part of the note itself, so it cannot be selected or deselected independently.
 */
export const FAX_PROGRESS_NOTE_INCLUDED_LABELS = ['Prescriptions', 'Patient Instructions'] as const;
export const FAX_PROGRESS_NOTE_INCLUDED_HINT = 'Included in Visit/Progress Note';

export const FAX_MAX_RECIPIENTS = 5;
export const FAX_PACKET_MAX_PAGES = 100;
export const FAX_PACKET_MAX_BYTES = 20 * 1024 * 1024;

export const HIPAA_FAX_CONFIDENTIALITY_STATEMENT =
  'This fax contains protected health information (PHI) intended solely for the named recipient. If you ' +
  'received this in error, please notify us immediately at the phone number provided and destroy all copies. ' +
  'Unauthorized use, disclosure, or copying is strictly prohibited.';

export const FaxRecipientSchema = z.object({
  name: z.string().trim().min(1).optional(),
  // Practice or facility the recipient belongs to. Maps to the PCP's `practice-name` extension.
  organization: z.string().trim().min(1).optional(),
  faxNumber: z.string().min(1),
  phoneNumber: z.string().optional(),
  // Persist this recipient as the patient's primary care physician. At most one recipient may set it.
  saveAsPcp: z.boolean().optional(),
});

export type FaxRecipient = z.infer<typeof FaxRecipientSchema>;

export const SendFaxPacketInputSchema = z
  .object({
    appointmentId: z.string().uuid(),
    documents: z.array(FaxDocumentKindSchema).min(1),
    recipients: z.array(FaxRecipientSchema).min(1).max(FAX_MAX_RECIPIENTS),
  })
  .refine(
    (value) => value.recipients.filter((recipient) => recipient.saveAsPcp).length <= 1,
    'Only one recipient can be saved as the patient PCP'
  );
export type SendFaxPacketInput = z.infer<typeof SendFaxPacketInputSchema>;

export interface FaxSendResult {
  recipient: FaxRecipient;
  status: 'sent' | 'failed';
  taskId?: string;
  faxPacketDocumentReferenceId?: string;
  error?: string;
}

export interface SendFaxPacketOutput {
  /** Page count of the packet, cover sheet included. Identical for every recipient. */
  pageCount: number;
  results: FaxSendResult[];
  /** Set when the fax went out but persisting the recipient as PCP failed. Non-fatal. */
  pcpSaveError?: string;
}

export const GetFaxPacketPreviewInputSchema = z.object({
  appointmentId: z.string().uuid(),
});

export type GetFaxPacketPreviewInput = z.infer<typeof GetFaxPacketPreviewInputSchema>;

export interface FaxDocumentAvailability {
  kind: FaxDocumentKind;
  available: boolean;
  /** How many source documents back this row, e.g. 3 lab results. */
  count?: number;
  /** Shown as a tooltip on the disabled checkbox. */
  unavailableReason?: string;
}

export interface GetFaxPacketPreviewOutput {
  documents: FaxDocumentAvailability[];
  /** Prefill for the first recipient, taken from the patient's PCP when one is on file. */
  pcp?: FaxRecipient;
  /** Drives the default state of the "Save as patient's PCP" checkbox. */
  hasSavedPcp: boolean;
}

export const FAX_DOCUMENT_UNAVAILABLE_REASONS: Record<FaxDocumentKind, string> = {
  'progress-note': '',
  'discharge-summary': 'No discharge summary for this visit',
  'lab-results': 'No reviewed lab results for this visit',
  'radiology-results': 'No radiology results for this visit',
  'patient-education': 'No patient education documents for this visit',
};

/** Patient education pages are physically merged into the discharge summary PDF when one is generated, so
 * attaching both would duplicate them. */
export const FAX_PATIENT_EDUCATION_IN_DISCHARGE_SUMMARY_REASON = 'Included in Discharge Summary';
