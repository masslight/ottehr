import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput } from '../model.types';
import {
  citedText,
  evidenceSource,
  findingCode,
  hasFinding,
  isNotAssessed,
  notAssessedCodes,
  notAssessedReason,
  offeredCandidates,
  offeredSummary,
  suggestionOf,
  supportedCodes,
} from '../test-support';
import { foreignBodyFamily } from './foreign-body';
import { extractLesionDestructionFacts, lesionDestructionFamily } from './lesion-destruction';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Wart Treatment (Cryotherapy with Liquid Nitrogen', ...overrides };
}

const FULLY_DOCUMENTED_TEXT =
  'Liquid nitrogen applied to 12 plantar warts on the left foot, two freeze-thaw cycles each.';

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
    ['single lesion', 'A single wart on the left heel frozen.', 1],
    ['verruca vocabulary', '16 verrucae treated.', 16],
  ])('parses %s', (_label, details, expected) => {
    const facts = extractLesionDestructionFacts(input({ procedureDetails: details }));
    expect(facts.lesionCount?.value).toBe(expected);
    expect(citedText(facts.lesionCount)).toBeDefined();
  });

  it('does not read lesion sizes or wound dimensions as counts', () => {
    expect(
      extractLesionDestructionFacts(input({ procedureDetails: 'A 2 cm lesion frozen with LN2.' })).lesionCount
    ).toBeUndefined();
    expect(
      extractLesionDestructionFacts(input({ procedureDetails: 'Treated area measured 2 x 4 cm.' })).lesionCount
    ).toBeUndefined();
  });

  it.each([
    ['an unbound x-count says nothing about lesions', 'Cryotherapy applied x12.'],
    ['freeze-thaw cycles are not lesions', 'Liquid nitrogen applied to the wart, freeze-thaw x2.'],
    ['medication doses are not lesions', 'Cryotherapy to the plantar warts. Ibuprofen 400 mg x2 doses given.'],
    ['cycles bound to a lesion noun are still cycles', 'Liquid nitrogen, 2 freeze-thaw cycles per lesion.'],
  ])('does not read a count that is not bound to a lesion noun (%s)', (_label, details) => {
    expect(extractLesionDestructionFacts(input({ procedureDetails: details })).lesionCount).toBeUndefined();
  });

  it('reads the documented single lesion, not the application count ("x 3 to a single wart")', () => {
    const facts = extractLesionDestructionFacts(
      input({ procedureDetails: 'Cryotherapy applied x 3 to a single wart on the thumb' })
    );
    expect(facts.lesionCount?.value).toBe(1);
  });

  it('an implausible count is not banded — it is asked about', () => {
    const facts = extractLesionDestructionFacts(
      input({ procedureDetails: 'Lesion count: 500. All treated with liquid nitrogen.' })
    );
    expect(facts.lesionCount).toBeUndefined();
    expect(facts.implausibleLesionCount?.value).toBe(500);

    const result = lesionDestructionFamily.suggestCode(
      input({ procedureDetails: 'Lesion count: 500. All treated with liquid nitrogen.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', '500')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['17110', '17111']);
    expect(offeredSummary(result.outcome)).toBeDefined();
  });

  it('reads cryotherapy from a Technique value as structured method evidence', () => {
    const facts = extractLesionDestructionFacts(input({ technique: ['Cryotherapy'], procedureDetails: '' }));
    expect(evidenceSource(facts.methodDocumented)).toBe('field');
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
    expect(suggestionOf(result)?.code).toBe(expected);
    expect(suggestionOf(result)?.justification).toContain(String(count));
  });

  it('count missing ⇒ [D] ask (it determines the code), both open candidates, and the summary line', () => {
    const result = lesionDestructionFamily.suggestCode(
      input({ procedureDetails: 'Warts treated with liquid nitrogen.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'number of lesions treated is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['17110', '17111']);
    expect(offeredSummary(result.outcome)).toBe('17110–17111 — the number of lesions treated determines the code');
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
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '17111');
    expect(contradiction?.message).toContain('17111 covers 15 or more lesions, but the note documents 14');
    expect(contradiction?.message).toContain('supports 17110');
    expect(citedText(contradiction)).toContain('14');
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(supportedCodes(result)).toEqual(['17110']);
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
    expect(supportedCodes(result)).toEqual(['17110']);
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
    expect(supportedCodes(result)).toEqual(['17110']);
    expect(notAssessedCodes(result)).toEqual(['17000']);
  });
});

describe("lesion-destruction: the descriptor's own exclusions", () => {
  it.each([
    ['skin tags', '8 skin tag lesions on the neck destroyed with cryotherapy', '11200'],
    ['actinic keratoses', '6 actinic keratosis lesions on the scalp treated with liquid nitrogen', '17000'],
    ['cherry angiomas', '4 cherry angiomas on the trunk destroyed with cryotherapy', '17106'],
  ])('%s ⇒ no suggestion, naming %s instead of 17110', (_label, details, expectedCodes) => {
    const result = lesionDestructionFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain(expectedCodes);
    expect(hasFinding(result.findings, 'contradiction', expectedCodes)).toBe(true);
  });

  it('17110 selected on skin tags ⇒ [C] naming 11200/11201, citing the note', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Neck',
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: '8 skin tag lesions on the neck destroyed with cryotherapy',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '17110');
    expect(contradiction?.message).toContain('11200');
    expect(contradiction?.message).toContain('11201');
    expect(citedText(contradiction)).toContain('skin tag');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('17111 selected on actinic keratoses ⇒ [C] naming 17000/17003/17004', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Head',
        cptCodes: [{ code: '17111', display: 'Destruction of benign lesions; 15 or more' }],
        procedureDetails: '20 actinic keratosis lesions on the scalp treated with liquid nitrogen',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '17004', '17111')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('a coded diagnosis alone establishes the excluded lesion type (no lesion words in the note)', () => {
    const result = lesionDestructionFamily.suggestCode(
      input({
        diagnoses: [{ code: 'L57.0', display: 'Actinic keratosis' }],
        procedureDetails: '6 lesions on the scalp treated with liquid nitrogen',
      })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(notAssessedReason(result)).toContain('17000');
  });

  it('a benign seborrheic keratosis is not excluded — it still bands on the count', () => {
    const result = lesionDestructionFamily.suggestCode(
      input({ procedureDetails: '6 seborrheic keratosis lesions on the trunk destroyed with cryotherapy' })
    );
    expect(suggestionOf(result)?.code).toBe('17110');
  });
});

describe('lesion-destruction inverse: laterality and anesthesia [B] elements', () => {
  it('a missing side and missing anesthesia are [B]s, not [R]s (neither code is unilateral)', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        bodySite: 'Foot',
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: '12 warts treated with liquid nitrogen.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Side of body field')).toBe(true);
    expect(hasFinding(result.findings, 'bestPractice', 'Anaesthesia / medication used field')).toBe(true);
    expect(supportedCodes(result)).toEqual(['17110']);
  });

  it('a side word tied to the site satisfies the laterality [B]', () => {
    const result = lesionDestructionFamily.defendCodes(
      input({
        cptCodes: [{ code: '17110', display: 'Destruction of benign lesions; up to 14' }],
        procedureDetails: FULLY_DOCUMENTED_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Side of body field')).toBe(false);
  });
});
