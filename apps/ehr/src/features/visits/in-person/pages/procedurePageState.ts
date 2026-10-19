import { DateTime } from 'luxon';
import { isRepairDepthSelection } from 'utils/lib/procedure-coding/format';
import { ProcedureFactsInput } from 'utils/lib/procedure-coding/model.types';
import { ProcedurePageState } from 'utils/lib/types/api/procedures.types';
import { combineMultipleValuesForSave } from './procedureOtherFields';

export interface LocalProcedurePageState extends Omit<ProcedurePageState, 'procedureDate' | 'procedureTime'> {
  procedureDate?: DateTime | null;
  procedureTime?: DateTime | null;
}

/** Customer config is an open dictionary. Copy only form fields with the matching value type. */
export function applyProcedurePrepopulation(
  state: LocalProcedurePageState,
  defaults: Readonly<Record<string, unknown>>
): void {
  const textFields = [
    'performerType',
    'medicationUsed',
    'bodySite',
    'otherBodySite',
    'bodySide',
    'otherSuppliesUsed',
    'procedureDetails',
    'repairDepth',
    'infusionStartTime',
    'infusionStopTime',
    'complications',
    'otherComplications',
    'patientResponse',
    'otherPostInstructions',
    'timeSpent',
    'documentedBy',
  ] as const;
  for (const field of textFields) {
    const value = defaults[field];
    if (typeof value === 'string' && (state[field] == null || state[field] === '')) state[field] = value;
  }
  for (const field of ['consentObtained', 'specimenSent'] as const) {
    const value = defaults[field];
    if (typeof value === 'boolean' && state[field] == null) state[field] = value;
  }
  for (const field of ['technique', 'suppliesUsed', 'postInstructions'] as const) {
    const value = defaults[field];
    if (Array.isArray(value) && value.every((item): item is string => typeof item === 'string') && state[field] == null)
      state[field] = value;
  }
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
    structuredFacts: draft.structuredFacts,
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
    structuredFacts: pageState.structuredFacts,
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
