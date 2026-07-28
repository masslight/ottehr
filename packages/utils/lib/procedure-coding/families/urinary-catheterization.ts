import { textFlag, textMention, TOLERANCE_PATTERN } from '../extract';
import { procedureTypeMatchesFamily } from '../family-routing';
import { codeCandidateFromInfo, defendSelectedCodes, TO_DETAILS, whereClauseFor } from '../family-support';
import {
  citing,
  codeScope,
  determinedCode,
  emptyDefenseEvaluation,
  emptySuggestionEvaluation,
  ENTRY_SCOPE,
  FactValue,
  familyDetection,
  FamilyEvaluation,
  NOTHING_TO_CITE,
  openCodeSet,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
} from '../model.types';

export type UrinaryCatheterType = 'straight' | 'indwelling';

interface UrinaryCatheterCodeInfo {
  type: UrinaryCatheterType;
  display: string;
  coverage: string;
}

const URINARY_CATHETER_CODES = {
  straight: '51701',
  indwelling: '51702',
} as const satisfies Record<UrinaryCatheterType, string>;

type UrinaryCatheterCode = (typeof URINARY_CATHETER_CODES)[keyof typeof URINARY_CATHETER_CODES];

const URINARY_CATHETER_CODE_INFO = {
  [URINARY_CATHETER_CODES.straight]: {
    type: 'straight',
    display: 'Insertion of non-indwelling bladder catheter (eg, straight catheterization for residual urine)',
    coverage: 'a straight (in-and-out) catheterization',
  },
  [URINARY_CATHETER_CODES.indwelling]: {
    type: 'indwelling',
    display: 'Insertion of temporary indwelling bladder catheter; simple (eg, Foley)',
    coverage: 'an indwelling (eg, Foley) catheter insertion',
  },
} as const satisfies Record<UrinaryCatheterCode, UrinaryCatheterCodeInfo>;

export function isUrinaryCatheterizationCode(code: string): code is UrinaryCatheterCode {
  return code in URINARY_CATHETER_CODE_INFO;
}

const codeCandidate = codeCandidateFromInfo(URINARY_CATHETER_CODE_INFO);

const TYPE_LABELS: Record<UrinaryCatheterType, string> = {
  straight: 'a straight (in-and-out) catheterization',
  indwelling: 'an indwelling (Foley) catheter',
};

const CODE_FOR_TYPE = URINARY_CATHETER_CODES;

export interface UrinaryCatheterizationFacts {
  straightDocumented?: FactValue<true>;
  indwellingDocumented?: FactValue<true>;
  catheterType?: FactValue<UrinaryCatheterType>;
  typeConflict: boolean;
  sizeDocumented?: FactValue<true>;
  indicationDocumented?: FactValue<true>;
  outcomeDocumented: boolean;
}

const STRAIGHT_PATTERN =
  /straight\s+cath\w*|in[-\s]?and[-\s]?out|\bI\s*&\s*O\s+cath\w*|red\s+rubber|non[-\s]?indwelling/i;
const INDWELLING_PATTERN =
  /indwelling|foley|retention\s+cath\w*|balloon\s+(?:inflated|filled)|catheter\s+(?:left\s+in\s+place|secured\s+to)/i;

const SIZE_PATTERN = /\d{1,2}\s*(?:fr\b|french)/i;
const INDICATION_PATTERN =
  /urinary\s+retention|unable\s+to\s+void|obtain\s+(?:a\s+)?(?:urine\s+)?(?:specimen|sample)|urine\s+(?:specimen|sample)|urinalysis|\bUA\b|(?:urine\s+)?culture|residual\s+urine|bladder\s+(?:distension|distention|scan)/i;
const OUTCOME_PATTERN = new RegExp(
  [
    String.raw`urine\s+(?:obtained|returned|drained|collected|expressed)`,
    String.raw`(?:clear|yellow|amber|dark|cloudy|bloody)\s+urine`,
    String.raw`\d+\s*(?:mL|cc)\b[^.;\n]{0,20}urine`,
    TOLERANCE_PATTERN.source,
  ].join('|'),
  'i'
);

export function extractUrinaryCatheterizationFacts(input: ProcedureFactsInput): UrinaryCatheterizationFacts {
  const text = input.procedureDetails ?? '';

  const straightDocumented = textFlag(text, STRAIGHT_PATTERN);
  const indwellingDocumented = textFlag(text, INDWELLING_PATTERN);
  const typeConflict = straightDocumented !== undefined && indwellingDocumented !== undefined;

  let catheterType: FactValue<UrinaryCatheterType> | undefined;
  if (!typeConflict && straightDocumented) {
    catheterType = { value: 'straight', evidence: straightDocumented.evidence };
  } else if (!typeConflict && indwellingDocumented) {
    catheterType = { value: 'indwelling', evidence: indwellingDocumented.evidence };
  }

  return {
    straightDocumented,
    indwellingDocumented,
    catheterType,
    typeConflict,
    sizeDocumented: textMention(text, SIZE_PATTERN),
    indicationDocumented: textMention(text, INDICATION_PATTERN),
    outcomeDocumented: Boolean(input.patientResponse?.trim()) || textMention(text, OUTCOME_PATTERN) !== undefined,
  };
}

