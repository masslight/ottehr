import {
  CodeAssessmentKind,
  CodeCandidate,
  CodeOutcome,
  CodeOutcomeKind,
  CodeSuggestion,
  codesWithAssessment,
  determinedSuggestion,
  EvidenceSource,
  FamilyEvaluation,
  Finding,
  FindingEvidence,
  FindingScopeKind,
  scopedCode,
} from './model.types';

export function hasFinding(
  findings: Finding[],
  level: Finding['level'],
  messagePart: string | RegExp,
  cptCode?: string
): boolean {
  return findings.some(
    (f) =>
      f.level === level &&
      (typeof messagePart === 'string' ? f.message.includes(messagePart) : messagePart.test(f.message)) &&
      (cptCode === undefined || (f.scope.kind === FindingScopeKind.Code && f.scope.cptCode === cptCode))
  );
}

export function citedText(carrier: { evidence: FindingEvidence } | undefined): string | undefined {
  return carrier?.evidence.source === EvidenceSource.Text ? carrier.evidence.sourceText : undefined;
}

export function citedField(carrier: { evidence: FindingEvidence } | undefined): string | undefined {
  return carrier?.evidence.source === EvidenceSource.Field ? carrier.evidence.field : undefined;
}

export function suggestionOf(evaluation: FamilyEvaluation): CodeSuggestion | undefined {
  return determinedSuggestion(evaluation.outcome);
}

export function findingCode(finding: Finding | undefined): string | undefined {
  return finding === undefined ? undefined : scopedCode(finding.scope);
}

export function evidenceSource(carrier: { evidence: FindingEvidence } | undefined): EvidenceSource | undefined {
  return carrier?.evidence.source;
}

export function offeredCandidates(outcome: CodeOutcome | undefined): CodeCandidate[] | undefined {
  if (outcome === undefined) return undefined;
  if (outcome.kind === CodeOutcomeKind.Open) return outcome.candidates;
  if (outcome.kind === CodeOutcomeKind.DeterminedWithAlternates) return outcome.alternates;
  return undefined;
}

export function offeredSummary(outcome: CodeOutcome | undefined): string | undefined {
  if (outcome === undefined) return undefined;
  if (outcome.kind === CodeOutcomeKind.Open) return outcome.summary;
  if (outcome.kind === CodeOutcomeKind.DeterminedWithAlternates) return outcome.alternatesSummary;
  return undefined;
}

export function notAssessedReason(evaluation: FamilyEvaluation): string | undefined {
  const outcome = evaluation.outcome;
  return outcome?.kind === CodeOutcomeKind.NotAssessed ? outcome.reason : undefined;
}

export function isNotAssessed(evaluation: FamilyEvaluation): boolean {
  return evaluation.outcome?.kind === CodeOutcomeKind.NotAssessed;
}

export function supportedCodes(evaluation: FamilyEvaluation): string[] {
  return codesWithAssessment(evaluation, CodeAssessmentKind.Supported);
}

export function notAssessedCodes(evaluation: FamilyEvaluation): string[] {
  return codesWithAssessment(evaluation, CodeAssessmentKind.NotAssessed);
}
