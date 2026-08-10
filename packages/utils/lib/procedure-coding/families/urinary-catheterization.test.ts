import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { injectionInfusionFamily } from './injection-infusion';
import { extractUrinaryCatheterizationFacts, urinaryCatheterizationFamily } from './urinary-catheterization';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Urinary Catheterization', ...overrides };
}

const STRAIGHT_TEXT =
  'Unable to void; bladder distended. 8 Fr straight catheterization performed; 300 mL clear yellow urine obtained. Tolerated well.';
const INDWELLING_TEXT =
  'Urinary retention. 14 Fr Foley catheter inserted, balloon inflated; clear yellow urine returned. Tolerated well.';

function hasFinding(
  findings: Finding[],
  level: Finding['level'],
  messagePart: string | RegExp,
  cptCode?: string
): boolean {
  return findings.some(
    (f) =>
      f.level === level &&
      (typeof messagePart === 'string' ? f.message.includes(messagePart) : messagePart.test(f.message)) &&
      (cptCode === undefined || f.cptCode === cptCode)
  );
}

describe('urinary-catheterization detection', () => {
  it('detects the product procedure type display and slug', () => {
    expect(detectProcedureFamily({ procedureType: 'Urinary Catheterization' })?.id).toBe('urinary-catheterization');
    expect(detectProcedureFamily({ procedureType: 'urinary-catheterization' })?.id).toBe('urinary-catheterization');
  });

  it.each(['51701', '51702'])('detects from the selected %s alone', (code) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Bladder catheter' }] })?.id).toBe(
      'urinary-catheterization'
    );
  });

  it('stays disjoint from the injection/infusion and IV-catheter families in both directions', () => {
    expect(urinaryCatheterizationFamily.detect({ procedureType: 'IV Fluid Administration' })).toBe(false);
    expect(urinaryCatheterizationFamily.detect({ procedureType: 'Intravenous (IV) Catheter Placement' })).toBe(false);
    expect(injectionInfusionFamily.detect({ procedureType: 'Urinary Catheterization' })).toBe(false);
  });
});

describe('urinary catheter type extraction', () => {
  it.each([
    ['straight catheterization', 'straight'],
    ['in-and-out catheterization performed', 'straight'],
    ['in and out cath with red rubber catheter', 'straight'],
    ['Foley catheter placed', 'indwelling'],
    ['indwelling catheter inserted and secured to the leg', 'indwelling'],
    ['retention catheter placed', 'indwelling'],
    ['balloon inflated with 10 mL sterile water', 'indwelling'],
  ])('"%s" ⇒ %s', (details, expected) => {
    const facts = extractUrinaryCatheterizationFacts(input({ procedureDetails: details }));
    expect(facts.catheterType?.value).toBe(expected);
  });

  it('"urinary retention" alone is an indication, never indwelling-type evidence', () => {
    const facts = extractUrinaryCatheterizationFacts(
      input({ procedureDetails: 'Acute urinary retention; catheterization performed.' })
    );
    expect(facts.indwellingDocumented).toBeUndefined();
    expect(facts.catheterType).toBeUndefined();
    expect(facts.indicationDocumented?.value).toBe(true);
  });

  it('both vocabularies documented ⇒ conflict, no type pinned', () => {
    const facts = extractUrinaryCatheterizationFacts(
      input({ procedureDetails: 'Straight cath attempted, then Foley catheter placed.' })
    );
    expect(facts.typeConflict).toBe(true);
    expect(facts.catheterType).toBeUndefined();
  });

  it('the structured Patient response field counts as outcome evidence', () => {
    const facts = extractUrinaryCatheterizationFacts(
      input({ patientResponse: 'Tolerated Well', procedureDetails: '' })
    );
    expect(facts.outcomeDocumented).toBe(true);
  });
});

