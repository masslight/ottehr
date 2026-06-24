import { CPTCodeDTO, Pagination, Task } from 'utils';

export interface CreateRadiologyZambdaOrderInput {
  encounterId: string;
  diagnosisCode: string;
  cptCode: string;
  lateralityModifier: { display: string; code: string } | undefined;
  stat: boolean;
  clinicalHistory: string;
  studyName?: string;
  consentObtained: boolean;
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
}

export interface RadiologyDTO {
  serviceRequestId: string;
  cptCodeDisplay: string;
  studyType: string;
  diagnosis: string;
  clinicalHistory?: string;
  preliminaryReport?: string;
  finalReport?: string;
  studyName?: string;
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
