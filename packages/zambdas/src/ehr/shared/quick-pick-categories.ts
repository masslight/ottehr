import {
  AllergyQuickPickData,
  ImmunizationQuickPickData,
  InHouseMedicationQuickPickData,
  MedicalConditionQuickPickData,
  MedicationHistoryQuickPickData,
  ProcedureQuickPickData,
} from 'utils';
import { QuickPickCategory } from './quick-pick-helpers';

export const PROCEDURE_QUICK_PICK_CATEGORY: QuickPickCategory<ProcedureQuickPickData> = {
  tagCode: 'procedure-quick-pick',
  displayNameKey: 'name',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<ProcedureQuickPickData, 'id' | 'name'>),
  }),
};

export const ALLERGY_QUICK_PICK_CATEGORY: QuickPickCategory<AllergyQuickPickData> = {
  tagCode: 'allergy-quick-pick',
  displayNameKey: 'name',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<AllergyQuickPickData, 'id' | 'name'>),
  }),
};

export const MEDICAL_CONDITION_QUICK_PICK_CATEGORY: QuickPickCategory<MedicalConditionQuickPickData> = {
  tagCode: 'medical-condition-quick-pick',
  displayNameKey: 'display',
  getDisplayName: (data) => data.display,
  fromParsed: (id, title, config) => ({
    id,
    display: title,
    ...(config as Omit<MedicalConditionQuickPickData, 'id' | 'display'>),
  }),
};

export const MEDICATION_HISTORY_QUICK_PICK_CATEGORY: QuickPickCategory<MedicationHistoryQuickPickData> = {
  tagCode: 'medication-history-quick-pick',
  displayNameKey: 'name',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<MedicationHistoryQuickPickData, 'id' | 'name'>),
  }),
};

export const IMMUNIZATION_QUICK_PICK_CATEGORY: QuickPickCategory<ImmunizationQuickPickData> = {
  tagCode: 'immunization-quick-pick',
  displayNameKey: 'name',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<ImmunizationQuickPickData, 'id' | 'name'>),
  }),
};

export const IN_HOUSE_MEDICATION_QUICK_PICK_CATEGORY: QuickPickCategory<InHouseMedicationQuickPickData> = {
  tagCode: 'in-house-medication-quick-pick',
  displayNameKey: 'name',
  getDisplayName: (data) => data.name,
  fromParsed: (id, title, config) => ({
    id,
    name: title,
    ...(config as Omit<InHouseMedicationQuickPickData, 'id' | 'name'>),
  }),
};
