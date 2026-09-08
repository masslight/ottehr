import { CPTCodeDTO, DiagnosisDTO } from './chart-data/chart-data.types';

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
  lengthCm?: number;
  repairDepth?: string;
  infusionStartTime?: string;
  infusionStopTime?: string;
  specimenSent?: boolean;
  complications?: string;
  otherComplications?: string;
  patientResponse?: string;
  postInstructions?: string[];
  otherPostInstructions?: string;
  timeSpent?: string;
  documentedBy?: string;
}
