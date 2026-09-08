import {
  determinedCode,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
} from '../model.types';
import { extractUrinaryCatheterizationFacts } from './urinary-catheterization.extract';
import { URINARY_CATHETER_CODE_CATALOG, URINARY_CATHETER_RULES } from './urinary-catheterization.rules';
import { TYPE_ASK_CLAUSE, TYPE_CONFLICT_CLAUSE, TYPE_LABELS, whereClause } from './urinary-catheterization.shared';

export function suggestUrinaryCatheterizationCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractUrinaryCatheterizationFacts(input);
  const evaluation = emptySuggestionEvaluation();

  if (facts.catheterType === undefined) {
    evaluation.findings.push({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: facts.typeConflict
        ? `The catheter type is ambiguous — ${TYPE_CONFLICT_CLAUSE}; ${TYPE_ASK_CLAUSE}.`
        : `The catheter type is not documented — ${TYPE_ASK_CLAUSE}. ${whereClause('type')}`,
      evidence: NOTHING_TO_CITE,
    });

    evaluation.outcome = openCodeSet(
      URINARY_CATHETER_CODE_CATALOG.codes.map(URINARY_CATHETER_CODE_CATALOG.candidate),
      '51701–51702 — the catheter type (straight vs indwelling) determines the code'
    );
    return evaluation;
  }

  const type = facts.catheterType.value;
  const code = URINARY_CATHETER_RULES[type].code;

  evaluation.outcome = determinedCode({
    code,
    display: URINARY_CATHETER_CODE_CATALOG.candidate(code).display,
    justification: `Urinary catheterization — ${TYPE_LABELS[type]} documented → ${code}.`,
  });

  return evaluation;
}
