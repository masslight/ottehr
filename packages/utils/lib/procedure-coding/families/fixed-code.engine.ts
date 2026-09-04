import { extractSite, textFlag } from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import { blocksSupport, PATIENT_RESPONSE_FIELD_LABEL, SITE_FIELD_LABEL } from '../family-support';
import {
  citing,
  CodeAssessmentKind,
  codeScope,
  determinedCode,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  fieldEvidence,
  Finding,
  notAssessedCode,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  setCodeAssessment,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

type TextMatcher = (text: string, pattern: RegExp) => FactValue<true> | undefined;

interface FixedCodeRequirement {
  key: string;
  documented: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  missing: string;
  where: WhereToDocument;
}

interface FixedCodeNote {
  key: string;
  detect: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  message: string;
}

interface FixedCodeScopeExit {
  key: string;
  detect: (input: ProcedureFactsInput, text: string) => FactValue<true> | undefined;
  reason: string;
}

export interface FixedCodeSpec {
  id: string;
  displayName: string;
  code: string;
  codeDisplay: string;
  procedureLabel: string;
  requirements: FixedCodeRequirement[];
  notes?: FixedCodeNote[];
  scopeExits?: FixedCodeScopeExit[];
  payerNote?: string;
}

export function structuredFact(field: string): FactValue<true> {
  return { value: true, evidence: fieldEvidence(field) };
}

export function outcomeDocumented(
  input: ProcedureFactsInput,
  text: string,
  pattern: RegExp,
  match: TextMatcher = textFlag
): FactValue<true> | undefined {
  return (
    match(text, pattern) ?? (input.patientResponse?.trim() ? structuredFact(PATIENT_RESPONSE_FIELD_LABEL) : undefined)
  );
}

export function siteDocumented(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  if (input.bodySite?.trim() || input.otherBodySite?.trim()) return structuredFact(SITE_FIELD_LABEL);
  const site = extractSite(input, text);
  if (site === undefined) return undefined;
  return { value: true, evidence: site.evidence };
}

export function buildFixedCodeFamily(spec: FixedCodeSpec): ProcedureFamilyModel {
  const firstScopeExit = (
    input: ProcedureFactsInput,
    text: string
  ): { exit: FixedCodeScopeExit; fact: FactValue<true> } | undefined => {
    for (const exit of spec.scopeExits ?? []) {
      const fact = exit.detect(input, text);
      if (fact) return { exit, fact };
    }
    return undefined;
  };

  const noteFindings = (input: ProcedureFactsInput, text: string, code: string): Finding[] =>
    (spec.notes ?? []).flatMap((note) => {
      const fact = note.detect(input, text);
      return fact
        ? [
            {
              level: 'bestPractice' as const,
              scope: codeScope(code),
              message: note.message,
              evidence: citing(fact),
            },
          ]
        : [];
    });

  const suggest = (input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptySuggestionEvaluation();
    const text = input.procedureDetails ?? '';
    if (spec.payerNote) evaluation.payerNotes = [spec.payerNote];

    const scopeExit = firstScopeExit(input, text);
    if (scopeExit) {
      evaluation.findings.push({
        level: 'bestPractice',
        scope: ENTRY_SCOPE,
        message: scopeExit.exit.reason,
        evidence: citing(scopeExit.fact),
      });
      evaluation.outcome = notAssessedCode(scopeExit.exit.reason);
      return evaluation;
    }

    evaluation.outcome = determinedCode({
      code: spec.code,
      display: `${spec.code} — ${spec.codeDisplay}`,
      justification: `${spec.procedureLabel} bills a single code → ${spec.code}.`,
    });
    evaluation.findings.push(...noteFindings(input, text, spec.code));
    return evaluation;
  };

  const defend = (input: ProcedureFactsInput): FamilyEvaluation => {
    const evaluation = emptyDefenseEvaluation();
    const { findings } = evaluation;
    const selected = input.cptCodes ?? [];
    if (selected.length === 0) return evaluation;

    const text = input.procedureDetails ?? '';
    const scopeExit = firstScopeExit(input, text);
    for (const selectedCode of selected) {
      const code = selectedCode.code;

      if (code !== spec.code) {
        setCodeAssessment(evaluation, code, CodeAssessmentKind.NotAssessed);
        continue;
      }

      if (spec.payerNote) evaluation.payerNotes = [spec.payerNote];

      if (scopeExit) {
        findings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: scopeExit.exit.reason,
          evidence: citing(scopeExit.fact),
        });
        setCodeAssessment(evaluation, code, CodeAssessmentKind.NotAssessed);
        evaluation.outcome = notAssessedCode(scopeExit.exit.reason);
        continue;
      }

      const codeFindings: Finding[] = [];
      for (const requirement of spec.requirements) {
        if (requirement.documented(input, text) === undefined) {
          codeFindings.push({
            level: 'required',
            scope: codeScope(code),
            message: `${requirement.missing} for ${code}. ${whereToDocumentClause(requirement.where)}`,
            evidence: NOTHING_TO_CITE,
          });
        }
      }
      codeFindings.push(...noteFindings(input, text, code));
      setCodeAssessment(
        evaluation,
        code,
        blocksSupport(codeFindings) ? CodeAssessmentKind.Unsupported : CodeAssessmentKind.Supported
      );
      findings.push(...codeFindings);
    }
    return evaluation;
  };

  return {
    id: spec.id,
    displayName: spec.displayName,
    structuredFieldsFor: () => [],
    ...familyDetection(
      (input) => procedureTypeMatchesFamily(spec.id, input.procedureType),
      (input) => (input.cptCodes ?? []).some((c) => c.code === spec.code)
    ),
    suggestCode: suggest,
    defendCodes: defend,
  };
}
