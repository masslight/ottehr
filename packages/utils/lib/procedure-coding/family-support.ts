import { checkDailyLimits, defendAgainst, missing, suggestedCodes } from './cpt';
import {
  ENTRY_SCOPE,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  ProcedureFamilyModel,
} from './model.types';
import { getStructuredFieldsData, invalidStructuredFields, StructuredFacts } from './structured-fields';

/** Saved structured answers override values read from older structured form fields. */
export function resolveFamilyFacts(family: ProcedureFamilyModel, input: ProcedureFactsInput): StructuredFacts {
  const legacyFacts = family.readLegacyFacts?.(input) ?? {};

  return getStructuredFieldsData(
    { ...input, structuredFacts: { ...legacyFacts, ...input.structuredFacts } },
    family.fields
  );
}

function evaluateDocumentation(family: ProcedureFamilyModel, input: ProcedureFactsInput): FamilyEvaluation {
  const facts = resolveFamilyFacts(family, input);
  const invalidFields = invalidStructuredFields(family.fields, facts);
  const evaluation = invalidFields.length ? missing(...invalidFields) : family.suggest(facts, input);

  // Reminders describe the procedure actually supported by the answers. Do not show
  // retained-nail or other procedure-specific instructions after routing that case out.
  if (!suggestedCodes(evaluation).length) return evaluation;

  for (const message of family.documentationChecklist?.(facts) ?? []) {
    evaluation.findings.push({ level: 'bestPractice', scope: ENTRY_SCOPE, evidence: NOTHING_TO_CITE, message });
  }

  return evaluation;
}

export function suggestFamilyCodes(family: ProcedureFamilyModel, input: ProcedureFactsInput): FamilyEvaluation {
  const evaluation = evaluateDocumentation(family, input);
  const suggestions = suggestedCodes(evaluation);

  // Payer alternatives describe the same care. Check each billing option separately to avoid counting twice.
  for (const alternative of ['standard', 'Medicare'] as const) {
    if (alternative === 'Medicare' && !suggestions.some((line) => line.alternative === alternative)) continue;

    const lines = suggestions.filter((line) => line.alternative === undefined || line.alternative === alternative);

    checkDailyLimits(
      input,
      evaluation,
      family.dailyLimits ?? {},
      lines.map((line) => ({
        code: line.code,
        display: line.display,
        billableUnits: line.units,
      }))
    );
  }

  evaluation.findings = evaluation.findings.filter(
    (finding, index, all) =>
      all.findIndex(
        (other) => other.message === finding.message && JSON.stringify(other.scope) === JSON.stringify(finding.scope)
      ) === index
  );

  return evaluation;
}

export function defendFamilyCodes(family: ProcedureFamilyModel, input: ProcedureFactsInput): FamilyEvaluation {
  // Billing warnings must not change whether the clinical answers support a code.
  const documentation = evaluateDocumentation(family, input);

  const evaluation = defendAgainst(input, documentation, family.codes);
  checkDailyLimits(input, evaluation, family.dailyLimits ?? {}, input.cptCodes ?? []);

  return evaluation;
}
