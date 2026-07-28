import { ProcedurePageState, ProcedureQuickPickData } from 'utils';
import { detectProcedureFamily } from 'utils';
import {
  clearUnusedStructuredFields,
  procedureInputFieldVisibility,
} from '../components/procedures/procedureFieldVisibility';
import { mergeOtherFromQuickPick } from './procedureOtherFields';

const QUICK_PICK_APPLY_KEYS = [
  'cptCodes',
  'medicationUsed',
  'bodySite',
  'otherBodySite',
  'bodySide',
  'technique',
  'suppliesUsed',
  'otherSuppliesUsed',
  'procedureDetails',
  'lengthCm',
  'repairDepth',
  'infusionStartTime',
  'infusionStopTime',
  'specimenSent',
  'complications',
  'otherComplications',
  'patientResponse',
  'postInstructions',
  'otherPostInstructions',
  'timeSpent',
  'documentedBy',
] as const satisfies readonly (keyof ProcedureQuickPickData)[];

type QuickPickApplyKey = (typeof QUICK_PICK_APPLY_KEYS)[number];
type ProcedureQuickPickTarget = Pick<ProcedurePageState, QuickPickApplyKey>;

function mergeCptCodes(
  existingCodes: ProcedureQuickPickData['cptCodes'],
  incomingCodes: ProcedureQuickPickData['cptCodes']
): ProcedureQuickPickData['cptCodes'] {
  if (!existingCodes?.length) return incomingCodes;
  if (!incomingCodes?.length) return existingCodes;

  const mergedCodes = [...existingCodes];
  incomingCodes.forEach((incomingCode) => {
    const existingIndex = mergedCodes.findIndex((existingCode) => existingCode.code === incomingCode.code);

    if (existingIndex === -1) {
      mergedCodes.push(incomingCode);
    } else if (incomingCode.billableUnits != null) {
      mergedCodes[existingIndex] = {
        ...mergedCodes[existingIndex],
        billableUnits: incomingCode.billableUnits,
      };
    }
  });
  return mergedCodes;
}

export function applyProcedureQuickPick(
  target: ProcedureQuickPickTarget,
  quickPick: ProcedureQuickPickData,
  procedureType: string | undefined
): void {
  QUICK_PICK_APPLY_KEYS.forEach((key) => {
    if (key === 'cptCodes') {
      target.cptCodes = mergeCptCodes(target.cptCodes, quickPick.cptCodes);
      return;
    }
    if (key === 'suppliesUsed') {
      target.suppliesUsed = mergeOtherFromQuickPick(quickPick.suppliesUsed, quickPick.otherSuppliesUsed);
      return;
    }
    if (key === 'postInstructions') {
      target.postInstructions = mergeOtherFromQuickPick(quickPick.postInstructions, quickPick.otherPostInstructions);
      return;
    }
    (target as Record<QuickPickApplyKey, unknown>)[key] = quickPick[key];
  });

  clearUnusedStructuredFields(
    target,
    procedureInputFieldVisibility(detectProcedureFamily({ procedureType, cptCodes: target.cptCodes }), {
      procedureType,
      cptCodes: target.cptCodes,
    })
  );
}
