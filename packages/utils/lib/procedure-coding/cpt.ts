import {
  CodeAssessmentKind,
  CodeOutcomeKind,
  codeScope,
  CodeSuggestion,
  CptCodeRef,
  ENTRY_SCOPE,
  FamilyEvaluation,
  Finding,
  NOTHING_TO_CITE,
  ProcedureFactsInput,
} from './model.types';

/** Standard CPT modifiers; each family decides when a modifier applies. */
export const CPT_MODIFIERS = {
  LeftSide: 'LT',
  RightSide: 'RT',
  Bilateral: '50',
  DistinctService: '59',
  RepeatSameClinician: '76',
  RepeatDifferentClinician: '77',
} as const;

/** Numeric values match the CMS MUE adjudication indicator (MAI) column. */
export enum MueAdjudication {
  ClaimLine = 1,
  DateOfServicePolicy = 2,
  DateOfServiceClinical = 3,
}

export interface DailyUnitLimit {
  maxUnits: number;
  adjudicationIndicator: MueAdjudication;
}

/**
 * Every code whose MUE value was read from the CMS table is declared here. A code with no entry means
 * "no limit confirmed by a source" and is deliberately left unchecked: an invented cap would show the
 * provider a false over-limit warning.
 */
export type DailyUnitLimits<TCode extends string = string> = Readonly<Partial<Record<TCode, DailyUnitLimit>>>;

interface EvaluationContent {
  suggestions?: CodeSuggestion[];
  findings?: Finding[];
  payerNotes?: string[];
}

/** Combine identical billing lines, preserving separate modifiers and payer alternatives. */
export function buildEvaluation({
  suggestions = [],
  findings = [],
  payerNotes = [],
}: EvaluationContent = {}): FamilyEvaluation {
  const combined = new Map<string, CodeSuggestion>();
  for (const line of suggestions) {
    const key = `${lineKey(line.code, line.modifiers ?? [])}|${line.alternative ?? ''}`;
    const previous = combined.get(key);
    combined.set(
      key,
      previous
        ? {
            ...previous,
            units: (previous.units ?? 1) + (line.units ?? 1),
            justification: [...new Set([previous.justification, line.justification])].join(' '),
          }
        : { ...line }
    );
  }
  return {
    outcome: { kind: CodeOutcomeKind.Suggestions, suggestions: [...combined.values()] },
    findings,
    payerNotes,
    codeAssessments: {},
  };
}

export function missing(...fields: string[]): FamilyEvaluation {
  return buildEvaluation({
    suggestions: [],
    findings: [...new Set(fields)].map((field) => ({
      level: 'determines',
      scope: ENTRY_SCOPE,
      message: `Additional documentation needed to suggest a code — ${field}`,
      evidence: NOTHING_TO_CITE,
    })),
  });
}

export function coder(reason: string): FamilyEvaluation {
  return buildEvaluation({
    suggestions: [],
    findings: [
      {
        level: 'required',
        scope: ENTRY_SCOPE,
        message: `This case needs a coder's judgment — ${reason}`,
        evidence: NOTHING_TO_CITE,
      },
    ],
  });
}

export function noCode(reason: string): FamilyEvaluation {
  return buildEvaluation({
    suggestions: [],
    findings: [{ level: 'bestPractice', scope: ENTRY_SCOPE, message: reason, evidence: NOTHING_TO_CITE }],
  });
}

export function suggestedCodes(evaluation: FamilyEvaluation): CodeSuggestion[] {
  return evaluation.outcome.kind === CodeOutcomeKind.Suggestions ? evaluation.outcome.suggestions : [];
}

/** Billing format only. The caller decides whether this procedure supports a side modifier. */
export function lateralityModifiers(side: unknown): string[] {
  if (side === 'both') return [CPT_MODIFIERS.Bilateral];
  if (side === 'left') return [CPT_MODIFIERS.LeftSide];
  if (side === 'right') return [CPT_MODIFIERS.RightSide];
  return [];
}