describe('urinary-catheterization forward: the type determines the code', () => {
  it('straight catheterization documented ⇒ 51701', () => {
    const result = urinaryCatheterizationFamily.suggestCode(input({ procedureDetails: STRAIGHT_TEXT }));
    expect(result.suggestion?.code).toBe('51701');
    expect(result.suggestion?.justification).toContain('straight');
  });

  it('indwelling (Foley) documented ⇒ 51702', () => {
    const result = urinaryCatheterizationFamily.suggestCode(input({ procedureDetails: INDWELLING_TEXT }));
    expect(result.suggestion?.code).toBe('51702');
    expect(result.suggestion?.justification).toContain('indwelling');
  });

  it('type missing ⇒ [D] ask, both open candidates, and the compact summary line', () => {
    const result = urinaryCatheterizationFamily.suggestCode(
      input({ procedureDetails: 'Catheterization performed; urine obtained.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'catheter type is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['51701', '51702']);
    expect(result.openCandidatesSummary).toBe(
      '51701–51702 — the catheter type (straight vs indwelling) determines the code'
    );
  });

  it('conflicting type language ⇒ reconcile ask, never a guess', () => {
    const result = urinaryCatheterizationFamily.suggestCode(
      input({ procedureDetails: 'Straight cath attempted, then Foley catheter placed.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'reconcile')).toBe(true);
  });
});

describe('urinary-catheterization inverse: pinned contradiction cases (both directions)', () => {
  it('51701 selected with an indwelling Foley documented ⇒ [C] pointing at 51702, citing the note', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51701', display: 'Non-indwelling bladder catheter' }],
        procedureDetails: INDWELLING_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '51701');
    expect(contradiction?.message).toContain('51701 covers a straight (in-and-out) catheterization');
    expect(contradiction?.message).toContain('supports 51702');
    expect(contradiction?.sourceText).toContain('Foley');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('51702 selected with a straight catheterization documented ⇒ [C] pointing at 51701 (the reverse direction)', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51702', display: 'Temporary indwelling bladder catheter; simple' }],
        procedureDetails: STRAIGHT_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'supports 51701', '51702')).toBe(true);
  });

  it('type missing ⇒ [D] ask per code, not a contradiction', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51702', display: 'Temporary indwelling bladder catheter; simple' }],
        procedureDetails: 'Catheterization performed; urine obtained.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'catheter type is not documented', '51702')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('conflicting type language ⇒ [D] reconcile ask per code, not a contradiction', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51702', display: 'Temporary indwelling bladder catheter; simple' }],
        procedureDetails: 'Straight cath attempted, then Foley catheter placed.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'reconcile', '51702')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('urinary-catheterization inverse: [R] elements', () => {
  it('size, indication, and outcome each missing ⇒ individual [R] findings', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51701', display: 'Non-indwelling bladder catheter' }],
        procedureDetails: 'Straight catheterization performed.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'catheter size is not documented', '51701')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'indication is not documented', '51701')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'outcome is not documented', '51701')).toBe(true);
  });

  it('"no urine obtained" still documents the outcome (result language)', () => {
    const facts = extractUrinaryCatheterizationFacts(
      input({ procedureDetails: 'Straight cath performed; no urine obtained.' })
    );
    expect(facts.outcomeDocumented).toBe(true);
  });
});

describe('urinary-catheterization inverse: supported state and scope honesty', () => {
  it('fully documented straight cath supports 51701 with no [D]/[R]/[C] findings', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [{ code: '51701', display: 'Non-indwelling bladder catheter' }],
        procedureDetails: STRAIGHT_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['51701']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('out-of-family codes (e.g. 51703 complicated) are listed not assessed, never guessed', () => {
    const result = urinaryCatheterizationFamily.defendCodes(
      input({
        cptCodes: [
          { code: '51702', display: 'Temporary indwelling bladder catheter; simple' },
          { code: '51703', display: 'Indwelling bladder catheter; complicated' },
        ],
        procedureDetails: INDWELLING_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['51702']);
    expect(result.notAssessedCodes).toEqual(['51703']);
  });
});
