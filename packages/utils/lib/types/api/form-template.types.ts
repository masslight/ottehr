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
  /**
   * Whether the PDF has fillable fields. False means it can still be shared and printed, just never
   * prefilled. Unknown for templates uploaded before analysis existed, which read as false.
   */
  fillable: boolean;
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

/** AcroForm field types, narrowed to the ones a template can meaningfully expose. */
export type FormFieldType = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'optionList' | 'signature' | 'button';

export interface FormFieldOption {
  /**
   * The value written into the PDF when this option is chosen — the field's own export value, which is
   * whatever key its appearance dictionary uses (`Yes`, `On`, `1`, …). Only `Off` is universal. Writing a
   * plausible-looking value the field does not recognise produces a silently blank field.
   */
  exportValue: string;
  /** Human-facing label where the PDF supplies one; falls back to the export value. */
  label: string;
}

export interface FormFieldInfo {
  /** Fully-qualified field name — the parent chain joined by dots. */
  name: string;
  /** The field's `/TU` alternate text, where the author supplied one. Usually far more readable than `name`. */
  alternateText?: string;
  type: FormFieldType;
  options?: FormFieldOption[];
  maxLength?: number;
  /** Pages the field appears on. A field can own several widgets, so this is not always a single page. */
  pages: number[];
  /**
   * Where the field's first widget sits, in PDF user space (origin at the bottom-left, so a larger `y`
   * is higher up the page), together with its size.
   *
   * Drives two things. It orders fields as they appear on the printed page rather than as the PDF
   * happens to store them, which lets someone work down a long form with the page beside them. And it
   * gives the mapping UI the rectangle to highlight, which is how a field is actually identified — a
   * label alone cannot distinguish the patient's "First Name:" from the prescriber's.
   */
  position?: { page: number; x: number; y: number; width: number; height: number };
  readOnly: boolean;
  /** False for fields we can never populate — signatures and pushbuttons. */
  mappable: boolean;
}

/**
 * Outcome of inspecting an uploaded PDF.
 *
 * `fillable` is the only status that supports mapping. `printable` still yields a usable template — a form
 * with no fields is a perfectly good handout — it just cannot be prefilled.
 */
export type FormTemplateAnalysisStatus = 'fillable' | 'printable' | 'encrypted' | 'dynamicXfa' | 'unreadable';

export interface FormTemplateAnalysis {
  status: FormTemplateAnalysisStatus;
  fields: FormFieldInfo[];
}

export interface AnalyzeFormTemplateInput {
  documentReferenceId: string;
}

export interface AnalyzeFormTemplateOutput extends FormTemplateAnalysis {
  documentReferenceId: string;
}

export interface GetFormTemplateDetailInput {
  documentReferenceId: string;
}

/**
 * Everything the mapping screen needs in one call: the template, its field inventory, and the bindings
 * authored so far. The list endpoint deliberately leaves the inventory and mapping behind, so this is
 * where they are fetched.
 */
export interface GetFormTemplateDetailOutput {
  item: FormTemplateItem;
  status: FormTemplateAnalysisStatus;
  fields: FormFieldInfo[];
  /** `FormTemplateMapping` — typed at the call site to keep this module free of mapping imports. */
  mapping: unknown;
}

export interface SaveFormTemplateMappingInput {
  documentReferenceId: string;
  /** `FormTemplateMapping`. Replaces the stored mapping wholesale. */
  mapping: unknown;
}

export interface SaveFormTemplateMappingOutput {
  documentReferenceId: string;
}
