import { z } from 'zod';
import { LateralityValue } from '../../../fhir/radiology';
import { isValidUUID } from '../../../validation/helper';
import { Pagination } from '../../data/pagination.types';
import { Task } from '../../data/tasks/types';
import { CPTCodeDTO } from '../chart-data/chart-data.types';

/** Patient-safety flags surfaced on an external radiology order. Form-only — never derived from chart data. */
export const RADIOLOGY_SAFETY_FLAGS = ['implants', 'metal', 'pacemaker', 'pregnancy', 'contrast-allergy'] as const;
export type RadiologySafetyFlag = (typeof RADIOLOGY_SAFETY_FLAGS)[number];
export const RadiologySafetyFlagSchema = z.enum(RADIOLOGY_SAFETY_FLAGS);

/** Display labels for the patient-safety flags (shared by the EHR form/details and the order-form PDF). */
export const RADIOLOGY_SAFETY_FLAG_LABELS: Record<RadiologySafetyFlag, string> = {
  implants: 'Implants',
  metal: 'Metal',
  pacemaker: 'Pacemaker (if MRI)',
  pregnancy: 'Pregnancy',
  'contrast-allergy': 'Contrast allergy',
};

/** Free-text performing/imaging organization captured on an external radiology order. */
export const RadiologyPerformingOrganizationSchema = z.object({
  name: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  fax: z.string().optional(),
});
export type RadiologyPerformingOrganization = z.infer<typeof RadiologyPerformingOrganizationSchema>;

/** The practitioner who performed an in-house study, read back from `ServiceRequest.performer`. */
export interface RadiologyPerformedBy {
  id: string;
  name: string;
}

export const RadiologyLateralityModifierSchema = z.object({
  display: z.string(),
  code: z.string(),
});

export const CreateRadiologyZambdaOrderInputSchema = z.object({
  encounterId: z.string(),
  // Optional at order time: an X-ray can be ordered without a diagnosis. The diagnosis is instead
  // captured when the preliminary read is saved (see SaveRadiologyReportZambdaInputSchema).
  diagnosisCodes: z.array(z.string()).optional(),
  cptCode: z.string(),
  lateralityModifier: RadiologyLateralityModifierSchema.optional(),
  stat: z.boolean(),
  // Optional here; required-for-in-house is enforced in create-order's validate flow.
  clinicalHistory: z.string().max(255, 'Clinical history must be 255 characters or less').optional(),
  studyName: z.string().optional(),
  consentObtained: z.boolean(),
  // External (print-only) order fields — only meaningful when `external` is true.
  external: z.boolean().optional(),
  performingOrganization: RadiologyPerformingOrganizationSchema.optional(),
  timeWindow: z.string().optional(),
  safetyFlags: z.array(RadiologySafetyFlagSchema).optional(),
});
export type CreateRadiologyZambdaOrderInput = z.infer<typeof CreateRadiologyZambdaOrderInputSchema>;

export interface CreateRadiologyZambdaOrderOutput {
  serviceRequestId: string;
  cptCodesSaved: CPTCodeDTO[] | undefined;
}

export const CancelRadiologyOrderZambdaInputSchema = z.object({
  serviceRequestId: z
    .string({ required_error: 'serviceRequestId is required and must be a uuid' })
    .refine((val) => isValidUUID(val), 'serviceRequestId is required and must be a uuid'),
});
export type CancelRadiologyOrderZambdaInput = z.infer<typeof CancelRadiologyOrderZambdaInputSchema>;

export type CancelRadiologyOrderZambdaOutput = Record<string, never>;

export const RadiologyLaunchViewerZambdaInputSchema = z.object({
  serviceRequestId: z
    .string({ required_error: 'serviceRequestId is required and must be a uuid' })
    .refine((val) => isValidUUID(val), 'serviceRequestId is required and must be a uuid'),
});
export type RadiologyLaunchViewerZambdaInput = z.infer<typeof RadiologyLaunchViewerZambdaInputSchema>;

export interface RadiologyLaunchViewerZambdaOutput {
  url: string;
}

