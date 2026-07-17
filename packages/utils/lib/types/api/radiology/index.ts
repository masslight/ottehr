import { CPTCodeDTO, LateralityValue, Pagination, Task } from 'utils';

/** Patient-safety flags surfaced on an external radiology order. Form-only — never derived from chart data. */
export const RADIOLOGY_SAFETY_FLAGS = ['implants', 'metal', 'pacemaker', 'pregnancy', 'contrast-allergy'] as const;
export type RadiologySafetyFlag = (typeof RADIOLOGY_SAFETY_FLAGS)[number];

/** Display labels for the patient-safety flags (shared by the EHR form/details and the order-form PDF). */
export const RADIOLOGY_SAFETY_FLAG_LABELS: Record<RadiologySafetyFlag, string> = {
  implants: 'Implants',
  metal: 'Metal',
  pacemaker: 'Pacemaker (if MRI)',
  pregnancy: 'Pregnancy',
  'contrast-allergy': 'Contrast allergy',
};

/** Free-text performing/imaging organization captured on an external radiology order. */
export interface RadiologyPerformingOrganization {
  name?: string;
  address?: string;
  phone?: string;
  fax?: string;
}

export interface CreateRadiologyZambdaOrderInput {
  encounterId: string;
  diagnosisCodes: string[];
  cptCode: string;
  lateralityModifier: { display: string; code: string } | undefined;
  stat: boolean;
  clinicalHistory: string;
  studyName?: string;
  consentObtained: boolean;
  // External (print-only) order fields — only meaningful when `external` is true.
  external?: boolean;
  performingOrganization?: RadiologyPerformingOrganization;
  timeWindow?: string;
  safetyFlags?: RadiologySafetyFlag[];
}

export interface CreateRadiologyZambdaOrderOutput {
  serviceRequestId: string;
  cptCodesSaved: CPTCodeDTO[] | undefined;
}

export interface CancelRadiologyOrderZambdaInput {
  serviceRequestId: string;
}

export type CancelRadiologyOrderZambdaOutput = Record<string, never>;

export interface RadiologyLaunchViewerZambdaInput {
  serviceRequestId: string;
}

export interface RadiologyLaunchViewerZambdaOutput {
  url: string;
}

export interface GetRadiologyOrderListZambdaInput {
  encounterIds?: string | string[];
  patientId?: string;
  serviceRequestId?: string;
  pageIndex?: number;
  itemsPerPage?: number;
}

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

export interface SaveRadiologyReportZambdaInput {
  serviceRequestId: string;
  report: string;
}

export type SaveRadiologyReportZambdaOutput = Record<string, never>;

export interface SendForFinalReadZambdaInput {
  serviceRequestId: string;
}

export type SendForFinalReadZambdaOutput = Record<string, never>;

export interface UpdateRadiologyOrderZambdaInput {
  serviceRequestId: string;
  consentObtained: boolean;
  /**
   * When present, the order's editable content is fully rebuilt from this payload (external orders).
   * When absent, only the consentObtained flag is patched (in-house consent toggle).
   */
  edit?: Omit<CreateRadiologyZambdaOrderInput, 'encounterId'>;
}

export type UpdateRadiologyOrderZambdaOutput = Record<string, never>;

export interface GetRadiologyOrderPdfZambdaInput {
  serviceRequestId: string;
}

export interface GetRadiologyOrderPdfZambdaOutput {
  presignedURL: string;
  documentReferenceId: string;
}

export interface SendRadiologyOrderFaxZambdaInput {
  serviceRequestId: string;
  /** 10-digit US fax number (the zambda normalizes to E.164). */
  faxNumber: string;
}

export interface SendRadiologyOrderFaxZambdaOutput {
  communicationId: string;
}

export interface RadiologyResultDTO {
  documentReferenceId: string;
  title: string;
  /** presigned download URL */
  url: string;
}

export interface ListRadiologyResultsZambdaInput {
  serviceRequestId: string;
}

export interface ListRadiologyResultsZambdaOutput {
  results: RadiologyResultDTO[];
}

export interface DeleteRadiologyResultZambdaInput {
  documentReferenceId: string;
}

export type DeleteRadiologyResultZambdaOutput = Record<string, never>;

export interface UploadRadiologyResultZambdaInput {
  serviceRequestId: string;
  /** Z3 URL of the already-uploaded file (browser PUTs the bytes first via a presigned URL). */
  z3URL: string;
  title?: string;
}

export interface UploadRadiologyResultZambdaOutput {
  documentReferenceId: string;
}
