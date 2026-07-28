import { describe, expect, it } from 'vitest';
import { PROCEDURE_FAMILIES } from './evaluate';
import {
  CodeAssessmentKind,
  CodeOutcomeKind,
  EvidenceSource,
  FamilyEvaluation,
  Finding,
  ProcedureFactsInput,
  ProcedureFamilyModel,
} from './model.types';
import { findingCode, notAssessedCodes, offeredCandidates, suggestionOf } from './test-support';

const PROBE_NOTES: string[] = [
  '',
  'Procedure performed. Patient tolerated well.',
  'Wound closed and a dressing applied.',
  'Abscess incised and drained; purulent drainage expressed.',
  'Splint applied.',
  'Strapping applied to the ankle.',
  'Unna boot applied to the lower leg.',
  'Cerumen removed from the ear.',
  'Foreign body removed from the hand.',
  'IV fluids infused.',
  'Toradol 60 mg given.',
  'EKG obtained. Rate 82, NSR.',
  'Partial-thickness burn dressed.',
  'Warts frozen with liquid nitrogen.',
  'Catheterization performed; urine obtained.',
  'Anterior epistaxis; packing placed.',
  'Nail plate trephinated; old blood expressed.',
];

const ALL_STRUCTURED_FIELDS = {
  bodySide: 'Left',
  bodySite: 'Arm',
  lengthCm: 3.2,
  repairDepth: 'subcutaneous-layered',
  technique: ['Short Arm Splint'],
  suppliesUsed: ['Fiberglass'],
  infusionStartTime: '14:05',
  infusionStopTime: '15:47',
  patientResponse: 'Tolerated well',
} satisfies ProcedureFactsInput;

const PROBE_INPUTS: ProcedureFactsInput[] = [
  {},
  ...PROBE_NOTES.map((procedureDetails) => ({ procedureDetails })),
  ...PROBE_NOTES.map((procedureDetails) => ({ procedureDetails, bodySide: 'Left', bodySite: 'Arm' })),
  ...PROBE_NOTES.map((procedureDetails) => ({ procedureDetails, ...ALL_STRUCTURED_FIELDS })),
];

function codesTheFamilyKnows(family: ProcedureFamilyModel): string[] {
  const codes = new Set<string>([OUT_OF_FAMILY_CODE]);
  for (const probe of PROBE_INPUTS) {
    const forward = family.suggestCode(probe);
    for (const candidate of offeredCandidates(forward.outcome) ?? []) codes.add(candidate.code);
    const suggestion = suggestionOf(forward);
    if (suggestion) {
      codes.add(suggestion.code);
      for (const addOn of suggestion.addOns ?? []) codes.add(addOn.code);
    }
  }
  return [...codes];
}

interface HarvestedFinding {
  finding: Finding;
  where: string;
}

function harvestFindings(family: ProcedureFamilyModel): HarvestedFinding[] {
  const harvested: HarvestedFinding[] = [];
  const seen = new Set<string>();
  const take = (finding: Finding, where: string): void => {
    const key = `${where.split(' (probe')[0]}|${finding.level}|${finding.message}`;
    if (seen.has(key)) return;
    seen.add(key);
    harvested.push({ finding, where });
  };
  for (const [index, probe] of PROBE_INPUTS.entries()) {
    for (const finding of family.suggestCode(probe).findings) {
      take(finding, `${family.id}.suggestCode (probe ${index})`);
    }
    for (const code of codesTheFamilyKnows(family)) {
      for (const finding of family.defendCodes({ ...probe, cptCodes: [{ code, display: code }] }).findings) {
        take(finding, `${family.id}.defendCodes(${code}) (probe ${index})`);
      }
    }
  }
  return harvested;
}

const FAMILY_CASES = PROCEDURE_FAMILIES.map((family) => [family.id, family] as const);

/** A code no modelled family claims, so the not-assessed path is exercised alongside the rest. */
const OUT_OF_FAMILY_CODE = '99213';

