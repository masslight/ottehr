import { CPTCodeDTO, Pagination, Task } from 'utils';

export interface CreateRadiologyZambdaOrderInput {
  encounterId: string;
  diagnosisCode: string;
  cptCode: string;
  lateralityModifier: { display: string; code: string } | undefined;
  stat: boolean;
  clinicalHistory: string;
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
export interface GetRadiologyOrderListZambdaOrder {
  serviceRequestId: string;
  appointmentId: string;
  studyType: string;
  visitDateTime: string;
  orderAddedDateTime: string;
  providerName: string;
  diagnosis: string;
  status: RadiologyOrderStatus;
  isStat: boolean;
  preliminaryReport?: string;
  finalReport?: string;
  clinicalHistory?: string;
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

export interface SavePreliminaryReportZambdaInput {
  serviceRequestId: string;
  preliminaryReport: string;
}

export type SavePreliminaryReportZambdaOutput = Record<string, never>;

export interface SendForFinalReadZambdaInput {
  serviceRequestId: string;
}

export type SendForFinalReadZambdaOutput = Record<string, never>;
