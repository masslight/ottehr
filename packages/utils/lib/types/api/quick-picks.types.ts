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

export interface QuickPickListInput {
  category: string;
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
  technique?: string[];
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

// ── Medication History Quick Picks ──

export interface MedicationHistoryQuickPickData {
  id?: string;
  name: string;
  strength?: string;
  medicationId?: number;
}

export type CreateMedicationHistoryQuickPickInput = QuickPickCreateInput<MedicationHistoryQuickPickData>;
export type CreateMedicationHistoryQuickPickResponse = QuickPickCreateResponse<MedicationHistoryQuickPickData>;
export type UpdateMedicationHistoryQuickPickInput = QuickPickUpdateInput<MedicationHistoryQuickPickData>;
export type UpdateMedicationHistoryQuickPickResponse = QuickPickUpdateResponse<MedicationHistoryQuickPickData>;
export type GetMedicationHistoryQuickPicksResponse = QuickPickListResponse<MedicationHistoryQuickPickData>;

// ── Radiology Quick Picks ──

export interface RadiologyQuickPickData {
  id?: string;
  name: string;
  cptCode?: string;
  cptDisplay?: string;
  studyName?: string;
  laterality?: string;
  clinicalHistory?: string;
  stat?: boolean;
  consentObtained?: boolean;
}

export type CreateRadiologyQuickPickInput = QuickPickCreateInput<RadiologyQuickPickData>;
export type CreateRadiologyQuickPickResponse = QuickPickCreateResponse<RadiologyQuickPickData>;
export type UpdateRadiologyQuickPickInput = QuickPickUpdateInput<RadiologyQuickPickData>;
export type UpdateRadiologyQuickPickResponse = QuickPickUpdateResponse<RadiologyQuickPickData>;
export type GetRadiologyQuickPicksResponse = QuickPickListResponse<RadiologyQuickPickData>;

// ── Immunization Quick Picks ──

export interface ImmunizationQuickPickData {
  id?: string;
  name: string;
  vaccine?: { id: string; name: string };
  dose?: string;
  units?: string;
  route?: string;
  location?: { name: string; code: string };
  associatedDx?: string;
  manufacturer?: string;
  instructions?: string;
  cvx?: string;
  mvx?: string;
  cptCodes?: { code: string; display: string }[];
  ndc?: string;
  lot?: string;
  expDate?: string;
}

export type CreateImmunizationQuickPickInput = QuickPickCreateInput<ImmunizationQuickPickData>;
export type CreateImmunizationQuickPickResponse = QuickPickCreateResponse<ImmunizationQuickPickData>;
export type UpdateImmunizationQuickPickInput = QuickPickUpdateInput<ImmunizationQuickPickData>;
export type UpdateImmunizationQuickPickResponse = QuickPickUpdateResponse<ImmunizationQuickPickData>;
export type GetImmunizationQuickPicksResponse = QuickPickListResponse<ImmunizationQuickPickData>;

// ── In-House Medication Quick Picks ──

export interface InHouseMedicationQuickPickData {
  id?: string;
  name: string;
  medicationId?: string;
  medicationName?: string;
  dose?: number;
  units?: string;
  route?: string;
  manufacturer?: string;
  associatedDx?: string;
  instructions?: string;
  lotNumber?: string;
  ndc?: string;
  expDate?: string;
  cptCodes?: { code: string; display: string }[];
}

export type CreateInHouseMedicationQuickPickInput = QuickPickCreateInput<InHouseMedicationQuickPickData>;
export type CreateInHouseMedicationQuickPickResponse = QuickPickCreateResponse<InHouseMedicationQuickPickData>;
export type UpdateInHouseMedicationQuickPickInput = QuickPickUpdateInput<InHouseMedicationQuickPickData>;
export type UpdateInHouseMedicationQuickPickResponse = QuickPickUpdateResponse<InHouseMedicationQuickPickData>;
export type GetInHouseMedicationQuickPicksResponse = QuickPickListResponse<InHouseMedicationQuickPickData>;

// ── Patient Instruction Quick Picks (Practice Quick Picks) ──

export interface PatientInstructionQuickPickData {
  id?: string;
  name: string;
  text: string;
}

export type CreatePatientInstructionQuickPickInput = QuickPickCreateInput<PatientInstructionQuickPickData>;
export type CreatePatientInstructionQuickPickResponse = QuickPickCreateResponse<PatientInstructionQuickPickData>;
export type UpdatePatientInstructionQuickPickInput = QuickPickUpdateInput<PatientInstructionQuickPickData>;
export type UpdatePatientInstructionQuickPickResponse = QuickPickUpdateResponse<PatientInstructionQuickPickData>;
export type GetPatientInstructionQuickPicksResponse = QuickPickListResponse<PatientInstructionQuickPickData>;

// ── Insurance Quick Picks ──

export interface InsuranceQuickPickData {
  id?: string;
  name: string;
  payerId: string;
  organizationReference: string;
}

export type CreateInsuranceQuickPickInput = QuickPickCreateInput<InsuranceQuickPickData>;
export type CreateInsuranceQuickPickResponse = QuickPickCreateResponse<InsuranceQuickPickData>;
export type UpdateInsuranceQuickPickInput = QuickPickUpdateInput<InsuranceQuickPickData>;
export type UpdateInsuranceQuickPickResponse = QuickPickUpdateResponse<InsuranceQuickPickData>;
export type GetInsuranceQuickPicksResponse = QuickPickListResponse<InsuranceQuickPickData>;

// ── Quick Text Quick Picks ──

export interface QuickTextQuickPickData {
  id?: string;
  name: string;
  english: string;
  spanish?: string;
}

export type CreateQuickTextQuickPickInput = QuickPickCreateInput<QuickTextQuickPickData>;
export type CreateQuickTextQuickPickResponse = QuickPickCreateResponse<QuickTextQuickPickData>;
export type UpdateQuickTextQuickPickInput = QuickPickUpdateInput<QuickTextQuickPickData>;
export type UpdateQuickTextQuickPickResponse = QuickPickUpdateResponse<QuickTextQuickPickData>;
export type GetQuickTextQuickPicksResponse = QuickPickListResponse<QuickTextQuickPickData>;
