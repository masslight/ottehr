export interface CreateInHouseMedicationInput {
  name: string;
  ndc: string;
  medispanID: string;
}

export type UpdateInHouseMedicationInput = Partial<CreateInHouseMedicationInput> & {
  medicationID: string;
  status?: string;
};