const TYPE_ASK_CLAUSE = 'the catheter type selects the code (51701 straight/in-and-out; 51702 indwelling, e.g. Foley)';

const TYPE_CONFLICT_CLAUSE =
  'the note documents both straight-catheterization and indwelling-catheter language — please reconcile them';

const WHERE_TO_DOCUMENT = {
  type: { destination: TO_DETAILS, example: '"straight catheterization" or "Foley catheter placed"' },
  size: { destination: TO_DETAILS, example: '"8 Fr catheter"' },
  indication: { destination: TO_DETAILS, example: '"unable to void; bladder distended"' },
  outcome: { destination: TO_DETAILS, example: '"300 mL clear yellow urine obtained; tolerated well"' },
} satisfies Record<string, WhereToDocument>;

const whereClause = whereClauseFor(WHERE_TO_DOCUMENT);

function suggestUrinaryCatheterizationCode(input: ProcedureFactsInput): FamilyEvaluation {
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
      [codeCandidate(URINARY_CATHETER_CODES.straight), codeCandidate(URINARY_CATHETER_CODES.indwelling)],
      '51701–51702 — the catheter type (straight vs indwelling) determines the code'
    );
    return evaluation;
  }

  const type = facts.catheterType.value;
  const code = CODE_FOR_TYPE[type];
  evaluation.outcome = determinedCode({
    code,
    display: codeCandidate(code).display,
    justification: `Urinary catheterization — ${TYPE_LABELS[type]} documented → ${code}.`,
  });
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendUrinaryCatheterizationCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractUrinaryCatheterizationFacts(input);
  const evaluation = emptyDefenseEvaluation();
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const documentedType = facts.catheterType?.value;

  defendSelectedCodes(
    input,
    evaluation,
    (code) => (isUrinaryCatheterizationCode(code) ? URINARY_CATHETER_CODE_INFO[code] : undefined),
    (info, code, codeFindings) => {
      // Catheter type: the [D] that selects within the family — mismatch is a hard [C] both ways;
      // an ambiguous note gets the reconcile ask, never a guessed contradiction.
      if (facts.typeConflict) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The catheter type is ambiguous for ${code} — ${TYPE_CONFLICT_CLAUSE}.`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (documentedType === undefined) {
        codeFindings.push({
          level: 'determines',
          scope: codeScope(code),
          message: `The catheter type is not documented for ${code} — ${TYPE_ASK_CLAUSE}. ${whereClause('type')}`,
          evidence: NOTHING_TO_CITE,
        });
      } else if (documentedType !== info.type) {
        codeFindings.push({
          level: 'contradiction',
          scope: codeScope(code),
          message: `${code} covers ${info.coverage}, but the note documents ${TYPE_LABELS[documentedType]} — as documented this supports ${CODE_FOR_TYPE[documentedType]}.`,
          evidence: citing(facts.catheterType),
        });
      }

      // The French size is a [B], not an [R]: neither 51701 nor 51702 bands on it, and nothing in
      // either descriptor names it, so a note without it is still a defendable note. The indication
      // has the same [B] posture: it improves the clinical record but is not needed to justify
      // 51701 vs 51702. The outcome stays [R] as the
      // evidence that the catheterization was completed.
      if (!facts.sizeDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The catheter size is not documented for ${code} — it does not affect the code, but a complete note records the French size. ${whereClause(
            'size'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.indicationDocumented) {
        codeFindings.push({
          level: 'bestPractice',
          scope: codeScope(code),
          message: `The indication is not documented for ${code} — a complete note says why the catheterization was performed. ${whereClause(
            'indication'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
      if (!facts.outcomeDocumented) {
        codeFindings.push({
          level: 'required',
          scope: codeScope(code),
          message: `The outcome is not documented for ${code} — record whether urine was obtained and how the patient tolerated it. ${whereClause(
            'outcome'
          )}`,
          evidence: NOTHING_TO_CITE,
        });
      }
    }
  );

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

export const urinaryCatheterizationFamily: ProcedureFamilyModel = {
  id: 'urinary-catheterization',
  displayName: 'Urinary Catheterization',
  structuredFieldsFor: () => [],
  ...familyDetection(
    (input) => procedureTypeMatchesFamily('urinary-catheterization', input.procedureType),
    (input) => (input.cptCodes ?? []).some((c) => isUrinaryCatheterizationCode(c.code))
  ),
  suggestCode: suggestUrinaryCatheterizationCode,
  defendCodes: defendUrinaryCatheterizationCodes,
};
