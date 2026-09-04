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
import { extractBurnFacts } from './burn-treatment.extract';
import { BURN_CLASS_INFO, BURN_CODE_RANGE, codeCandidate } from './burn-treatment.rules';
import {
  depthAskMessage,
  EXTENT_ASK_CLAUSE,
  extentPhrase,
  implausibleExtentMessage,
  MIXED_DEPTH_MESSAGE,
  outOfScopeDepthMessage,
  whereClause,
} from './burn-treatment.shared';

export function suggestBurnTreatmentCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractBurnFacts(input);
  const evaluation = emptySuggestionEvaluation();
  const { findings } = evaluation;
  const depth = facts.depthClass;
  const outOfScopeDepth = depth === undefined ? undefined : outOfScopeDepthMessage(depth.value, 'No code is suggested');

  if (depth !== undefined && outOfScopeDepth !== undefined) {
    findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      message: outOfScopeDepth,
      evidence: citing(depth),
    });
    evaluation.outcome = notAssessedCode(outOfScopeDepth);
    return evaluation;
  }

  if (facts.mixedFullThickness) {
    findings.push({
      level: 'bestPractice',
      scope: ENTRY_SCOPE,
      message: MIXED_DEPTH_MESSAGE,
      evidence: citing(facts.mixedFullThickness),
    });
  }

  if (depth === undefined) {
    findings.push({ level: 'required', scope: ENTRY_SCOPE, message: depthAskMessage(''), evidence: NOTHING_TO_CITE });
  }

  if (facts.extentClass === undefined) {
    const implausiblePercent = facts.implausibleTbsaPercent;

    findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message:
        implausiblePercent === undefined
          ? `The burn's extent is not documented — ${EXTENT_ASK_CLAUSE}. ${whereClause('extent')}`
          : implausibleExtentMessage('', implausiblePercent.value),
      evidence: citing(implausiblePercent),
    });

    evaluation.outcome = openCodeSet(
      [codeCandidate('small'), codeCandidate('medium'), codeCandidate('large')],
      `${BURN_CODE_RANGE} — the treated burn extent (TBSA %) determines the exact code`
    );
    return evaluation;
  }

  const cls = facts.extentClass.value;
  const info = BURN_CLASS_INFO[cls];

  evaluation.outcome = determinedCode({
    code: info.code,
    display: `${info.code} — ${info.display}`,
    justification: `Burn dressing/debridement — ${extentPhrase(facts)} documented (${cls}, ${info.coverage}) → ${
      info.code
    }.`,
  });

  return evaluation;
}
