import { DateTime } from 'luxon';
import { isRepairDepthSelection, ProcedureFactsInput, ProcedurePageState } from 'utils';
import { combineMultipleValuesForSave } from './procedureOtherFields';

export interface LocalProcedurePageState extends Omit<ProcedurePageState, 'procedureDate' | 'procedureTime'> {
  procedureDate?: DateTime | null;
  procedureTime?: DateTime | null;
}

export function initialProcedurePageState(draft: Partial<ProcedurePageState>): LocalProcedurePageState {
  return {
    procedureDate: draft.procedureDate ? DateTime.fromISO(draft.procedureDate) : DateTime.now(),
    procedureTime: draft.procedureTime ? DateTime.fromISO(draft.procedureTime) : DateTime.now(),
    consentObtained: draft.consentObtained,
    cptCodes: draft.cptCodes,
    diagnoses: draft.diagnoses,
    performerType: draft.performerType,
    medicationUsed: draft.medicationUsed,
    bodySite: draft.bodySite,
    otherBodySite: draft.otherBodySite,
    bodySide: draft.bodySide,
    technique: draft.technique,
    suppliesUsed: draft.suppliesUsed,
    otherSuppliesUsed: draft.otherSuppliesUsed,
    procedureDetails: draft.procedureDetails,
    lengthCm: draft.lengthCm,
    repairDepth: draft.repairDepth,
    infusionStartTime: draft.infusionStartTime,
    infusionStopTime: draft.infusionStopTime,
    specimenSent: draft.specimenSent,
    complications: draft.complications,
    otherComplications: draft.otherComplications,
    patientResponse: draft.patientResponse,
    postInstructions: draft.postInstructions,
    otherPostInstructions: draft.otherPostInstructions,
    timeSpent: draft.timeSpent,
    documentedBy: draft.documentedBy,
  };
}

export function procedurePageStateToDraft(pageState: LocalProcedurePageState): ProcedurePageState {
  return {
    ...pageState,
    procedureDate: pageState.procedureDate?.toISO() || undefined,
    procedureTime: pageState.procedureTime?.toISO() || undefined,
  };
}

export function procedureFactsFromPageState(
  pageState: LocalProcedurePageState,
  procedureType: string | undefined
): ProcedureFactsInput {
  const combinedPostInstructions = combineMultipleValuesForSave(
    pageState.postInstructions,
    pageState.otherPostInstructions
  );
  return {
    procedureType,
    bodySite: pageState.bodySite,
    otherBodySite: pageState.otherBodySite,
    bodySide: pageState.bodySide,
    technique: pageState.technique,
    suppliesUsed: pageState.suppliesUsed,
    otherSuppliesUsed: pageState.otherSuppliesUsed,
    medicationUsed: pageState.medicationUsed,
    procedureDetails: pageState.procedureDetails,
    specimenSent: pageState.specimenSent,
    timeSpent: pageState.timeSpent,
    cptCodes: pageState.cptCodes,
    diagnoses: pageState.diagnoses,
    lengthCm: pageState.lengthCm,
    repairDepth: isRepairDepthSelection(pageState.repairDepth) ? pageState.repairDepth : undefined,
    performerType: pageState.performerType,
    documentedBy: pageState.documentedBy,
    patientResponse: pageState.patientResponse,
    postInstructions: combinedPostInstructions == null ? undefined : [combinedPostInstructions],
    infusionStartTime: pageState.infusionStartTime,
    infusionStopTime: pageState.infusionStopTime,
  };
}
