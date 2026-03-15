// ── Generic CRUD types for all quick pick categories ──

export interface QuickPickCreateInput<T> {
  quickPick: Omit<T, 'id'>;
}

export interface QuickPickCreateResponse<T> {
  message: string;
  quickPick: T;
}

export interface QuickPickUpdateInput<T> {
  quickPickId: string;
  quickPick: Omit<T, 'id'>;
}

export interface QuickPickUpdateResponse<T> {
  message: string;
  quickPick: T;
}

export interface QuickPickListResponse<T> {
  message: string;
  quickPicks: T[];
}

export interface QuickPickRemoveInput {
  quickPickId: string;
}

export interface QuickPickRemoveResponse {
  message: string;
}

// ── Procedure Quick Picks ──

export interface ProcedureQuickPickCptCode {
  code: string;
  display: string;
}

export interface ProcedureQuickPickData {
  id?: string;
  name: string;
  consentObtained?: boolean;
  procedureType?: string;
  cptCodes?: ProcedureQuickPickCptCode[];
  diagnoses?: ProcedureQuickPickCptCode[];
  performerType?: string;
  medicationUsed?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string;
  suppliesUsed?: (string | undefined)[];
  otherSuppliesUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string[];
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}

export type CreateProcedureQuickPickInput = QuickPickCreateInput<ProcedureQuickPickData>;
export type CreateProcedureQuickPickResponse = QuickPickCreateResponse<ProcedureQuickPickData>;
export type UpdateProcedureQuickPickInput = QuickPickUpdateInput<ProcedureQuickPickData>;
export type UpdateProcedureQuickPickResponse = QuickPickUpdateResponse<ProcedureQuickPickData>;
export type GetProcedureQuickPicksResponse = QuickPickListResponse<ProcedureQuickPickData>;
export type RemoveProcedureQuickPickInput = QuickPickRemoveInput;
export type RemoveProcedureQuickPickResponse = QuickPickRemoveResponse;

// ── Allergy Quick Picks ──

export interface AllergyQuickPickData {
  id?: string;
  name: string;
  allergyId?: number;
}

export type CreateAllergyQuickPickInput = QuickPickCreateInput<AllergyQuickPickData>;
export type CreateAllergyQuickPickResponse = QuickPickCreateResponse<AllergyQuickPickData>;
export type UpdateAllergyQuickPickInput = QuickPickUpdateInput<AllergyQuickPickData>;
export type UpdateAllergyQuickPickResponse = QuickPickUpdateResponse<AllergyQuickPickData>;
export type GetAllergyQuickPicksResponse = QuickPickListResponse<AllergyQuickPickData>;
export type RemoveAllergyQuickPickInput = QuickPickRemoveInput;
export type RemoveAllergyQuickPickResponse = QuickPickRemoveResponse;

// ── Medical Condition Quick Picks ──

export interface MedicalConditionQuickPickData {
  id?: string;
  display: string;
  code?: string;
}

export type CreateMedicalConditionQuickPickInput = QuickPickCreateInput<MedicalConditionQuickPickData>;
export type CreateMedicalConditionQuickPickResponse = QuickPickCreateResponse<MedicalConditionQuickPickData>;
export type UpdateMedicalConditionQuickPickInput = QuickPickUpdateInput<MedicalConditionQuickPickData>;
export type UpdateMedicalConditionQuickPickResponse = QuickPickUpdateResponse<MedicalConditionQuickPickData>;
export type GetMedicalConditionQuickPicksResponse = QuickPickListResponse<MedicalConditionQuickPickData>;
export type RemoveMedicalConditionQuickPickInput = QuickPickRemoveInput;
export type RemoveMedicalConditionQuickPickResponse = QuickPickRemoveResponse;

// ── Medication Quick Picks ──

export interface MedicationQuickPickData {
  id?: string;
  name: string;
  strength?: string;
  medicationId?: number;
}

export type CreateMedicationQuickPickInput = QuickPickCreateInput<MedicationQuickPickData>;
export type CreateMedicationQuickPickResponse = QuickPickCreateResponse<MedicationQuickPickData>;
export type UpdateMedicationQuickPickInput = QuickPickUpdateInput<MedicationQuickPickData>;
export type UpdateMedicationQuickPickResponse = QuickPickUpdateResponse<MedicationQuickPickData>;
export type GetMedicationQuickPicksResponse = QuickPickListResponse<MedicationQuickPickData>;
export type RemoveMedicationQuickPickInput = QuickPickRemoveInput;
export type RemoveMedicationQuickPickResponse = QuickPickRemoveResponse;