function expectCandidateSetQuality(evaluation: FamilyEvaluation, where: string): void {
  const outcome = evaluation.outcome;
  if (outcome?.kind !== CodeOutcomeKind.Open && outcome?.kind !== CodeOutcomeKind.DeterminedWithAlternates) {
    return;
  }
  const candidates = outcome.kind === CodeOutcomeKind.Open ? outcome.candidates : outcome.alternates;
  const summary = outcome.kind === CodeOutcomeKind.Open ? outcome.summary : outcome.alternatesSummary;
  expect(candidates.length, `${where} set an empty candidate array`).toBeGreaterThan(0);
  expect(
    summary,
    `${where} offered ${candidates.length} candidate(s) with an empty summary — the provider would ` +
      'see a bare list of codes with nothing saying which determinant narrows it.'
  ).toBeTruthy();
  for (const candidate of candidates) {
    expect(candidate.code, `${where} offered a candidate with no code`).toBeTruthy();
    expect(
      candidate.display,
      `${where} offered candidate ${candidate.code} with an empty or undefined display — usually a code ` +
        'that is missing from its family descriptor table.'
    ).toBeTruthy();
    expect(candidate.display, `${where} rendered candidate ${candidate.code} with a missing descriptor`).not.toContain(
      'undefined'
    );
  }
}

describe('every registered family: candidate sets are usable', () => {
  it.each(FAMILY_CASES)('%s returns non-empty, labelled candidates in the forward direction', (id, family) => {
    for (const [index, probe] of PROBE_INPUTS.entries()) {
      expectCandidateSetQuality(family.suggestCode(probe), `${id}.suggestCode (probe ${index})`);
    }
  });

  it.each(FAMILY_CASES)('%s returns non-empty, labelled candidates in the inverse direction', (id, family) => {
    for (const code of codesTheFamilyKnows(family)) {
      for (const [index, probe] of PROBE_INPUTS.entries()) {
        const evaluation = family.defendCodes({ ...probe, cptCodes: [{ code, display: code }] });
        expectCandidateSetQuality(evaluation, `${id}.defendCodes(${code}) (probe ${index})`);
      }
    }
  });
});

describe('every registered family: the not-assessed promise', () => {
  it.each(FAMILY_CASES)('%s reports a code it does not model rather than judging it', (id, family) => {
    const evaluation = family.defendCodes({
      cptCodes: [{ code: OUT_OF_FAMILY_CODE, display: 'Office visit' }],
      procedureDetails: 'Procedure performed.',
    });
    expect(evaluation.codeAssessments.get(OUT_OF_FAMILY_CODE), `${id} judged a code it does not model`).toEqual({
      kind: CodeAssessmentKind.NotAssessed,
    });
  });

  it.each(FAMILY_CASES)('%s gives every selected code exactly one explicit assessment', (id, family) => {
    for (const code of codesTheFamilyKnows(family)) {
      for (const [index, probe] of PROBE_INPUTS.entries()) {
        const evaluation = family.defendCodes({ ...probe, cptCodes: [{ code, display: code }] });
        expect(
          evaluation.codeAssessments.get(code),
          `${id}.defendCodes(${code}) (probe ${index}) did not produce a per-code assessment.`
        ).toBeDefined();
        expect([...evaluation.codeAssessments.keys()]).toEqual([code]);
      }
    }
  });
});

// ── Provenance: a finding that quotes the note says where the quote came from ───

/**
 * What a contradiction is claiming, which decides what provenance it owes:
 *
 * - 'text'       — it asserts what the narrative says ("the note documents an ear wound"), so it owes
 *                  the words it read. A snippet-less accusation is one the provider cannot check
 *                  against their own note.
 * - 'structured' — it asserts what a named form field holds ("the Repair depth field documents a
 *                  layered closure"). There is no prose to quote — the value is a select — so it owes
 *                  the field label instead; the field is on screen beside the finding.
 * - 'absence'    — it is founded on something *not* being documented. Exempt from both, and cannot be
 *                  otherwise: the finding is about text that is not there.
 */
function contradictionBasis(message: string): 'text' | 'structured' | 'absence' {
  if (/does not document|documents none of|documents no |is not selected/.test(message)) return 'absence';
  if (/\bthe [A-Z][^.]*? fields? documents\b/.test(message)) return 'structured';
  if (/the note documents|the note records|documented as/.test(message)) return 'text';
  return 'absence';
}

