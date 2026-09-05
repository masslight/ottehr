// Result and dispatch shapes for the declarative procedure-coding engine.
// The engine assembly step (evaluator + tables + bespoke family cores)
// implements CodingDispatch against these types; UI/zambda callers depend on
// nothing beyond this contract.

import {
  BurnTreatmentFacts,
  CerumenFacts,
  EkgFacts,
  ForeignBodyFacts,
  IncisionDrainageFacts,
  InjectionInfusionFacts,
  IvCatheterPlacementFacts,
  LacerationFacts,
  LesionDestructionFacts,
  NailTrephinationFacts,
  NasalPackingFacts,
  NebulizerFacts,
  NursemaidElbowFacts,
  SplintingFacts,
  UrinaryCatheterizationFacts,
} from './facts.types';

export const PROCEDURE_CODING_FAMILY_IDS = [
  'laceration',
  'cerumen',
  'incision-drainage',
  'splinting',
  'foreign-body',
  'nasal-packing',
  'burn-treatment',
  'ekg',
  'urinary-catheterization',
  'lesion-destruction',
  'injection-infusion',
  'nail-trephination',
  'nursemaid-elbow',
  'iv-catheter-placement',
  'nebulizer',
] as const;

export type ProcedureCodingFamilyId = (typeof PROCEDURE_CODING_FAMILY_IDS)[number];

export interface ProcedureFamilyFactsMap {
  laceration: LacerationFacts;
  cerumen: CerumenFacts;
  'incision-drainage': IncisionDrainageFacts;
  splinting: SplintingFacts;
  'foreign-body': ForeignBodyFacts;
  'nasal-packing': NasalPackingFacts;
  'burn-treatment': BurnTreatmentFacts;
  ekg: EkgFacts;
  'urinary-catheterization': UrinaryCatheterizationFacts;
  'lesion-destruction': LesionDestructionFacts;
  'injection-infusion': InjectionInfusionFacts;
  'nail-trephination': NailTrephinationFacts;
  'nursemaid-elbow': NursemaidElbowFacts;
  'iv-catheter-placement': IvCatheterPlacementFacts;
  nebulizer: NebulizerFacts;
}

/**
 * The persisted per-procedure structured-facts payload: the family's facts
 * stamped with a `family` discriminant so display surfaces (review tab, PDF,
 * quick-pick/template detail) can render it without re-resolving the procedure
 * type. This is what ProcedureDTO.structuredFacts / quick-pick / template
 * prefills carry.
 */
export type StructuredProcedureFacts = {
  [F in ProcedureCodingFamilyId]: { family: F } & ProcedureFamilyFactsMap[F];
}[ProcedureCodingFamilyId];

/** One suggested claim line. */
export interface SuggestedClaimLine {
  code: string;
  units: number;
  modifiers: string[];
}

export interface SuggestResult {
  /** Empty array = no procedure code determined (blocked, out of family, or E/M-only pathway — see flags). */
  codes: SuggestedClaimLine[];
  /** Human-verified documentation checklist for the emitted codes. */
  requiredDocumentation: string[];
  /** Free-text payer constraints to surface to the coder; never evaluated. */
  payerNotes: string[];
  /** True when the output is not authoritative and needs human review (e.g. 'other' site). */
  review?: boolean;
  /** Blocking/advisory strings the caller must surface ('blocked:*', 'advisory:*', 'em_only:*', 'out_of_family:*', 'missing:*'). */
  flags: string[];
}

export type DefendCodeStatus = 'supported' | 'not-supported' | 'not-assessed';

export interface DefendCodeFinding {
  code: string;
  status: DefendCodeStatus;
  /** Human-readable reasons: missing documentation elements, contradictions, or why the code wasn't assessed. */
  reasons: string[];
}

export interface DefendResult {
  /** One finding per selected code, same order as the input selection. */
  codes: DefendCodeFinding[];
  payerNotes: string[];
  flags: string[];
}

/**
 * Free-text/visit-note context passed alongside the structured facts, used by
 * doc-checklist evaluation and defense findings (never code-determining).
 */
export interface ProcedureDocInput {
  procedureDetails?: string;
  technique?: string[];
  suppliesUsed?: string[];
  medicationUsed?: string;
  bodySite?: string;
  bodySide?: string;
  patientResponse?: string;
  postInstructions?: string[];
  timeSpent?: string;
  performerType?: string;
  documentedBy?: string;
}

export interface CodingDispatch {
  /** Forward evaluation: documented facts → suggested claim lines (or flags explaining why none). */
  suggest<F extends ProcedureCodingFamilyId>(
    family: F,
    facts: ProcedureFamilyFactsMap[F],
    doc: ProcedureDocInput
  ): SuggestResult;
  /** Inverse evaluation: selected codes → per-code supported / not-supported / not-assessed with reasons. */
  defend<F extends ProcedureCodingFamilyId>(
    family: F,
    facts: ProcedureFamilyFactsMap[F],
    doc: ProcedureDocInput,
    selectedCodes: string[]
  ): DefendResult;
}
