// Diagnostic EKG coding model — functional requirements §6.7.
// 93000 (complete: tracing + interpretation & report), 93005 (tracing only), 93010
// (interpretation & report only). The documented interpretation elements — rate, rhythm,
// axis, intervals, ST-T assessment, and an impression — determine which component the
// documentation supports; each is its own [R] for 93000/93010. Other EKG codes (e.g.
// rhythm strips 93040-93042) are outside scope and are reported "not assessed", never guessed.

import { textMention } from '../extract';
import {
  CodeCandidate,
  emptyFamilyEvaluation,
  FactValue,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
  WhereToDocument,
  whereToDocumentClause,
} from '../model.types';

// ── Codes ──────────────────────────────────────────────────────────────────────

const EKG_CODE_DISPLAYS: Record<string, string> = {
  '93000': 'Electrocardiogram, routine ECG with at least 12 leads; with interpretation and report',
  '93005': 'Electrocardiogram, routine ECG with at least 12 leads; tracing only, without interpretation and report',
  '93010': 'Electrocardiogram, routine ECG with at least 12 leads; interpretation and report only',
};

export function isEkgCode(code: string): boolean {
  return EKG_CODE_DISPLAYS[code] !== undefined;
}

function codeCandidate(code: string): CodeCandidate {
  return { code, display: `${code} — ${EKG_CODE_DISPLAYS[code]}` };
}

/** The codes whose defense requires the full interpretation (the "interpretation & report" component). */
const INTERPRETATION_CODES = ['93000', '93010'];

// ── Interpretation elements ────────────────────────────────────────────────────

export type EkgInterpretationElement = 'rate' | 'rhythm' | 'axis' | 'intervals' | 'st-t' | 'impression';

// All element patterns are matched unguarded (textMention): a negative statement like
// "no acute ST-T changes" is exactly the documentation being looked for.
const ELEMENT_TABLE: Array<{
  element: EkgInterpretationElement;
  label: string;
  pattern: RegExp;
  example: string;
}> = [
  {
    element: 'rate',
    label: 'rate',
    pattern: /\b\d{2,3}\s*bpm\b|\b(?:heart\s+)?rate:?\s*(?:of\s+)?\d{2,3}\b|\bHR:?\s*\d{2,3}\b/i,
    example: '"rate 82"',
  },
  {
    element: 'rhythm',
    label: 'rhythm',
    pattern:
      /\bNSR\b|normal\s+sinus(?:\s+rhythm)?|sinus\s+(?:rhythm|tachy\w*|brady\w*|arrhythmi\w*)|a(?:trial)?[-\s]?fib\w*|atrial\s+flutter|\bSVT\b|junctional\s+rhythm|ventricular\s+(?:tachy\w*|rhythm)|paced\s+rhythm/i,
    example: '"normal sinus rhythm"',
  },
  { element: 'axis', label: 'axis', pattern: /\baxis\b|\bLAD\b|\bRAD\b/i, example: '"normal axis"' },
  {
    element: 'intervals',
    label: 'intervals (PR/QRS/QTc)',
    pattern: /\bPR\b|\bQRS\b|\bQTc?\b|\bintervals?\b/i,
    example: '"PR 160, QRS 88, QTc 410 ms"',
  },
  {
    element: 'st-t',
    label: 'ST-T assessment',
    pattern: /\bST[-\s]?(?:T\b|segments?\b|elevation|depression|changes?)|\bT[-\s]?waves?\b|\bTWI\b/i,
    example: '"no acute ST-T changes"',
  },
  {
    element: 'impression',
    label: 'impression',
    pattern:
      /\bimpression\b|normal\s+(?:EKG|ECG|electrocardiogram|tracing|study)|abnormal\s+(?:EKG|ECG|electrocardiogram)|no\s+acute\s+(?:ischemi\w*|infarct\w*|process|findings)|within\s+normal\s+limits|nonspecific\s+(?:changes|findings)|consistent\s+with\s+ischemi\w*/i,
    example: '"Impression: normal EKG"',
  },
];

const FULL_INTERPRETATION_MENU = 'rate, rhythm, axis, intervals, ST-T assessment, and an impression';

// ── Facts schema and extraction ────────────────────────────────────────────────

export interface EkgFacts {
  /** Interpretation elements documented in the text, keyed by element. */
  elements: Partial<Record<EkgInterpretationElement, FactValue<true>>>;
  /** Indication: a structured diagnosis, or indication language in the text. */
  indicationDocumented?: FactValue<true>;
  /** Comparison to a prior tracing ("compared to prior" / "no prior available" both count). */
  comparisonDocumented?: FactValue<true>;
  /** The tracing was obtained outside the practice ("over-read", "tracing obtained at …"). */
  externalTracingDocumented?: FactValue<true>;
}