describe('every registered family: text-derived findings cite their source', () => {
  it.each(FAMILY_CASES)('%s returns usable data for every explicit evidence variant', (_id, family) => {
    for (const { finding, where } of harvestFindings(family)) {
      switch (finding.evidence.source) {
        case EvidenceSource.Text:
          expect(
            finding.evidence.sourceText.trim(),
            `${where} returned text evidence with an empty sourceText for "${finding.message}"`
          ).not.toBe('');
          break;
        case EvidenceSource.Field:
          expect(
            finding.evidence.field.trim(),
            `${where} returned field evidence with an empty field label for "${finding.message}"`
          ).not.toBe('');
          break;
        case EvidenceSource.Absence:
          break;
        default: {
          const exhaustiveCheck: never = finding.evidence;
          expect(exhaustiveCheck).toBeUndefined();
        }
      }
    }
  });

  it.each(FAMILY_CASES)('%s cites the documentation behind every contradiction that quotes it', (_id, family) => {
    for (const { finding, where } of harvestFindings(family)) {
      if (finding.level !== 'contradiction') continue;
      const basis = contradictionBasis(finding.message);
      if (basis === 'absence') continue;
      expect(
        finding.evidence.source,
        `${where} contradicted a selected code by asserting what the documentation holds, with the wrong evidence: ` +
          `"${finding.message}". This is the finding that makes a code unsupported, so it is the one that most ` +
          'needs to say where it read that.'
      ).toBe(basis === 'text' ? EvidenceSource.Text : EvidenceSource.Field);
      if (basis === 'text') {
        expect(finding.evidence.source === EvidenceSource.Text && finding.evidence.sourceText.length > 0).toBe(true);
      }
    }
  });
});

// ── Every missing-element ask says where to record it ──────────────────────────

/**
 * The destinations `whereToDocumentClause` composes: the free-text field by name, a named form field,
 * or the structured diagnosis list. A [D]/[R] finding is a request for documentation, and a request
 * that does not say where the documentation goes is a bare complaint.
 */
const WHERE_TO_RECORD_PATTERN = /Procedure details|\bfields?\b|as a(?:n)? [a-z-]* ?diagnosis|a Technique value/;

/**
 * Findings that ask the provider to *reconcile* two things the note already says, rather than to add
 * something missing. There is no destination to name: both values are already recorded, and which one
 * to change is the provider's call, not the engine's.
 */
function asksToReconcileRatherThanAdd(message: string): boolean {
  return /reconcile|is ambiguous|are ambiguous/.test(message);
}

describe('every registered family: a missing-element finding never lands as a bare complaint', () => {
  it.each(FAMILY_CASES)('%s tells the provider where to record every [D]/[R] element', (_id, family) => {
    for (const { finding, where } of harvestFindings(family)) {
      if (finding.level !== 'determines' && finding.level !== 'required') continue;
      if (asksToReconcileRatherThanAdd(finding.message)) continue;
      expect(
        WHERE_TO_RECORD_PATTERN.test(finding.message),
        `${where} reported a ${finding.level} element with no destination: "${finding.message}". Every ` +
          'missing-element finding names the field to record it in — the provider should never have to ' +
          'guess where the engine wants it.'
      ).toBe(true);
    }
  });
});

// ── Tone: the engine never shops for a code ────────────────────────────────────

/**
 * Phrasings that would turn a documentation check into billing advice. The rule is absolute and it is
 * not a style preference: the engine reports what the documentation supports, and a message that
 * weighs one code's payment against another's is the engine telling a clinician to bill differently.
 *
 * "as documented this supports 10060" is the sanctioned form and deliberately not matched here — it
 * is a statement about the documentation, with no reference to what anything pays.
 */
