import {
  AllergyQuickPickData,
  MedicalConditionQuickPickData,
  MedicationQuickPickData,
  ProcedureQuickPickData,
} from 'utils';
import { QuickPickCategory } from './quick-pick-helpers';

export const PROCEDURE_QUICK_PICK_CATEGORY: QuickPickCategory<ProcedureQuickPickData> = {
  tagCode: 'procedure-quick-pick',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<ProcedureQuickPickData, 'id' | 'name'>),
  }),
};

export const ALLERGY_QUICK_PICK_CATEGORY: QuickPickCategory<AllergyQuickPickData> = {
  tagCode: 'allergy-quick-pick',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<AllergyQuickPickData, 'id' | 'name'>),
  }),
};

export const MEDICAL_CONDITION_QUICK_PICK_CATEGORY: QuickPickCategory<MedicalConditionQuickPickData> = {
  tagCode: 'medical-condition-quick-pick',
  getDisplayName: (data) => data.display,
  fromParsed: (id, title, config) => ({
    id,
    display: title,
    ...(config as Omit<MedicalConditionQuickPickData, 'id' | 'display'>),
  }),
};

export const MEDICATION_QUICK_PICK_CATEGORY: QuickPickCategory<MedicationQuickPickData> = {
  tagCode: 'medication-quick-pick',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<MedicationQuickPickData, 'id' | 'name'>),
  }),
};