function lineKey(code: string, modifiers: readonly string[]): string {
  return `${code}|${[...new Set(modifiers)].sort().join(',')}`;
}

/** Compare quantities as well as codes; CPT descriptions are never clinical evidence. */
export function defendAgainst(
  input: ProcedureFactsInput,
  suggestion: FamilyEvaluation,
  inventory: readonly string[]
): FamilyEvaluation {
  const evaluation = buildEvaluation({
    suggestions: [],
    findings: [...suggestion.findings],
    payerNotes: [...suggestion.payerNotes],
  });

  const expected = new Map<string, number>();

  for (const line of suggestedCodes(suggestion)) {
    const key = lineKey(line.code, line.modifiers ?? []);
    expected.set(key, Math.max(expected.get(key) ?? 0, line.units ?? 1));
  }

  const selected = new Map<string, number>();

  for (const line of input.cptCodes ?? []) {
    const key = lineKey(
      line.code,
      (line.modifier ?? []).map((m) => m.code)
    );
    selected.set(key, (selected.get(key) ?? 0) + (line.billableUnits ?? 1));
  }

  const unresolved = suggestion.findings.some(
    (f) => f.scope.kind === 'entry' && (f.level === 'determines' || f.level === 'required')
  );

  for (const line of input.cptCodes ?? []) {
    let kind = CodeAssessmentKind.NotAssessed;

    if (inventory.includes(line.code) && !unresolved) {
      const key = lineKey(
        line.code,
        (line.modifier ?? []).map((m) => m.code)
      );

      kind = expected.get(key) === selected.get(key) ? CodeAssessmentKind.Supported : CodeAssessmentKind.Unsupported;

      if (kind === CodeAssessmentKind.Unsupported)
        evaluation.findings.push({
          level: 'contradiction',
          scope: codeScope(line.code),
          evidence: NOTHING_TO_CITE,
          message:
            ['93005', '93010'].includes(line.code) && suggestedCodes(suggestion).some((item) => item.code === '93000')
              ? 'Documentation supports the full recording with interpretation and report; a component-only code is selected.'
              : 'Selected code, quantity or modifiers do not match the structured answers.',
        });
    }

    if (evaluation.codeAssessments[line.code]?.kind !== CodeAssessmentKind.Unsupported)
      evaluation.codeAssessments[line.code] = { kind };
  }

  for (const line of suggestedCodes(suggestion)) {
    if (
      line.requiresCode &&
      (input.cptCodes ?? []).some((selected) => selected.code === line.code) &&
      !(input.cptCodes ?? []).some((selected) => selected.code === line.requiresCode)
    ) {
      evaluation.codeAssessments[line.code] = { kind: CodeAssessmentKind.Unsupported };
      evaluation.findings.push({
        level: 'contradiction',
        scope: codeScope(line.code),
        evidence: NOTHING_TO_CITE,
        message: 'The additional procedure code requires its corresponding base procedure code.',
      });
    }
  }

  const chosenAlternatives = new Set(
    suggestedCodes(suggestion)
      .filter((line) => line.alternative && selected.has(lineKey(line.code, line.modifiers ?? [])))
      .map((line) => line.alternative)
  );

  if (chosenAlternatives.size > 1) {
    evaluation.findings.push({
      level: 'contradiction',
      scope: ENTRY_SCOPE,
      evidence: NOTHING_TO_CITE,
      message: 'Both payer alternatives are selected. Choose one billing option for this care.',
    });

    for (const line of input.cptCodes ?? [])
      if (inventory.includes(line.code))
        evaluation.codeAssessments[line.code] = { kind: CodeAssessmentKind.Unsupported };
  }

  return evaluation;
}

/** CMS Practitioner MUE 2026-10-01: report excess without changing the documented quantity.
 * https://www.cms.gov/files/zip/medicare-ncci-2026-q4-practitioner-services-mue-table.zip
 */
