export interface CreateInHouseMedicationInput {
  name: string;
  ndc?: string;
  medispanID: string;
  medispanIDForInteractions?: string;
  cptCodes?: { code: string; display: string }[];
  hcpcsCodes?: { code: string; display: string }[];
}

export type UpdateInHouseMedicationInput = Partial<CreateInHouseMedicationInput> & {
  medicationID: string;
  status?: string;
};
