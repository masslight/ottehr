import {
  citing,
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  notAssessedCode,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractLesionDestructionFacts } from './lesion-destruction.extract';
import { codeCandidate, codeForCount, LESION_DESTRUCTION_CODES } from './lesion-destruction.rules';
import { countAskMessage, excludedLesionMessage, implausibleCountMessage } from './lesion-destruction.shared';

export function suggestLesionDestructionCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractLesionDestructionFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const excluded = facts.excludedLesionType;

  if (excluded !== undefined) {
    const message = excludedLesionMessage(excluded.value, 'No code is suggested');

    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message,
      evidence: citing(excluded),
    });

    evaluation.outcome = notAssessedCode(message);

    return evaluation;
  }

  if (facts.lesionCount === undefined) {
    const implausibleCount = facts.implausibleLesionCount;

    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        implausibleCount === undefined ? countAskMessage('') : implausibleCountMessage('', implausibleCount.value),
      evidence: citing(implausibleCount),
    });

    evaluation.outcome = openCodeSet(
      [codeCandidate(LESION_DESTRUCTION_CODES.upToBoundary), codeCandidate(LESION_DESTRUCTION_CODES.overBoundary)],
      '17110–17111 — the number of lesions treated determines the code'
    );

    return evaluation;
  }

  const count = facts.lesionCount.value;
  const code = codeForCount(count);

  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: `Benign lesion destruction — ${count} lesion${count === 1 ? '' : 's'} documented (${
      code === LESION_DESTRUCTION_CODES.upToBoundary ? 'up to 14' : '15 or more'
    }) → ${code}.`,
  });

  return evaluation;
}