export function checkDailyLimits(
  input: ProcedureFactsInput,
  evaluation: FamilyEvaluation,
  limits: DailyUnitLimits,
  lines: CptCodeRef[]
): void {
  const totals = new Map<string, number>();

  for (const line of lines) totals.set(line.code, (totals.get(line.code) ?? 0) + (line.billableUnits ?? 1));

  for (const other of input.context?.otherProcedures ?? []) {
    if (other.procedureId === input.procedureId) continue;
    for (const line of other.codes)
      if (totals.has(line.code)) totals.set(line.code, totals.get(line.code)! + (line.billableUnits ?? 1));
  }

  for (const [code, total] of totals) {
    const limit = limits[code];

    if (!limit) continue;

    if (total > limit.maxUnits) {
      evaluation.findings.push({
        level: 'required',
        scope: codeScope(code),
        evidence: NOTHING_TO_CITE,
        message: `Documented quantity ${total} exceeds the usual daily allowance of ${limit.maxUnits}. Review before billing; the quantity is unchanged.`,
        billingDetail: `Medicare MUE ${code}: ${total}/${limit.maxUnits}, MAI ${limit.adjudicationIndicator}; ${
          input.context?.completeDay ? 'complete day' : 'partial day'
        }.`,
      });
    }
  }
}

export interface CptPairEdit {
  /** CMS Column 1: the comprehensive service. */
  code: string;

  /** CMS Column 2: services bundled into Column 1 unless a permitted exception is documented. */
  bundled: readonly string[];

  /** Indicator 1 allows a documented modifier exception; true alone does not justify billing both. */
  modifierAllowed: boolean;
}

export function checkCodePairs(
  input: ProcedureFactsInput,
  evaluation: FamilyEvaluation,
  edits: readonly CptPairEdit[]
): void {
  const current = input.cptCodes ?? [];

  const lines = [
    ...current,
    ...(input.context?.otherProcedures ?? [])
      .filter((other) => other.procedureId !== input.procedureId)
      .flatMap((other) => other.codes),
  ];

  const isCurrent = (code: string): boolean => current.some((line) => line.code === code);

  for (const edit of edits) {
    if (!lines.some((line) => line.code === edit.code)) continue;
    for (const bundled of edit.bundled) {
      if (!isCurrent(edit.code) && !isCurrent(bundled)) continue;
      const second = lines.filter((line) => line.code === bundled);
      if (!second.length) continue;
      const em = bundled.startsWith('992');
      const hasModifier = second.every((line) =>
        (line.modifier ?? []).some((modifier) =>
          (em
            ? ['25']
            : [
                CPT_MODIFIERS.DistinctService,
                'XE',
                'XP',
                'XS',
                'XU',
                CPT_MODIFIERS.LeftSide,
                CPT_MODIFIERS.RightSide,
                'FA',
                'F1',
                'F2',
                'F3',
                'F4',
                'F5',
                'F6',
                'F7',
                'F8',
                'F9',
              ]
          ).includes(modifier.code)
        )
      );

      // A modifier makes an exception possible; it does not establish clinical independence by itself.
      const conflict = !edit.modifierAllowed || !hasModifier;
      const affected = isCurrent(bundled) ? bundled : edit.code;

      evaluation.findings.push({
        level: conflict ? 'contradiction' : 'bestPractice',
        scope: codeScope(affected),
        evidence: NOTHING_TO_CITE,
        message: conflict
          ? 'Selected procedures require billing review before they can be billed together.'
          : 'Confirm that the selected procedures were separate services.',
        billingDetail: conflict
          ? `NCCI pair ${edit.code} / ${bundled}: ${
              edit.modifierAllowed
                ? 'separate service documentation and an appropriate modifier are required'
                : 'the edit does not allow a modifier exception'
            }.`
          : `NCCI pair ${edit.code} / ${bundled}: verify the documented reason for the modifier exception.`,
      });
    }
  }
}