const INDICATION_PATTERN =
  /chest\s+pain|palpitat\w*|syncope|dizz\w*|shortness\s+of\s+breath|\bSOB\b|pre-?op\w*|\bindication:?\b/i;
const COMPARISON_PATTERN =
  /compar(?:ed|ison)\b|prior\s+(?:EKG|ECG|tracing)|previous\s+(?:EKG|ECG|tracing)|no\s+prior(?:\s+(?:EKG|ECG|tracing))?\s+(?:available|for\s+comparison)|baseline\s+(?:EKG|ECG)/i;
// Signals that the interpreted tracing was obtained externally/previously, so the documentation
// supports the interpretation & report component only (93010), not the complete service.
const EXTERNAL_TRACING_PATTERN =
  /\bover-?read\b|tracing\s+(?:was\s+)?(?:obtained|performed|done|recorded)\s+(?:at|by|elsewhere|outside|previously)|interpretation\s+(?:and|&)\s+report\s+only/i;

/** Deterministic EKG fact extraction: structured diagnoses first, then details-text patterns. */
export function extractEkgFacts(input: ProcedureFactsInput): EkgFacts {
  const text = input.procedureDetails ?? '';

  const elements: EkgFacts['elements'] = {};
  for (const { element, pattern } of ELEMENT_TABLE) {
    const found = textMention(text, pattern);
    if (found) elements[element] = found;
  }

  return {
    elements,
    indicationDocumented:
      (input.diagnoses ?? []).length > 0
        ? { value: true, confidence: 'structured' }
        : textMention(text, INDICATION_PATTERN),
    comparisonDocumented: textMention(text, COMPARISON_PATTERN),
    externalTracingDocumented: textMention(text, EXTERNAL_TRACING_PATTERN),
  };
}

function missingElements(facts: EkgFacts): typeof ELEMENT_TABLE {
  return ELEMENT_TABLE.filter(({ element }) => facts.elements[element] === undefined);
}

function documentedElementLabels(facts: EkgFacts): string {
  return ELEMENT_TABLE.filter(({ element }) => facts.elements[element] !== undefined)
    .map(({ label }) => label)
    .join(', ');
}

// ── Where each missing element belongs on the procedure form ───────────────────
// Form-field labels as they appear on the Document Procedure page.

const DETAILS_FIELD_LABEL = 'Procedure details';
const TO_DETAILS = `to ${DETAILS_FIELD_LABEL}`;

const WHERE_TO_DOCUMENT = {
  interpretation: {
    destination: TO_DETAILS,
    example:
      '"Rate 82, NSR, normal axis, PR 160 / QRS 88 / QTc 410 ms, no acute ST-T changes. Impression: normal EKG."',
  },
  indication: {
    destination: `as a structured diagnosis, or describe the indication in ${DETAILS_FIELD_LABEL}`,
    example: '"chest pain"',
  },
  comparison: { destination: TO_DETAILS, example: '"compared to prior EKG — no change" or "no prior available"' },
} satisfies Record<string, WhereToDocument>;

function whereClause(element: keyof typeof WHERE_TO_DOCUMENT, verb?: string): string {
  return whereToDocumentClause(WHERE_TO_DOCUMENT[element], verb);
}

/** The per-element [R] finding: each missing interpretation element is reported individually. */
function missingElementFinding(entry: (typeof ELEMENT_TABLE)[number], code: string): Finding {
  return {
    level: 'required',
    cptCode: code,
    message: `The interpretation's ${entry.label} is not documented for ${code} — a complete interpretation & report records ${FULL_INTERPRETATION_MENU}. Add it ${TO_DETAILS}, e.g. ${entry.example}.`,
  };
}

// ── Forward: facts → code ──────────────────────────────────────────────────────

