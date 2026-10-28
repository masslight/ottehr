import { detectProcedureFamily } from 'utils/lib/procedure-coding/evaluate';
import { StructuredFacts } from 'utils/lib/procedure-coding/structured-fields';
import { ProcedurePageState } from 'utils/lib/types/api/procedures.types';
import { ProcedureQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { mergeOtherFromQuickPick, OTHER, splitOtherForQuickPick } from './procedureOtherFields';

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
  'structuredFacts',
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
  'performerType',
  'documentedBy',
] as const satisfies readonly (keyof ProcedureQuickPickData)[];

type QuickPickApplyKey = (typeof QUICK_PICK_APPLY_KEYS)[number];
type ProcedureQuickPickTarget = Pick<ProcedurePageState, QuickPickApplyKey>;

interface ProcedureTypeOption {
  name: string;
  code: string;
}

const modifierKey = (code: { modifier?: { code: string }[] }): string =>
  (code.modifier ?? [])
    .map((modifier) => modifier.code)
    .sort()
    .join(',');

/** Two billing lines are the same line only when code and modifiers both match. */
export function sameCptLine(
  a: { code: string; modifier?: { code: string }[] },
  b: { code: string; modifier?: { code: string }[] }
): boolean {
  return a.code === b.code && modifierKey(a) === modifierKey(b);
}

export function mergeProcedureCptCodes(
  existingCodes: ProcedureQuickPickData['cptCodes'],
  incomingCodes: ProcedureQuickPickData['cptCodes']
): ProcedureQuickPickData['cptCodes'] {
  if (!existingCodes?.length) return incomingCodes;
  if (!incomingCodes?.length) return existingCodes;

  const mergedCodes = [...existingCodes];

  incomingCodes.forEach((incomingCode) => {
    const existingIndex = mergedCodes.findIndex((existingCode) => sameCptLine(existingCode, incomingCode));

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

/** The answers actually given, without `excluded` keys; an unanswered field never overwrites an answer. */
const answeredFacts = (facts: StructuredFacts, excluded: readonly string[] = []): StructuredFacts =>
  Object.fromEntries(Object.entries(facts).filter(([key, value]) => value !== undefined && !excluded.includes(key)));

export function applyProcedureQuickPick(
  target: ProcedureQuickPickTarget,
  quickPick: ProcedureQuickPickData,
  procedureType: string | undefined
): void {
  const values: ProcedureQuickPickTarget = {
    ...quickPick,
    cptCodes: mergeProcedureCptCodes(target.cptCodes, quickPick.cptCodes),
    // The same rule inside the structured answers: the pick's own fields win, the rest (an EKG's typed
    // numbers or comparison, say) stay. The page clears the answers first when the pick changes the family.
    structuredFacts: quickPick.structuredFacts && {
      ...target.structuredFacts,
      ...answeredFacts(quickPick.structuredFacts),
    },
    suppliesUsed: mergeOtherFromQuickPick(quickPick.suppliesUsed, quickPick.otherSuppliesUsed),
    postInstructions: mergeOtherFromQuickPick(quickPick.postInstructions, quickPick.otherPostInstructions),
  };

  QUICK_PICK_APPLY_KEYS.forEach(<K extends QuickPickApplyKey>(key: K) => {
    // A quick pick prefills the form: keys it does not carry must leave the provider's own
    // answers in place rather than blanking them.
    if (values[key] !== undefined) target[key] = values[key];
  });

  const family = detectProcedureFamily({ procedureType });
  if (family && family.id !== 'laceration') {
    target.lengthCm = undefined;
    target.repairDepth = undefined;
  }
  if (family && family.id !== 'injection-infusion') {
    target.infusionStartTime = undefined;
    target.infusionStopTime = undefined;
  }
}

export function buildProcedureQuickPick(
  source: ProcedureQuickPickTarget,
  name: string,
  procedureType: string | undefined,
  procedureTypes: readonly ProcedureTypeOption[] | undefined
): Omit<ProcedureQuickPickData, 'id'> {
  const supplies = splitOtherForQuickPick(source.suppliesUsed, source.otherSuppliesUsed);
  const postInstructions = splitOtherForQuickPick(source.postInstructions, source.otherPostInstructions);
  const excluded = detectProcedureFamily({ procedureType })?.quickPickExcludes ?? [];
  const structuredFacts = source.structuredFacts && answeredFacts(source.structuredFacts, excluded);

  return {
    name: name.trim(),
    procedureType: procedureTypes?.find((option) => option.name === procedureType)?.code ?? procedureType,
    cptCodes: source.cptCodes?.map((code) => ({
      code: code.code,
      display: code.display,
      billableUnits: code.billableUnits,
      modifier: code.modifier,
    })),
    medicationUsed: source.medicationUsed,
    bodySite: source.bodySite,
    otherBodySite: source.bodySite === OTHER ? source.otherBodySite?.trim() : undefined,
    bodySide: source.bodySide,
    technique: source.technique,
    suppliesUsed: supplies.values,
    otherSuppliesUsed: supplies.other,
    procedureDetails: source.procedureDetails,
    structuredFacts,
    lengthCm: source.lengthCm,
    repairDepth: source.repairDepth,
    infusionStartTime: source.infusionStartTime,
    infusionStopTime: source.infusionStopTime,
    specimenSent: source.specimenSent,
    complications: source.complications,
    otherComplications: source.complications === OTHER ? source.otherComplications?.trim() : undefined,
    patientResponse: source.patientResponse,
    postInstructions: postInstructions.values,
    otherPostInstructions: postInstructions.other,
    timeSpent: source.timeSpent,
    performerType: source.performerType,
    documentedBy: source.documentedBy,
  };
}
