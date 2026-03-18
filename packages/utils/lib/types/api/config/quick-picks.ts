import { ottehrCodeSystemUrl } from '../../../fhir/systemUrls';

export const IN_HOUSE_MEDICATION_QUICK_PICK_SYSTEM = ottehrCodeSystemUrl('quick-pick');
export const IN_HOUSE_MEDICATION_QUICK_PICK_CODE = 'in-house-medication';
export const IN_HOUSE_MEDICATION_QUICK_PICK_SEARCH = `${IN_HOUSE_MEDICATION_QUICK_PICK_SYSTEM}|${IN_HOUSE_MEDICATION_QUICK_PICK_CODE}`;

export interface CreateInHouseMedicationQuickPickInput {
  name: string;
  medicationID: string;
  dose: number;
  units: string;
  route: string;
  instructions?: string;
}

export type UpdateInHouseMedicationQuickPickInput = Partial<CreateInHouseMedicationQuickPickInput> & {
  quickPickID: string;
  status?: string;
};
