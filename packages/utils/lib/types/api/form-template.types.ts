/**
 * Admin-authored fillable PDF form templates.
 *
 * A template is an org-level (subject-less) `DocumentReference` whose PDF lives in the non-patient
 * `FORM_TEMPLATES` Z3 bucket. Set membership is carried on `category` (0..*) rather than `type` (0..1),
 * which leaves the single `type` slot free for the document's actual kind.
 */

import { DocumentVerificationStatus } from './document-provenance.types';

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
  /**
   * Set when replacing an existing template's PDF rather than creating a new template.
   *
   * The returned URL is a *candidate*: nothing about the template changes until the upload has been
   * fetched and analysed successfully, so a failed replacement leaves the working template alone.
   */
  documentReferenceId?: string;
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

/** What a prefill run managed to place, so the provider is told rather than left to notice. */
export interface FormFillReport {
  /** Fields written from the mapping. */
  filledCount: number;
  /** Bindings that produced nothing, with the reason. */
  skipped: { fieldName: string; tokenKey: string; reason: string }[];
}

export interface FillFormTemplateInput {
  /** The template to fill. */
  documentReferenceId: string;
  /** The visit supplying the context. */
  appointmentId: string;
}

export interface FillFormTemplateOutput {
  /** The DocumentReference created for the filled copy. */
  documentReferenceId: string;
  /** Short-lived URL the chart opens in a new tab. */
  presignedUrl: string;
  /** Download name, distinct per encounter rather than per template. */
  fileName: string;
  report: FormFillReport;
}

/**
 * Importing a template by address instead of by file.
 *
 * A copy is fetched and stored rather than the address being referenced: the publisher of a government
 * form will move, revise, or withdraw it, and a template that resolves differently next year is a
 * template nobody can trust. The address is kept as provenance, not as the source of the bytes.
 */
export interface ImportFormTemplateFromUrlInput {
  title: string;
  description?: string;
  /** Public https address of the PDF. Fetched once, server-side. */
  sourceUrl: string;
}

export interface ImportFormTemplateFromUrlOutput {
  documentReferenceId: string;
  identifier: string;
  /** Where the bytes actually came from, after any redirects. */
  resolvedFrom: string;
}

/** Presign step for returning a completed form. Writes nothing — see `DocumentVerificationResult`. */
export interface CreateCompletedFormUploadUrlInput {
  /** The visit the form belongs to. The patient is resolved from it server-side, never sent by the client. */
  appointmentId: string;
  fileName: string;
}

export interface CreateCompletedFormUploadUrlOutput {
  z3Url: string;
  presignedUploadUrl: string;
}

/** Second step: verify the uploaded bytes, and create the chart record only if they check out. */
export interface SaveCompletedFormInput {
  appointmentId: string;
  z3Url: string;
  /** The template this was completed from, so the finished document can be tied back to it. */
  templateId: string;
}

export interface SaveCompletedFormOutput {
  status: DocumentVerificationStatus;
  /** The record created for the completed form. Absent when verification rejected the upload. */
  documentReferenceId?: string;
  /** Present on a mismatch, so the message can say whose document it actually was. */
  stampedPatientId?: string;
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
export type FormTemplateAnalysisStatus =
  | 'fillable'
  | 'printable'
  /** Needs a password we do not have. */
  | 'encrypted'
  /** Openable, but its own permissions forbid filling in form fields, so we decline to decrypt it. */
  | 'fillingNotPermitted'
  | 'dynamicXfa'
  | 'unreadable';

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

export interface ReplaceFormTemplatePdfInput {
  documentReferenceId: string;
  /** Candidate object already uploaded via a URL minted with `documentReferenceId` set. */
  z3Url: string;
}

export interface ReplaceFormTemplatePdfOutput {
  documentReferenceId: string;
  status: FormTemplateAnalysisStatus;
  fields: FormFieldInfo[];
  /**
   * Fields the old mapping referred to that the new PDF does not contain. Their bindings are removed:
   * a binding naming a field that no longer exists does nothing at fill time and would be written back
   * on the next save, so it is a lie that is hard to notice.
   */
  droppedBindings: string[];
  /** True when dropped bindings forced the template back to draft for review. */
  returnedToDraft: boolean;
}
