import { checkCodePairs } from './cpt';
import { burnTreatmentFamily } from './families/burn-treatment';
import { cerumenFamily } from './families/cerumen';
import { ekgFamily } from './families/ekg';
import { foreignBodyFamily } from './families/foreign-body';
import { incisionDrainageFamily } from './families/incision-drainage';
import { injectionInfusionFamily } from './families/injection-infusion';
import { ivCatheterPlacementFamily } from './families/iv-catheter-placement';
import { lacerationFamily } from './families/laceration';
import { lesionDestructionFamily } from './families/lesion-destruction';
import { nailTrephinationFamily } from './families/nail-trephination';
import { nasalPackingFamily } from './families/nasal-packing';
import { nebulizerFamily } from './families/nebulizer';
import { nursemaidElbowFamily } from './families/nursemaid-elbow';
import { splintingFamily } from './families/splinting';
import { urinaryCatheterizationFamily } from './families/urinary-catheterization';
import { defendFamilyCodes, suggestFamilyCodes } from './family-support';
import { ADJUNCT_PAIR_EDITS } from './medicare-ptp';
import {
  CodeAssessmentKind,
  emptySuggestionEvaluation,
  EvaluationFamilyMatchKind,
  EvaluationResult,
  FamilyEvaluation,
  notAssessedCode,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  setCodeAssessment,
} from './model.types';
import { CPT_RULES_VINTAGE } from './provenance';

export const PROCEDURE_FAMILIES: ProcedureFamilyModel[] = [
  lacerationFamily,
  incisionDrainageFamily,
  foreignBodyFamily,
  cerumenFamily,
  splintingFamily,
  injectionInfusionFamily,
  ekgFamily,
  burnTreatmentFamily,
  lesionDestructionFamily,
  urinaryCatheterizationFamily,
  nasalPackingFamily,
  nursemaidElbowFamily,
  nailTrephinationFamily,
  nebulizerFamily,
  ivCatheterPlacementFamily,
];

/** Routing accepts only the exact catalog display name. CPTs and clinical answers cannot select a family. */
export function detectProcedureFamily(
  input: Pick<ProcedureFactsInput, 'procedureType'>
): ProcedureFamilyModel | undefined {
  const matches = PROCEDURE_FAMILIES.filter(
    (family) => input.procedureType !== undefined && family.procedureNames.includes(input.procedureType)
  );
  return matches.length === 1 ? matches[0] : undefined;
}

function unknownFamilyResult(input: ProcedureFactsInput): EvaluationResult {
  const evaluation = emptySuggestionEvaluation();
  evaluation.outcome = notAssessedCode('This procedure is not covered by the documentation checks; not assessed.');

  (input.cptCodes ?? []).forEach((selectedCode) =>
    setCodeAssessment(evaluation, selectedCode.code, CodeAssessmentKind.NotAssessed)
  );

  return {
    source: 'rules',
    family: { kind: EvaluationFamilyMatchKind.Unmatched },
    ...evaluation,
    rulesVintage: CPT_RULES_VINTAGE,
  };
}

function withMetadata(family: ProcedureFamilyModel, evaluation: FamilyEvaluation): EvaluationResult {
  return {
    source: 'rules',
    family: { kind: EvaluationFamilyMatchKind.Matched, id: family.id },
    ...evaluation,
    rulesVintage: CPT_RULES_VINTAGE,
  };
}

export function suggestCode(input: ProcedureFactsInput): EvaluationResult {
  const family = detectProcedureFamily(input);

  if (!family) return unknownFamilyResult(input);

  return withMetadata(family, suggestFamilyCodes(family, input));
}

export function defendCodes(input: ProcedureFactsInput, _suggestion?: EvaluationResult): EvaluationResult {
  const family = detectProcedureFamily(input);

  if (!family) return unknownFamilyResult(input);

  const evaluation = withMetadata(family, defendFamilyCodes(family, input));

  checkCodePairs(input, evaluation, [
    ...ADJUNCT_PAIR_EDITS,
    ...PROCEDURE_FAMILIES.flatMap((family) => family.codePairEdits ?? []),
  ]);

  evaluation.findings = evaluation.findings.filter(
    (finding, index, all) =>
      all.findIndex(
        (other) => other.message === finding.message && JSON.stringify(other.scope) === JSON.stringify(finding.scope)
      ) === index
  );

  return evaluation;
}
