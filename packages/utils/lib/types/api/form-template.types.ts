/**
 * Admin-authored fillable PDF form templates.
 *
 * A template is an org-level (subject-less) `DocumentReference` whose PDF lives in the non-patient
 * `FORM_TEMPLATES` Z3 bucket. Set membership is carried on `category` (0..*) rather than `type` (0..1),
 * which leaves the single `type` slot free for the document's actual kind.
 */

/** One form template as the admin page and the chart both see it. */
export interface FormTemplateItem {
  documentReferenceId: string;
  /** Stable business key; survives the template's PDF being replaced. */
  identifier: string;
  title: string;
  description?: string;
  /** `docStatus: final` vs `preliminary`. Only published templates reach the patient chart. */
  published: boolean;
  /** Short-lived download URL for the template PDF. */
  pdfPresignedUrl: string;
  lastUpdated?: string;
}

export interface ListFormTemplatesInput {
  /**
   * Admin surfaces pass `true` to see drafts alongside published templates. The patient chart omits it,
   * which is what keeps unpublished templates out of the chart. `docStatus` is not a FHIR search
   * parameter, so the filter is applied in memory after the search rather than pushed into the query.
   */
  includeUnpublished?: boolean;
}

export interface ListFormTemplatesOutput {
  items: FormTemplateItem[];
}

export interface CreateFormTemplateUploadUrlInput {
  title: string;
  description?: string;
  /** Used for the stored object key; sanitized server-side. */
  fileName: string;
}

export interface CreateFormTemplateUploadUrlOutput {
  documentReferenceId: string;
  identifier: string;
  z3Url: string;
  /** The client PUTs the PDF here directly; the zambda never carries the file body. */
  presignedUploadUrl: string;
}

export interface UpdateFormTemplateInput {
  documentReferenceId: string;
  title?: string;
  description?: string;
  /** Publish (`true`) or return to draft (`false`). Omit to leave the current state alone. */
  published?: boolean;
}

export interface UpdateFormTemplateOutput {
  documentReferenceId: string;
}

export interface DeleteFormTemplateInput {
  documentReferenceId: string;
  /**
   * Soft delete (`status: superseded`) is the default. `true` also removes the stored PDF and is
   * irreversible, so callers are expected to confirm explicitly.
   */
  permanent?: boolean;
}

export interface DeleteFormTemplateOutput {
  success: true;
}