const PAYMENT_ADVICE_PATTERNS: Array<[RegExp, string]> = [
  [/higher[-\s]?(paying|level|value|code)/i, 'ranks codes by what they pay'],
  [/better[-\s]?paying|more lucrative|pays? (?:more|better|less)/i, 'ranks codes by what they pay'],
  [/upcod|downcod/i, 'names the practice outright'],
  [/reimburs|revenue|maximi[sz]/i, 'frames the finding as a payment outcome'],
  [/you (?:could|should|may|might) (?:bill|code|charge)/i, 'instructs the clinician what to bill'],
  [/consider (?:billing|coding|charging)/i, 'instructs the clinician what to bill'],
  [/instead of (?:billing|coding|charging)/i, 'instructs the clinician what to bill'],
  [/would (?:pay|reimburse)/i, 'frames the finding as a payment outcome'],
];

describe('every registered family: no finding shops for a better-paying code', () => {
  it.each(FAMILY_CASES)('%s keeps every message on documentation, not payment', (_id, family) => {
    for (const { finding, where } of harvestFindings(family)) {
      for (const [pattern, why] of PAYMENT_ADVICE_PATTERNS) {
        expect(
          pattern.test(finding.message),
          `${where} produced a message that ${why}: "${finding.message}". The engine reports what the ` +
            'documentation supports and never advises billing a different code.'
        ).toBe(false);
      }
    }
  });
});

// ── The two directions agree ───────────────────────────────────────────────────

describe('every registered family: suggestCode and defendCodes agree', () => {
  it.each(FAMILY_CASES)('%s never contradicts the code its own forward direction determined', (id, family) => {
    for (const [index, probe] of PROBE_INPUTS.entries()) {
      const forward = family.suggestCode(probe);
      const determined = suggestionOf(forward);
      if (determined === undefined) continue;

      const cptCodes = [
        { code: determined.code, display: determined.display },
        ...(determined.addOns ?? []).map((addOn) => ({ code: addOn.code, display: addOn.display })),
      ];
      const inverse = family.defendCodes({ ...probe, cptCodes });
      const selfContradictions = inverse.findings.filter(
        (finding) =>
          finding.level === 'contradiction' &&
          findingCode(finding) !== undefined &&
          findingCode(finding) !== OUT_OF_FAMILY_CODE
      );
      expect(
        selfContradictions.map((finding) => `${findingCode(finding)}: ${finding.message}`),
        `${id} (probe ${index}) suggested ${determined.code} from these facts and then contradicted it — the two ` +
          'directions read the same facts through the same tables, so one of them is wrong.'
      ).toEqual([]);

      // Entry-level contradictions are deliberately not asserted away: a note whose Site field and
      // text disagree gets that finding whatever code is selected, and it is not a contradiction *of*
      // the suggestion.
      expect(
        notAssessedCodes(inverse),
        `${id} (probe ${index}) declined to assess ${determined.code}, the code it had just determined`
      ).not.toContain(determined.code);
    }
  });
});

// ── Detection: the union is a union ────────────────────────────────────────────

describe('every registered family: the three detection signals stay consistent', () => {
  it.each(FAMILY_CASES)('%s reports detect as exactly the union of the two signals', (id, family) => {
    const detectionProbes: ProcedureFactsInput[] = [
      ...PROBE_INPUTS,
      ...PROBE_INPUTS.flatMap((probe) =>
        [OUT_OF_FAMILY_CODE, ...codesTheFamilyKnows(family)].map((code) => ({
          ...probe,
          cptCodes: [{ code, display: code }],
        }))
      ),
      ...PROCEDURE_FAMILIES.map((other) => ({ procedureType: other.displayName })),
    ];
    for (const [index, probe] of detectionProbes.entries()) {
      const byType = family.detectByProcedureType(probe);
      const byCode = family.detectBySelectedCode(probe);
      expect(
        family.detect(probe),
        `${id}.detect disagreed with its own signals on probe ${index} (byProcedureType=${byType}, ` +
          `bySelectedCode=${byCode}) — detect is the union, and the evaluators rely on that to choose ` +
          'the procedure type over a possibly mis-selected code.'
      ).toBe(byType || byCode);
    }
  });

  it('no two families claim the same id', () => {
    const ids = PROCEDURE_FAMILIES.map((family) => family.id);
    expect(new Set(ids).size, `duplicate family ids in PROCEDURE_FAMILIES: ${JSON.stringify(ids)}`).toBe(ids.length);
  });
});
