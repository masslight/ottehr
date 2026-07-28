export type RequirementLevel = 'determines' | 'required' | 'contradiction' | 'bestPractice';

export enum EvidenceSource {
  Text = 'text',
  Field = 'field',
  Absence = 'absence',
}

export interface TextEvidence {
  source: EvidenceSource.Text;
  sourceText: string;
}

export interface FieldEvidence {
  source: EvidenceSource.Field;
  field: string;
}

export interface AbsenceEvidence {
  source: EvidenceSource.Absence;
}

export type FactProvenance = TextEvidence | FieldEvidence;

export type FindingEvidence = FactProvenance | AbsenceEvidence;

export function textEvidence(sourceText: string): TextEvidence {
  return { source: EvidenceSource.Text, sourceText };
}

export function fieldEvidence(field: string): FieldEvidence {
  return { source: EvidenceSource.Field, field };
}

export const NOTHING_TO_CITE: AbsenceEvidence = { source: EvidenceSource.Absence };

export function citing(fact: { evidence: FactProvenance } | undefined): FindingEvidence {
  return fact === undefined ? NOTHING_TO_CITE : fact.evidence;
}

export type RepairDepthSelection =
  | 'superficial-single'
  | 'subcutaneous-single'
  | 'subcutaneous-layered'
  | 'fascia-muscle-layered'
  | 'tissue-adhesive-only'
  | 'strips-only';

export interface FactValue<T> {
  value: T;
  evidence: FactProvenance;
}

export interface WhereToDocument {
  destination: string;
  example?: string;
}

export function whereToDocumentClause(where: WhereToDocument, verb = 'Add it'): string {
  return `${verb} ${where.destination}${where.example ? `, e.g. ${where.example}` : ''}.`;
}

export function ifPerformedClause(verb: string, action: string, subject = 'one'): string {
  return `If ${subject} was ${verb}, ${action}`;
}

export enum FindingScopeKind {
  Entry = 'entry',
  Code = 'code',
}

export interface EntryScope {
  kind: FindingScopeKind.Entry;
}

export interface CodeScope {
  kind: FindingScopeKind.Code;
  cptCode: string;
}

export type FindingScope = EntryScope | CodeScope;

export const ENTRY_SCOPE: EntryScope = { kind: FindingScopeKind.Entry };

export function codeScope(cptCode: string): CodeScope {
  return { kind: FindingScopeKind.Code, cptCode };
}

export function scopedCode(scope: FindingScope): string | undefined {
  return scope.kind === FindingScopeKind.Code ? scope.cptCode : undefined;
}

export interface Finding {
  level: RequirementLevel;
  message: string;
  scope: FindingScope;
  evidence: FindingEvidence;
  payerNote?: string;
}

export interface CptCodeRef {
  code: string;
  display: string;
}

export interface CodeCandidate {
  code: string;
  display: string;
}

export interface CodeSuggestionAddOn {
  code: string;
  units: number;
  display: string;
  justification: string;
}

export interface CodeSuggestion {
  code: string;
  display: string;
  justification: string;
  addOns?: CodeSuggestionAddOn[];
}

export enum CodeOutcomeKind {
  Determined = 'determined',
  DeterminedWithAlternates = 'determined-with-alternates',
  Open = 'open',
  NotAssessed = 'not-assessed',
  NoCode = 'no-code',
  NotApplicable = 'not-applicable',
}

export interface DeterminedCode {
  kind: CodeOutcomeKind.Determined;
  suggestion: CodeSuggestion;
}

export interface DeterminedCodeWithAlternates {
  kind: CodeOutcomeKind.DeterminedWithAlternates;
  suggestion: CodeSuggestion;
  alternates: CodeCandidate[];
  alternatesSummary: string;
}

export interface OpenCodeSet {
  kind: CodeOutcomeKind.Open;
  candidates: CodeCandidate[];
  summary: string;
}

export interface NotAssessedCode {
  kind: CodeOutcomeKind.NotAssessed;
  reason: string;
}

export interface NoCodeOutcome {
  kind: CodeOutcomeKind.NoCode;
}

export interface CodeOutcomeNotApplicable {
  kind: CodeOutcomeKind.NotApplicable;
}

export type CodeOutcome =
  | DeterminedCode
  | DeterminedCodeWithAlternates
  | OpenCodeSet
  | NotAssessedCode
  | NoCodeOutcome
  | CodeOutcomeNotApplicable;

export enum CodeAssessmentKind {
  Supported = 'supported',
  Unsupported = 'unsupported',
  NotAssessed = 'not-assessed',
}

export interface SupportedCodeAssessment {
  kind: CodeAssessmentKind.Supported;
}

export interface UnsupportedCodeAssessment {
  kind: CodeAssessmentKind.Unsupported;
}

export interface NotAssessedCodeAssessment {
  kind: CodeAssessmentKind.NotAssessed;
}

export type CodeAssessment = SupportedCodeAssessment | UnsupportedCodeAssessment | NotAssessedCodeAssessment;

