import { CPTCodeDTO, DiagnosisDTO, ProcedureDTO } from './chart-data';

export interface ProcedureDetail extends ProcedureDTO {
  info?: string;
}

export interface ProcedureSuggestion {
  code: string;
  description: string;
  useWhen: string;
}

// UI-layer state shape for the create/edit procedure form.
export interface ProcedurePageState {
  procedureType?: string;
  consentObtained?: boolean;
  cptCodes?: CPTCodeDTO[];
  diagnoses?: DiagnosisDTO[];
  procedureDate?: string;
  procedureTime?: string;
  performerType?: string;
  medicationUsed?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string[];
  suppliesUsed?: string[];
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
