import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { foreignBodyFamily } from './foreign-body';
import { extractLesionDestructionFacts, lesionDestructionFamily } from './lesion-destruction';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Wart Treatment (Cryotherapy with Liquid Nitrogen', ...overrides };
}

const FULLY_DOCUMENTED_TEXT =
  'Liquid nitrogen applied to 12 plantar warts on the left foot, two freeze-thaw cycles each.';

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

describe('lesion-destruction detection', () => {
  it('detects the product procedure type display and slug', () => {
    expect(detectProcedureFamily({ procedureType: 'Wart Treatment (Cryotherapy with Liquid Nitrogen' })?.id).toBe(
      'lesion-destruction'
    );
    expect(detectProcedureFamily({ procedureType: 'wart-treatment' })?.id).toBe('lesion-destruction');
  });

  it('detects the 17110 CPT descriptor type shape', () => {
    expect(
      detectProcedureFamily({
        procedureType:
          'Destruction (eg, laser surgery, electrosurgery, cryosurgery, chemosurgery, surgical curettement), of benign lesions other than skin tags or cutaneous vascular proliferative lesions; up to 14 lesions',
      })?.id
    ).toBe('lesion-destruction');
  });

  it.each(['17110', '17111'])('detects from the selected %s alone', (code) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Destruction of benign lesions' }] })?.id).toBe(
      'lesion-destruction'
    );
  });

  it('tick/insect removal stays foreign-body vocabulary — no collision in either direction', () => {
    expect(lesionDestructionFamily.detect({ procedureType: 'Tick or Insect Removal' })).toBe(false);
    expect(detectProcedureFamily({ procedureType: 'Tick or Insect Removal' })?.id).toBe('foreign-body');
    expect(foreignBodyFamily.detect({ procedureType: 'Wart Treatment (Cryotherapy with Liquid Nitrogen' })).toBe(false);
  });
});

describe('lesion count extraction', () => {
  it.each([
    ['count then word', '12 lesions treated with liquid nitrogen.', 12],
    ['count with adjectives', '12 plantar warts frozen.', 12],
    ['word then x-count', 'Warts x12 treated with LN2.', 12],
    ['count line', 'Lesion count: 15. All treated.', 15],
    ['bare x-count', 'Cryotherapy applied x12.', 12],
    ['single lesion', 'A single wart on the left heel frozen.', 1],
    ['verruca vocabulary', '16 verrucae treated.', 16],
  ])('parses %s', (_label, details, expected) => {
    const facts = extractLesionDestructionFacts(input({ procedureDetails: details }));
    expect(facts.lesionCount?.value).toBe(expected);
    expect(facts.lesionCount?.sourceText).toBeDefined();
  });

  it('does not read lesion sizes or wound dimensions as counts', () => {
    expect(
      extractLesionDestructionFacts(input({ procedureDetails: 'A 2 cm lesion frozen with LN2.' })).lesionCount
    ).toBeUndefined();
    expect(
      extractLesionDestructionFacts(input({ procedureDetails: 'Treated area measured 2 x 4 cm.' })).lesionCount
    ).toBeUndefined();
  });

  it('reads cryotherapy from a Technique value as structured method evidence', () => {
    const facts = extractLesionDestructionFacts(input({ technique: ['Cryotherapy'], procedureDetails: '' }));
    expect(facts.methodDocumented?.confidence).toBe('structured');
  });
});

describe('lesion-destruction forward: the count determines the code (boundary pinned both sides)', () => {
  it.each([
    [1, '17110'],
    [14, '17110'],
    [15, '17111'],
    [20, '17111'],
  ])('%s lesions ⇒ %s', (count, expected) => {
    const result = lesionDestructionFamily.suggestCode(
      input({ procedureDetails: `${count} warts treated with liquid nitrogen.` })
    );
    expect(result.suggestion?.code).toBe(expected);
    expect(result.suggestion?.justification).toContain(String(count));
  });

  it('count missing ⇒ [D] ask (it determines the code), both open candidates, and the summary line', () => {
    const result = lesionDestructionFamily.suggestCode(
      input({ procedureDetails: 'Warts treated with liquid nitrogen.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'number of lesions treated is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['17110', '17111']);
    expect(result.openCandidatesSummary).toBe('17110–17111 — the number of lesions treated determines the code');
  });
});

describe('lesion-destruction inverse: pinned contradiction cases (boundary both sides)', () => {
  it('17111 selected with 14 lesions documented ⇒ [C] pointing at 17110, citing the note', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Foot',
        cptCodes: [{ code: '17111', display: 'Destruction of benign lesions; 15 or more' }],
        procedureDetails: '14 plantar warts treated with liquid nitrogen.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '17111');
    expect(contradiction?.message).toContain('17111 covers 15 or more lesions, but the note documents 14');
    expect(contradiction?.message).toContain('supports 17110');
    expect(contradiction?.sourceText).toContain('14');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('17110 selected with 15 lesions documented ⇒ [C] pointing at 17111 (the reverse direction)', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Foot',
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: '15 warts treated with liquid nitrogen.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'supports 17111', '17110')).toBe(true);
  });

  it('count missing ⇒ [D] ask per code, not a contradiction (even for 17111)', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Foot',
        cptCodes: [{ code: '17111', display: 'Destruction of benign lesions; 15 or more' }],
        procedureDetails: 'Numerous warts treated with liquid nitrogen.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'number of lesions treated is not documented', '17111')).toBe(
      true
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('lesion-destruction inverse: [R] elements', () => {
  it('method and locations each missing ⇒ individual [R] findings', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: '12 warts treated.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'destruction method is not documented', '17110')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'treated locations are not documented', '17110')).toBe(true);
  });

  it('the structured Site/location field satisfies the locations [R]', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Foot',
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: '12 warts treated with liquid nitrogen.',
      })
    );
    expect(hasFinding(result.findings, 'required', /locations/)).toBe(false);
    expect(result.supportedCodes).toEqual(['17110']);
  });
});

describe('lesion-destruction inverse: supported state and scope honesty', () => {
  it('fully documented entry supports 17110 with no [D]/[R]/[C] findings', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: FULLY_DOCUMENTED_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['17110']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('out-of-family destruction codes (e.g. 17000 premalignant) are listed not assessed, never guessed', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '17110', display: 'Destruction of benign lesions; up to 14' },
          { code: '17000', display: 'Destruction, premalignant lesion; first' },
        ],
        procedureDetails: FULLY_DOCUMENTED_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['17110']);
    expect(result.notAssessedCodes).toEqual(['17000']);
  });
});
