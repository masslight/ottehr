import { CPTCodeDTO, isValidUUID, LateralityValue, Pagination, Task } from 'utils';
import { z } from 'zod';

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

export const RadiologyLateralityModifierSchema = z.object({
  display: z.string(),
  code: z.string(),
});

export const CreateRadiologyZambdaOrderInputSchema = z.object({
  encounterId: z.string(),
  diagnosisCodes: z.array(z.string()),
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
  performingOrganization?: RadiologyPerformingOrganization;
  timeWindow?: string;
  safetyFlags?: RadiologySafetyFlag[];
}
export interface GetRadiologyOrderListZambdaOrder extends RadiologyDTO {
  appointmentId: string;
  visitDateTime: string;
  orderAddedDateTime: string;
  providerName: string;
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
});
export type SaveRadiologyReportZambdaInput = z.infer<typeof SaveRadiologyReportZambdaInputSchema>;

export type SaveRadiologyReportZambdaOutput = Record<string, never>;

export const SendForFinalReadZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required and must be a string'),
});
export type SendForFinalReadZambdaInput = z.infer<typeof SendForFinalReadZambdaInputSchema>;

export type SendForFinalReadZambdaOutput = Record<string, never>;

export const UpdateRadiologyOrderZambdaInputSchema = z.object({
  serviceRequestId: z.string().min(1, 'serviceRequestId is required'),
  consentObtained: z.boolean(),
  /**
   * When present, the order's editable content is fully rebuilt from this payload (external orders).
   * When absent, only the consentObtained flag is patched (in-house consent toggle).
   */
  edit: CreateRadiologyZambdaOrderInputSchema.omit({ encounterId: true }).optional(),
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
  z3URL: z.string().min(1, 'z3URL is required and must be a string'),
  // nullish: an explicit null is treated as absent (preserves previous behavior).
  title: z.string().nullish(),
});
export type UploadRadiologyResultZambdaInput = z.infer<typeof UploadRadiologyResultZambdaInputSchema>;

export interface UploadRadiologyResultZambdaOutput {
  documentReferenceId: string;
}