// Numeric bounds mirror the previous hand-rolled checks (0 tolerated, fractions allowed).
export const GetRadiologyOrderListZambdaInputSchema = z
  .object({
    encounterIds: z
      .union([
        z.string().refine((val) => isValidUUID(val), '"encounterIds" must be a valid uuid'),
        z
          .array(z.string().refine((val) => isValidUUID(val), 'all strings within "encounterIds" must be valid uuids'))
          .min(1, 'if "encounterIds" is specified then it must have at least one valid uuid'),
      ])
      .optional(),
    patientId: z
      .string()
      .refine((val) => isValidUUID(val), '"patientId" must be a uuid')
      .optional(),
    serviceRequestId: z
      .string()
      .refine((val) => isValidUUID(val), '"serviceRequestId" must be a uuid')
      .optional(),
    pageIndex: z
      .number()
      .refine((v) => !v || v >= 0, 'If "pageIndex" is included then it must be a number greater than or equal to 0')
      .optional(),
    itemsPerPage: z
      .number()
      .refine((v) => !v || v >= 1, 'If "itemsPerPage" is included then it must be a number greater than 0')
      .optional(),
  })
  .refine(
    (b) => [b.patientId, b.encounterIds, b.serviceRequestId].filter((v) => v != null).length === 1,
    'Only one of patientId, encounterIds, serviceRequestId may be sent at a time'
  );
export type GetRadiologyOrderListZambdaInput = z.infer<typeof GetRadiologyOrderListZambdaInputSchema>;

export enum RadiologyOrderStatus {
  pending = 'pending',
  performed = 'performed',
  preliminary = 'preliminary',
  pendingFinal = 'pending final',
  final = 'final',
  reviewed = 'reviewed',
  // External (print-only) orders use a simplified lifecycle: ordered -> reviewed (once results uploaded).
  ordered = 'ordered',
}

export interface RadiologyDTO {
  serviceRequestId: string;
  cptCodeDisplay: string;
  /** base CPT code without any laterality modifier suffix (for edit prefill) */
  cptCode?: string;
  laterality?: LateralityValue;
  studyType: string;
  /** joined display string of all diagnoses, e.g. "A00 — Cholera; B00 — …" */
  diagnosis: string;
  /** structured diagnoses (for edit prefill) */
  diagnoses?: { code: string; display: string }[];
  clinicalHistory?: string;
  preliminaryReport?: string;
  finalReport?: string;
  studyName?: string;
  // External (print-only) order fields — populated only for external orders.
  external?: boolean;
  /** External orders only: true once a result file is uploaded (order `reviewed`); progress note uses this
   * instead of `preliminaryReport`/`finalReport`, which external orders never have. */
  externalResultReviewed?: boolean;
  performingOrganization?: RadiologyPerformingOrganization;
  timeWindow?: string;
  safetyFlags?: RadiologySafetyFlag[];
  performedBy?: RadiologyPerformedBy;
}
export interface GetRadiologyOrderListZambdaOrder extends RadiologyDTO {
  appointmentId: string;
  visitDateTime: string;
  orderAddedDateTime: string;
  /**
   * The visit's attending provider (the requester who placed the order only when the visit has no attender) —
   * orders are frequently placed by a nurse on the provider's behalf, but the provider gets the credit.
   */
  providerName: string;
  /** Practitioner id of the ordering provider (`providerName`); used to populate the "Performed by" options. */
  providerId: string;
  /**
   * Whether the caller may correct each read. Both follow the same rule: the practitioner who wrote the read
   * may correct it, and so may the provider who ordered the study — either qualifies on its own — until the
   * order is signed off. A read with no author of ours (teleradiology's, or one written before authorship was
   * recorded) is nobody's to rewrite.
   *
   * Decided server-side in `canCallerEditReport` and re-checked by `radiology-update-report` on save, so
   * these only tell the UI whether to offer the pencil.
   */
  canEditPreliminaryReport: boolean;
  canEditFinalReport: boolean;
  status: RadiologyOrderStatus;
  isStat: boolean;
  history?: RadiologyOrderHistoryRow[];
  task?: Task;
  consentObtained: boolean;
}

export type RadiologyOrderHistoryRow = {
  status: RadiologyOrderStatus;
  performer?: string;
  date: string;
};

export interface GetRadiologyOrderListZambdaOutput {
  orders: GetRadiologyOrderListZambdaOrder[];
  pagination: Pagination;
}

export const SaveRadiologyReportZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
  report: z.string().min(1, 'report is required and must be a string'),
  // ICD-10 diagnosis codes captured alongside the read. Required when saving a preliminary read
  // (enforced in the save-preliminary-report zambda); ignored by the final-report flow.
  diagnosisCodes: z.array(z.string()).optional(),
});
export type SaveRadiologyReportZambdaInput = z.infer<typeof SaveRadiologyReportZambdaInputSchema>;

/**
 * The preliminary read is where "Performed by" is captured, so it takes the base report payload plus that
 * optional selection. The final-report endpoint keeps the base contract. Only the Practitioner id travels —
 * the zambda resolves the display name, so the performer can't be an arbitrary client-supplied name.
 */
export const SavePreliminaryRadiologyReportZambdaInputSchema = SaveRadiologyReportZambdaInputSchema.extend({
  performedById: z.string().min(1, 'performedById is required and must be a string').optional(),
});
export type SavePreliminaryRadiologyReportZambdaInput = z.infer<typeof SavePreliminaryRadiologyReportZambdaInputSchema>;