function suggestEkgCode(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings } = evaluation;
  const missing = missingElements(facts);

  // No interpretation documented: which component the documentation supports is genuinely
  // open, so ask rather than default to the tracing-only code.
  if (missing.length === ELEMENT_TABLE.length) {
    findings.push({
      level: 'determines',
      message: `No interpretation elements are documented — they determine which EKG component the documentation supports: 93000 covers the tracing plus the interpretation & report, 93005 the tracing only. ${whereClause(
        'interpretation',
        'Add the interpretation'
      )}`,
    });
    evaluation.openCandidates = ['93000', '93005', '93010'].map(codeCandidate);
    return evaluation;
  }

  // The tracing was obtained externally/previously ("over-read"): the documentation supports
  // the interpretation & report of the existing tracing (93010), not the complete service.
  const external = facts.externalTracingDocumented !== undefined;
  const code = external ? '93010' : '93000';

  if (missing.length === 0) {
    evaluation.suggestion = {
      code,
      display: codeCandidate(code).display,
      justification: external
        ? `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010.`
        : `A full interpretation is documented (${FULL_INTERPRETATION_MENU}) — the practice performs the tracing in the office, so the documentation supports the complete service → 93000.`,
    };
    return evaluation;
  }

  // Partial interpretation: the provider is interpreting, so the interpretation component's
  // code is the supported direction — with each missing element asked for individually.
  evaluation.suggestion = {
    code,
    display: codeCandidate(code).display,
    justification: external
      ? `An interpretation is documented (${documentedElementLabels(
          facts
        )}) of an externally-obtained tracing — the documentation supports the interpretation & report of the existing tracing → 93010; the missing interpretation elements are listed below.`
      : `An interpretation is documented (${documentedElementLabels(
          facts
        )}) — with the in-office tracing that supports the complete service → 93000; the missing interpretation elements are listed below.`,
  };
  for (const entry of missing) {
    findings.push(missingElementFinding(entry, code));
  }
  return evaluation;
}

// ── Inverse: selected codes → gaps and contradictions ──────────────────────────

function defendEkgCodes(input: ProcedureFactsInput): FamilyEvaluation {
  const facts = extractEkgFacts(input);
  const evaluation = emptyFamilyEvaluation();
  const { findings, supportedCodes, notAssessedCodes } = evaluation;
  const selected = input.cptCodes ?? [];
  if (selected.length === 0) return evaluation;

  const selectedCodes = selected.map((c) => c.code);
  const missing = missingElements(facts);
  const inScopeSelected = selected.filter((c) => isEkgCode(c.code));

  for (const selectedCode of selected) {
    const code = selectedCode.code;
    if (!isEkgCode(code)) {
      notAssessedCodes.push(code);
      continue;
    }
    const codeFindings: Finding[] = [];

    // 93000 already includes both components — a component code alongside it double-bills.
    if (code !== '93000' && selectedCodes.includes('93000')) {
      const component = code === '93005' ? 'the tracing' : 'the interpretation & report';
      codeFindings.push({
        level: 'contradiction',
        cptCode: code,
        message: `${code} bills ${component} only, but 93000 is also selected — 93000 already covers the tracing plus the interpretation & report, so adding ${code} double-bills that component.`,
      });
    }

    // The interpretation & report component: each missing element is its own [R].
    if (INTERPRETATION_CODES.includes(code)) {
      for (const entry of missing) {
        codeFindings.push(missingElementFinding(entry, code));
      }
    }

    // Mismatch hint ([C]-lite per §6.7, rendered as a best practice): a full interpretation
    // with the tracing-only code selected suggests the complete service was performed.
    if (code === '93005' && missing.length === 0) {
      codeFindings.push({
        level: 'bestPractice',
        cptCode: code,
        message: `The note documents a full interpretation (${FULL_INTERPRETATION_MENU}) — 93005 bills the tracing only; 93000 covers the tracing plus the interpretation & report.`,
        sourceText: facts.elements.impression?.sourceText,
        confidence: facts.elements.impression?.confidence,
      });
    }

    if (!codeFindings.some((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')) {
      supportedCodes.push(code);
    }
    findings.push(...codeFindings);
  }

  if (inScopeSelected.length > 0) {
    // Entry-level best practices, emitted once per entry.
    if (!facts.indicationDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `The indication for the EKG is not documented. ${whereClause('indication', 'Record it')}`,
      });
    }
    if (!facts.comparisonDocumented) {
      findings.push({
        level: 'bestPractice',
        message: `Comparison to a prior tracing is not documented — note the comparison, or that no prior is available. ${whereClause(
          'comparison',
          'Add it'
        )}`,
      });
    }
  }

  return evaluation;
}

// ── Family model ───────────────────────────────────────────────────────────────

// Matches the product procedure type "EKG" (and its "ekg" code slug) plus freehand ECG entries.
const EKG_TYPE_PATTERN = /\bekg\b|\becg\b|electrocardiogram/i;

export const ekgFamily: ProcedureFamilyModel = {
  id: 'ekg',
  displayName: 'Diagnostic EKG',
  detect(input: ProcedureFactsInput): boolean {
    const typeMatches = EKG_TYPE_PATTERN.test(input.procedureType ?? '');
    const codeMatches = (input.cptCodes ?? []).some((c) => isEkgCode(c.code));
    return typeMatches || codeMatches;
  },
  extractFacts: extractEkgFacts,
  suggestCode: suggestEkgCode,
  defendCodes: defendEkgCodes,
};
