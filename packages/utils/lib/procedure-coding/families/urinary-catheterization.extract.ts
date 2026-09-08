import { textFlag, textMention, TOLERANCE_PATTERN } from '../extract';
import { FactValue, ProcedureFactsInput } from '../model.types';

export type UrinaryCatheterType = 'straight' | 'indwelling';

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
