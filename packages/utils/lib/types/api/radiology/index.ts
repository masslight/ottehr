import { Pagination } from '../../data/pagination.types';

export interface CreateRadiologyZambdaOrderInput {
  encounterId: string;
  diagnosisCode: string;
  cptCode: string;
  stat: boolean;
}

export interface CreateRadiologyZambdaOrderOutput {
  serviceRequestId: string;
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
  result?: string;
  history?: RadiologyOrderHistoryRow[];
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
