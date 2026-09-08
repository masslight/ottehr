import {
  CodeAssessmentKind,
  CodeCandidate,
  codeScope,
  FamilyEvaluation,
  Finding,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
  setCodeAssessment,
  WhereToDocument,
  whereToDocumentClause,
} from './model.types';

export const DETAILS_FIELD_LABEL = 'Procedure details';
export const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

export const SITE_FIELD_LABEL = 'Site/location';
export const SIDE_FIELD_LABEL = 'Side of body';
export const LENGTH_FIELD_LABEL = 'Wound/lesion size (cm)';
export const REPAIR_DEPTH_FIELD_LABEL = 'Repair depth';
export const TECHNIQUE_FIELD_LABEL = 'Technique';
export const SUPPLIES_FIELD_LABEL = 'Supplies used';
export const MEDICATION_FIELD_LABEL = 'Anaesthesia / medication used';
export const PATIENT_RESPONSE_FIELD_LABEL = 'Patient response';
export const POST_INSTRUCTIONS_FIELD_LABEL = 'Post-procedure instructions';
export const PERFORMER_FIELD_LABEL = 'Performed by / Documented by';
export const DIAGNOSIS_FIELD_LABEL = 'Diagnosis';
export const INFUSION_TIMES_FIELD_LABEL = 'Start Time / Stop Time';

export function whereClauseFor<T extends Record<string, WhereToDocument>>(
  table: T
): (element: keyof T, verb?: string) => string {
  return (element, verb) => whereToDocumentClause(table[element], verb);
}

export function codeCandidateFrom<const TDisplays extends Record<string, string>>(
  displays: TDisplays
): (code: Extract<keyof TDisplays, string>) => CodeCandidate {
  return (code) => ({ code, display: `${code} — ${displays[code]}` });
}

export function codeCandidateFromInfo<const TTable extends Record<string, { display: string }>>(
  table: TTable
): (code: Extract<keyof TTable, string>) => CodeCandidate {
  return (code) => ({ code, display: `${code} — ${table[code].display}` });
}

export type CodeDefinition = { code: string; display: string };
export type CatalogDefinition<TDefinitions extends Record<string, CodeDefinition>> = TDefinitions[keyof TDefinitions];
export type CatalogCode<TDefinitions extends Record<string, CodeDefinition>> = CatalogDefinition<TDefinitions>['code'];

export interface CodeCatalog<TDefinitions extends Record<string, CodeDefinition>> {
  definitions: TDefinitions;
  codes: CatalogCode<TDefinitions>[];
  has: (code: string) => code is CatalogCode<TDefinitions>;
  resolve: (code: string) => CatalogDefinition<TDefinitions> | undefined;
  candidate: (code: CatalogCode<TDefinitions>) => CodeCandidate;
}

export function createCodeCatalog<const TDefinitions extends Record<string, { code: string; display: string }>>(
  definitions: TDefinitions
): CodeCatalog<TDefinitions> {
  type TDefinition = TDefinitions[keyof TDefinitions];
  type TCode = TDefinition['code'];

  const byCode = new Map<TCode, TDefinition>();

  Object.values(definitions).forEach((definition) => {
    byCode.set(definition.code as TCode, definition as TDefinition);
  });

  const has = (code: string): code is TCode => byCode.has(code as TCode);

  return {
    definitions,
    codes: [...byCode.keys()],
    has,
    resolve: (code: string): TDefinition | undefined => byCode.get(code as TCode),
    candidate: (code: TCode): CodeCandidate => ({ code, display: `${code} — ${byCode.get(code)?.display ?? ''}` }),
  };
}

export function joinWithOr(items: string[]): string {
  return joinWith(items, 'or');
}

export function joinWithAnd(items: string[]): string {
  return joinWith(items, 'and');
}

function joinWith(items: string[], conjunction: string): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} ${conjunction} ${items[1]}`;

  return `${items.slice(0, -1).join(', ')}, ${conjunction} ${items[items.length - 1]}`;
}

export function blocksSupport(findings: Finding[]): boolean {
  return findings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction');
}

export function defendSelectedCodes<TInfo>(
  input: ProcedureFactsInput,
  evaluation: FamilyEvaluation,
  resolve: (code: string) => TInfo | undefined,
  check: (info: TInfo, code: string, codeFindings: Finding[], answerAtEntryLevel: () => void) => void
): void {
  for (const selected of input.cptCodes ?? []) {
    const code = selected.code;
    const info = resolve(code);

    if (info === undefined) {
      setCodeAssessment(evaluation, code, CodeAssessmentKind.NotAssessed);
      continue;
    }

    const codeFindings: Finding[] = [];
    let answeredAtEntryLevel = false;

    check(info, code, codeFindings, () => {
      answeredAtEntryLevel = true;
    });

    setCodeAssessment(
      evaluation,
      code,
      answeredAtEntryLevel || blocksSupport(codeFindings)
        ? CodeAssessmentKind.Unsupported
        : CodeAssessmentKind.Supported
    );

    if (answeredAtEntryLevel) continue;

    evaluation.findings.push(...codeFindings);
  }
}

export function lateralityFinding(code: string, whereClause: string, reason?: string): Finding {
  return {
    level: 'required',
    scope: codeScope(code),
    message: `Laterality is not documented for ${code}${reason === undefined ? '' : ` — ${reason}`}. ${whereClause}`,
    evidence: NOTHING_TO_CITE,
  };
}
