export { defendCodes, detectProcedureFamily, suggestCode } from './evaluate';

export type {
  AbsenceEvidence,
  CodeCandidate,
  CodeAssessment,
  CodeOutcome,
  CodeOutcomeNotApplicable,
  CodeScope,
  CodeSuggestion,
  CodeSuggestionAddOn,
  CptCodeRef,
  DeterminedCode,
  DeterminedCodeWithAlternates,
  EntryScope,
  EvaluationFamilyMatch,
  EvaluationResult,
  FactProvenance,
  FactValue,
  FamilyEvaluation,
  FieldEvidence,
  Finding,
  FindingEvidence,
  FindingScope,
  MatchedEvaluationFamily,
  NotAssessedCode,
  NotAssessedCodeAssessment,
  NoCodeOutcome,
  OpenCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  ProcedureStructuredFieldInput,
  RepairDepthSelection,
  RequirementLevel,
  SupportedCodeAssessment,
  TextEvidence,
  UnsupportedCodeAssessment,
  UnmatchedEvaluationFamily,
} from './model.types';
export {
  CodeAssessmentKind,
  CodeOutcomeKind,
  CODE_OUTCOME_NOT_APPLICABLE,
  determinedSuggestion,
  ENTRY_SCOPE,
  EvidenceSource,
  EvaluationFamilyMatchKind,
  FindingScopeKind,
  NO_CODE_OUTCOME,
  NOTHING_TO_CITE,
  ProcedureStructuredField,
  codesWithAssessment,
  scopedCode,
  setCodeAssessment,
} from './model.types';

export {
  formatInfusionTimeRange,
  isRepairDepthSelection,
  REPAIR_DEPTH_OPTIONS,
  repairDepthDisplayLabel,
} from './format';

export { isPlausibleLengthCm, MAX_PLAUSIBLE_LENGTH_CM } from './extract';
export { extractInfusionDuration, type InfusionDuration } from './families/injection-infusion';

export {
  clearUnusedStructuredFields,
  procedureFieldVisibility,
  procedureInputFieldVisibility,
  type ProcedureFieldVisibilityInput,
  type ProcedureFieldVisibility,
  type StructuredCodingFields,
} from './fields';

export { CPT_RULES_VINTAGE } from './provenance';
