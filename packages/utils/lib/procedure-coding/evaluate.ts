// Family-agnostic evaluators: detect the family, run its extraction, and return an
// EvaluationResult. Unknown families are reported "not assessed", never guessed (requirement B7).

import { cerumenFamily } from './families/cerumen';
import { foreignBodyFamily } from './families/foreign-body';
import { incisionDrainageFamily } from './families/incision-drainage';
import { lacerationFamily } from './families/laceration';
import { EvaluationResult, FamilyEvaluation, ProcedureFactsInput, ProcedureFamilyModel } from './model.types';
import { CPT_RULES_VINTAGE } from './provenance';

/** Registered family models, checked in order (first match wins); laceration stays first. */
export const PROCEDURE_FAMILIES: ProcedureFamilyModel[] = [
  lacerationFamily,
  incisionDrainageFamily,
  foreignBodyFamily,
  cerumenFamily,
];

export function detectProcedureFamily(input: ProcedureFactsInput): ProcedureFamilyModel | undefined {
  return PROCEDURE_FAMILIES.find((family) => family.detect(input));
}

function unknownFamilyResult(input: ProcedureFactsInput): EvaluationResult {
  const selectedCodes = (input.cptCodes ?? []).map((c) => c.code);
  return {
    findings: [],
    supportedCodes: [],
    notAssessedCodes: selectedCodes,
    notAssessed: true,
    notAssessedReason: 'This procedure is not covered by the documentation checks; not assessed.',
    rulesVintage: CPT_RULES_VINTAGE,
  };
}

function withMetadata(family: ProcedureFamilyModel, evaluation: FamilyEvaluation): EvaluationResult {
  return { family: family.id, ...evaluation, rulesVintage: CPT_RULES_VINTAGE };
}

/** Forward evaluation: documented facts → determined code, or the genuinely open candidate set. */
export function suggestCode(input: ProcedureFactsInput): EvaluationResult {
  const family = detectProcedureFamily(input);
  if (!family) return unknownFamilyResult(input);
  return withMetadata(family, family.suggestCode(input));
}

/** Inverse evaluation: selected codes → per-code missing elements and contradictions. */
export function defendCodes(input: ProcedureFactsInput): EvaluationResult {
  const family = detectProcedureFamily(input);
  if (!family) return unknownFamilyResult(input);
  return withMetadata(family, family.defendCodes(input));
}
