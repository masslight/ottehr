import { burnTreatmentFamily } from './families/burn-treatment';
import { cerumenFamily } from './families/cerumen';
import { ekgFamily } from './families/ekg';
import { FIXED_CODE_FAMILIES } from './families/fixed-code';
import { foreignBodyFamily } from './families/foreign-body';
import { incisionDrainageFamily } from './families/incision-drainage';
import { injectionInfusionFamily } from './families/injection-infusion';
import { lacerationFamily } from './families/laceration';
import { lesionDestructionFamily } from './families/lesion-destruction';
import { nasalPackingFamily } from './families/nasal-packing';
import { splintingFamily } from './families/splinting';
import { urinaryCatheterizationFamily } from './families/urinary-catheterization';
import { exactProcedureFamilyId, isNotAssessedProcedureType, patternProcedureFamilyIds } from './family-routing';
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
  ...FIXED_CODE_FAMILIES,
];

export function detectProcedureFamily(input: ProcedureFactsInput): ProcedureFamilyModel | undefined {
  const procedureType = input.procedureType?.trim() ?? '';
  if (procedureType.length > 0) {
    const exactFamilyId = exactProcedureFamilyId(procedureType);
    if (exactFamilyId !== undefined) {
      return PROCEDURE_FAMILIES.find((family) => family.id === exactFamilyId);
    }
    if (isNotAssessedProcedureType(procedureType)) return undefined;

    const patternFamilyIds = patternProcedureFamilyIds(procedureType);
    if (patternFamilyIds.length > 1) return undefined;
    if (patternFamilyIds.length === 1) {
      return PROCEDURE_FAMILIES.find((family) => family.id === patternFamilyIds[0]);
    }
  }
  return PROCEDURE_FAMILIES.find((family) => family.detectBySelectedCode(input));
}

function unknownFamilyResult(input: ProcedureFactsInput): EvaluationResult {
  const evaluation = emptySuggestionEvaluation();
  evaluation.outcome = notAssessedCode('This procedure is not covered by the documentation checks; not assessed.');
  (input.cptCodes ?? []).forEach((selectedCode) =>
    setCodeAssessment(evaluation, selectedCode.code, CodeAssessmentKind.NotAssessed)
  );
  return {
    family: { kind: EvaluationFamilyMatchKind.Unmatched },
    ...evaluation,
    rulesVintage: CPT_RULES_VINTAGE,
  };
}

function withMetadata(family: ProcedureFamilyModel, evaluation: FamilyEvaluation): EvaluationResult {
  return {
    family: { kind: EvaluationFamilyMatchKind.Matched, id: family.id },
    ...evaluation,
    rulesVintage: CPT_RULES_VINTAGE,
  };
}

export function suggestCode(input: ProcedureFactsInput): EvaluationResult {
  const family = detectProcedureFamily(input);
  if (!family) return unknownFamilyResult(input);
  return withMetadata(family, family.suggestCode(input));
}

export function defendCodes(input: ProcedureFactsInput): EvaluationResult {
  const family = detectProcedureFamily(input);
  if (!family) return unknownFamilyResult(input);
  return withMetadata(family, family.defendCodes(input));
}
