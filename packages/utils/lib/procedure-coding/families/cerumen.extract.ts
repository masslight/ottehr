import { lateralityDocumented, techniqueOrTextFlag, textFlag, textMention, TM_INTACT_PATTERN } from '../extract';
import { DIAGNOSIS_FIELD_LABEL, SIDE_FIELD_LABEL } from '../family-support';
import { FactValue, fieldEvidence, ProcedureFactsInput } from '../model.types';

export interface CerumenFacts {
  instrumentationDocumented?: FactValue<true>;
  irrigationDocumented?: FactValue<true>;
  impactionDocumented?: FactValue<true>;
  impactionDeniedDocumented?: FactValue<true>;
  bilateralDocumented?: FactValue<true>;
  postExamDocumented?: FactValue<true>;
  lateralityDocumented: boolean;
}

const INSTRUMENTATION_PATTERN =
  /curett?(?:e|es|age|ed)\b|cerumen\s+(?:loop|spoon|hook)|wire\s+loop|micro[-\s]?suction\w*|suction\w*[^.;\n]{0,20}(?:cerumen|wax|canal|\bear\b)|(?:cerumen|wax|canal)[^.;\n]{0,20}suction(?:ed|ing)?\b|forceps|alligator|\binstrumentation\b/i;

const IRRIGATION_PATTERN = /irrigat\w*|lavage|flush\w*|syring(?:e|ed|ing)\b|water\s*pik|rins\w*/i;

const IMPACTION_TEXT_PATTERN = /impact(?:ed|ion)\b/i;

const IMPACTION_DENIED_PATTERN =
  /\b(?:no|not|without|w\/o|denies|denied)\b[^.;\n]{0,24}?impact(?:ed|ion)\b|impact(?:ed|ion)\b[^.;\n]{0,16}?\b(?:absent|not\s+(?:present|seen|noted|appreciated))\b|non-?impacted/i;

const POST_EXAM_PATTERN = new RegExp(
  [
    String.raw`canals?\s+(?:is\s+|was\s+|are\s+|were\s+|now\s+)?clear`,
    String.raw`clear\s+(?:external\s+)?(?:auditory\s+)?canals?\b`,
    TM_INTACT_PATTERN.source,
  ].join('|'),
  'i'
);

const IMPACTED_CERUMEN_DX_PATTERN = /^H61\.?2/i;
const BILATERAL_SIDE_PATTERN = /bilateral|both/i;

const BILATERAL_TEXT_PATTERN =
  /bilateral(?:ly)?\b|both\s+(?:ears?|canals?)\s+(?:\w+\s+){0,2}?(?:irrigated|lavaged|flushed|curetted|suctioned)|(?:irrigated|lavaged|flushed|curetted|suctioned|removed)\s+(?:\w+\s+){0,3}?both\s+(?:ears?|canals?)/i;

function extractBilateral(input: ProcedureFactsInput, text: string): FactValue<true> | undefined {
  if (input.bodySide && BILATERAL_SIDE_PATTERN.test(input.bodySide)) {
    return { value: true, evidence: fieldEvidence(SIDE_FIELD_LABEL) };
  }
  return textFlag(text, BILATERAL_TEXT_PATTERN);
}

export function extractCerumenFacts(input: ProcedureFactsInput): CerumenFacts {
  const text = input.procedureDetails ?? '';
  const impactedDx = (input.diagnoses ?? []).some(
    (diagnosis) =>
      IMPACTED_CERUMEN_DX_PATTERN.test(diagnosis.code) ||
      /impacted\s+cerumen|cerumen\s+impaction/i.test(diagnosis.display)
  );

  return {
    instrumentationDocumented: techniqueOrTextFlag(input, text, INSTRUMENTATION_PATTERN),
    irrigationDocumented: techniqueOrTextFlag(input, text, IRRIGATION_PATTERN),
    impactionDocumented: impactedDx
      ? { value: true, evidence: fieldEvidence(DIAGNOSIS_FIELD_LABEL) }
      : textFlag(text, IMPACTION_TEXT_PATTERN),
    impactionDeniedDocumented: textMention(text, IMPACTION_DENIED_PATTERN),
    bilateralDocumented: extractBilateral(input, text),
    postExamDocumented: textFlag(text, POST_EXAM_PATTERN),
    lateralityDocumented: lateralityDocumented(input, text),
  };
}