export function setCodeAssessment(evaluation: FamilyEvaluation, code: string, kind: CodeAssessmentKind): void {
  evaluation.codeAssessments.set(code, { kind });
}

export function codesWithAssessment(evaluation: FamilyEvaluation, kind: CodeAssessmentKind): string[] {
  return [...evaluation.codeAssessments.entries()]
    .filter(([, assessment]) => assessment.kind === kind)
    .map(([code]) => code);
}

export function determinedCode(suggestion: CodeSuggestion): DeterminedCode {
  return { kind: CodeOutcomeKind.Determined, suggestion };
}

export function determinedCodeWithAlternates(
  suggestion: CodeSuggestion,
  alternates: CodeCandidate[],
  alternatesSummary: string
): DeterminedCodeWithAlternates {
  return { kind: CodeOutcomeKind.DeterminedWithAlternates, suggestion, alternates, alternatesSummary };
}

export function openCodeSet(candidates: CodeCandidate[], summary: string): OpenCodeSet {
  return { kind: CodeOutcomeKind.Open, candidates, summary };
}

export function notAssessedCode(reason: string): NotAssessedCode {
  return { kind: CodeOutcomeKind.NotAssessed, reason };
}

export const NO_CODE_OUTCOME: NoCodeOutcome = { kind: CodeOutcomeKind.NoCode };

export const CODE_OUTCOME_NOT_APPLICABLE: CodeOutcomeNotApplicable = {
  kind: CodeOutcomeKind.NotApplicable,
};

export function determinedSuggestion(outcome: CodeOutcome): CodeSuggestion | undefined {
  return outcome.kind === CodeOutcomeKind.Determined || outcome.kind === CodeOutcomeKind.DeterminedWithAlternates
    ? outcome.suggestion
    : undefined;
}

export interface FamilyEvaluation {
  outcome: CodeOutcome;
  findings: Finding[];
  codeAssessments: Map<string, CodeAssessment>;
  payerNotes: string[];
}

export function emptySuggestionEvaluation(): FamilyEvaluation {
  return createEvaluation(NO_CODE_OUTCOME);
}

export function emptyDefenseEvaluation(): FamilyEvaluation {
  return createEvaluation(CODE_OUTCOME_NOT_APPLICABLE);
}

function createEvaluation(outcome: CodeOutcome): FamilyEvaluation {
  return {
    outcome,
    findings: [],
    codeAssessments: new Map<string, CodeAssessment>(),
    payerNotes: [],
  };
}

export enum EvaluationFamilyMatchKind {
  Matched = 'matched',
  Unmatched = 'unmatched',
}

export interface MatchedEvaluationFamily {
  kind: EvaluationFamilyMatchKind.Matched;
  id: string;
}

export interface UnmatchedEvaluationFamily {
  kind: EvaluationFamilyMatchKind.Unmatched;
}

export type EvaluationFamilyMatch = MatchedEvaluationFamily | UnmatchedEvaluationFamily;

export interface EvaluationResult extends FamilyEvaluation {
  family: EvaluationFamilyMatch;
  rulesVintage: string;
}

export interface ProcedureFactsInput {
  procedureType?: string;
  bodySite?: string;
  otherBodySite?: string;
  bodySide?: string;
  technique?: string[];
  suppliesUsed?: string[];
  otherSuppliesUsed?: string;
  medicationUsed?: string;
  procedureDetails?: string;
  specimenSent?: boolean;
  timeSpent?: string;
  cptCodes?: CptCodeRef[];
  diagnoses?: CptCodeRef[];
  lengthCm?: number;
  repairDepth?: RepairDepthSelection;
  performerType?: string;
  documentedBy?: string;
  patientResponse?: string;
  postInstructions?: string[];
  infusionStartTime?: string;
  infusionStopTime?: string;
}

export interface FamilyDetection {
  detectByProcedureType(input: ProcedureFactsInput): boolean;
  detectBySelectedCode(input: ProcedureFactsInput): boolean;
  detect(input: ProcedureFactsInput): boolean;
}

export enum ProcedureStructuredField {
  Length = 'length',
  RepairDepth = 'repair-depth',
  InfusionTimes = 'infusion-times',
}

export interface ProcedureStructuredFieldInput {
  procedureType?: string;
  cptCodes?: CptCodeRef[];
}

export function familyDetection(
  byProcedureType: (input: ProcedureFactsInput) => boolean,
  bySelectedCode: (input: ProcedureFactsInput) => boolean
): FamilyDetection {
  return {
    detectByProcedureType: byProcedureType,
    detectBySelectedCode: bySelectedCode,
    detect: (input) => byProcedureType(input) || bySelectedCode(input),
  };
}

export interface ProcedureFamilyModel extends FamilyDetection {
  id: string;
  displayName: string;
  structuredFieldsFor(input: ProcedureStructuredFieldInput): readonly ProcedureStructuredField[];
  suggestCode(input: ProcedureFactsInput): FamilyEvaluation;
  defendCodes(input: ProcedureFactsInput): FamilyEvaluation;
}