export type SaveRadiologyReportZambdaOutput = Record<string, never>;

/** Which of an order's two reads is meant. */
export const RADIOLOGY_REPORT_TYPES = ['preliminary', 'final'] as const;
export type RadiologyReportType = (typeof RADIOLOGY_REPORT_TYPES)[number];

/**
 * Corrects an already-saved read in place: the DiagnosticReport keeps its status and its place in the
 * order's lifecycle, only the text changes. The caller names which read it meant rather than letting the
 * zambda infer it, so an edit typed against the preliminary read can't land on a final read that arrived
 * from teleradiology while the field was open.
 */
export const UpdateRadiologyReportZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
  report: z.string().min(1, 'report is required and must be a string'),
  reportType: z.enum(RADIOLOGY_REPORT_TYPES, {
    errorMap: () => ({ message: "reportType is required and must be 'preliminary' or 'final'" }),
  }),
});
export type UpdateRadiologyReportZambdaInput = z.infer<typeof UpdateRadiologyReportZambdaInputSchema>;

export type UpdateRadiologyReportZambdaOutput = Record<string, never>;

export const SendForFinalReadZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
});
export type SendForFinalReadZambdaInput = z.infer<typeof SendForFinalReadZambdaInputSchema>;

export type SendForFinalReadZambdaOutput = Record<string, never>;

/**
 * Changes to a placed order, one mode per kind of change rather than a bag of optional fields — the modes
 * carry opposite guards (a content rewrite is for external orders only, recording the performer is for
 * in-house orders only), and a union keeps each contract exact instead of letting a missing field decide.
 */
export const UpdateRadiologyOrderZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required'),
  update: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('consent'),
      consentObtained: z.boolean(),
    }),
    z.object({
      type: z.literal('performed-by'),
      /** Only the Practitioner id travels; the zambda resolves the display name. */
      performedById: z.string().min(1, 'performedById is required and must be a string'),
    }),
    z.object({
      type: z.literal('content'),
      /** The order's editable content, rebuilt wholesale. External orders only. */
      order: CreateRadiologyZambdaOrderInputSchema.omit({ encounterId: true }),
    }),
  ]),
});
export type UpdateRadiologyOrderZambdaInput = z.infer<typeof UpdateRadiologyOrderZambdaInputSchema>;

export type UpdateRadiologyOrderZambdaOutput = Record<string, never>;

export const GetRadiologyOrderPdfZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
});
export type GetRadiologyOrderPdfZambdaInput = z.infer<typeof GetRadiologyOrderPdfZambdaInputSchema>;

export interface GetRadiologyOrderPdfZambdaOutput {
  presignedURL: string;
  documentReferenceId: string;
}

export const SendRadiologyOrderFaxZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
  /** 10-digit US fax number (the zambda normalizes to E.164). */
  faxNumber: z.string().min(1, 'faxNumber is required and must be a string'),
});
export type SendRadiologyOrderFaxZambdaInput = z.infer<typeof SendRadiologyOrderFaxZambdaInputSchema>;

export interface SendRadiologyOrderFaxZambdaOutput {
  communicationId: string;
}

export interface RadiologyResultDTO {
  documentReferenceId: string;
  title: string;
  /** presigned download URL */
  url: string;
}

export const ListRadiologyResultsZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
});
export type ListRadiologyResultsZambdaInput = z.infer<typeof ListRadiologyResultsZambdaInputSchema>;

export interface ListRadiologyResultsZambdaOutput {
  results: RadiologyResultDTO[];
}

export const DeleteRadiologyResultZambdaInputSchema = z.object({
  documentReferenceId: z.string().min(1, 'documentReferenceId is required and must be a string'),
});
export type DeleteRadiologyResultZambdaInput = z.infer<typeof DeleteRadiologyResultZambdaInputSchema>;

export type DeleteRadiologyResultZambdaOutput = Record<string, never>;

export const UploadRadiologyResultZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
  /** Z3 URL of the already-uploaded file (browser PUTs the bytes first via a presigned URL). */
  z3URL: z
    .string()
    .min(1, 'z3URL is required and must be a string')
    .refine((url) => url.toLowerCase().endsWith('.pdf'), 'Only PDF files are supported'),
  // nullish: an explicit null is treated as absent (preserves previous behavior).
  title: z.string().nullish(),
});
export type UploadRadiologyResultZambdaInput = z.infer<typeof UploadRadiologyResultZambdaInputSchema>;

export interface UploadRadiologyResultZambdaOutput {
  documentReferenceId: string;
}
