import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  notAssessedCode,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { EKG_INTERPRETATION_ELEMENTS, EkgFacts, extractEkgFacts } from './ekg.extract';
import { codeCandidate, EKG_CODES } from './ekg.rules';
import {
  FULL_INTERPRETATION_MENU,
  limitedLeadMessage,
  missingElementFinding,
  missingElements,
  whereClause,
} from './ekg.shared';

function documentedElementLabels(facts: EkgFacts): string {
  return EKG_INTERPRETATION_ELEMENTS.filter(({ element }) => facts.elements[element] !== undefined)
    .map(({ label }) => label)
    .join(', ');
}

const IN_OFFICE_PREMISE = 'the note does not indicate the tracing was obtained elsewhere';

const OPEN_CANDIDATES_SUMMARY =
  '93000, 93005, 93010 — which EKG component the documentation supports (the tracing, the interpretation & report, or both) determines the code';

const CLUSTERED_ELEMENTS_THRESHOLD = 2;

function hasEkgEvidence(facts: EkgFacts, documentedCount: number): boolean {
  return facts.tracingMentionDocumented !== undefined || documentedCount >= CLUSTERED_ELEMENTS_THRESHOLD;
}

export function suggestEkgCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const missing = missingElements(facts);
  const documentedCount = EKG_INTERPRETATION_ELEMENTS.length - missing.length;

  if (facts.limitedLeadDocumented) {
    const message = limitedLeadMessage('No code is suggested');
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(facts.limitedLeadDocumented),
    });
    evaluation.outcome = notAssessedCode(message);
    return evaluation;
  }

  if (documentedCount === 0 && facts.tracingMentionDocumented !== undefined) {
    evaluation.outcome = determinedCode({
      code: EKG_CODES.tracingOnly,
      display: codeCandidate(EKG_CODES.tracingOnly).display,
      justification:
        'A routine EKG tracing with at least 12 leads is documented without an interpretation and report — the documentation supports the tracing-only component → 93005.',
    });
    return evaluation;
  }

  if (documentedCount === 0 || !hasEkgEvidence(facts, documentedCount)) {
    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        documentedCount === 0
          ? `No 12-lead tracing or interpretation & report is documented — the component(s) performed determine the code: 93000 covers both, 93005 the tracing only, and 93010 the interpretation & report only. ${whereClause(
              'interpretation',
              'Document the component(s) performed'
            )}`
          : `The note does not document an EKG tracing or a reading of one — ${documentedElementLabels(
              facts
            )} on its own reads as a vital sign or history rather than an interpretation, so which EKG component the documentation supports is open: 93000 covers the tracing plus the interpretation & report, 93005 the tracing only. ${whereClause(
              'interpretation',
              'Add the interpretation'
            )}`,
      evidence: NOTHING_TO_CITE,
    });
    evaluation.outcome = openCodeSet(Object.values(EKG_CODES).map(codeCandidate), OPEN_CANDIDATES_SUMMARY);
    return evaluation;
  }

  const external = facts.externalTracingDocumented !== undefined;
  const code = external ? EKG_CODES.interpretationOnly : EKG_CODES.tracingWithInterpretation;

  if (missing.length === 0) {
    evaluation.outcome = determinedCode({
      code,
      display: codeCandidate(code).display,
      justification: external
        ? `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010.`
        : `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) and ${IN_OFFICE_PREMISE}, so the documentation supports the complete service → 93000.`,
    });
    return evaluation;
  }

  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: external
      ? `An interpretation is documented (${documentedElementLabels(
          facts
        )}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010; the missing interpretation elements are listed below.`
      : `An interpretation is documented (${documentedElementLabels(
          facts
        )}) and ${IN_OFFICE_PREMISE}, so the documentation supports the complete service → 93000; the missing interpretation elements are listed below.`,
  });
  for (const entry of missing) {
    findings.push(missingElementFinding(entry, code));
  }
  return evaluation;
}
