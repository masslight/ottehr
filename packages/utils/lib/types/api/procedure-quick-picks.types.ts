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

export interface GetProcedureQuickPicksResponse {
  message: string;
  quickPicks: ProcedureQuickPickData[];
}
