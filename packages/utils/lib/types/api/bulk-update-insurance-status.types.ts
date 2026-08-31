export interface BulkUpdateInsuranceStatusInput {
  insuranceIds: string[];
  active: boolean;
}

export interface BulkUpdateInsuranceStatusResponse {
  message: string;
  updatedCount: number;
}
