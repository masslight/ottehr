export interface CreateRadiologyZambdaOrderInput {
  encounterId: string;
  diagnosisCode: string;
  cptCode: string;
  stat: boolean;
}

export interface CreateRadiologyZambdaOrderOutput {
  serviceRequestId: string;
}
