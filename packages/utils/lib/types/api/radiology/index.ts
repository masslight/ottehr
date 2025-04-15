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

export interface GetRadiologyOrderListZambdaInput {
  encounterId?: string;
  patientId?: string;
  pageIndex: number;
  itemsPerPage: number;
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
  studyType: string;
  visitDateTime: string;
  orderAddedDateTime: string;
  providerName: string;
  diagnosis: string;
  status: RadiologyOrderStatus;
}
export interface GetRadiologyOrderListZambdaOutput {
  orders: GetRadiologyOrderListZambdaOrder[];
  pagination: Pagination;
}
