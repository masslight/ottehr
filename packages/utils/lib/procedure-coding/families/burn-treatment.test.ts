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
import { burnClassForPercent, burnTreatmentFamily, extractBurnFacts } from './burn-treatment';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Burn Treatment / Dressing', ...overrides };
}

const FULLY_DOCUMENTED_MEDIUM_TEXT =
  'Partial-thickness (second-degree) burn to the left forearm, ~7% TBSA. ' +
  'Wound cleansed, bacitracin and non-adherent dressing applied.';

describe('burn-treatment detection', () => {
  it('detects the product procedure type display and slug', () => {
    expect(detectProcedureFamily({ procedureType: 'Burn Treatment / Dressing' })?.id).toBe('burn-treatment');
    expect(detectProcedureFamily({ procedureType: 'burn-treatment' })?.id).toBe('burn-treatment');
  });

  it.each(['16020', '16025', '16030'])('detects from the selected %s alone', (code) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Burn dressing' }] })?.id).toBe('burn-treatment');
  });

  it('does not claim "Wound Care / Dressing Change" (the pattern keys on burn, not dressing)', () => {
    expect(burnTreatmentFamily.detect({ procedureType: 'Wound Care / Dressing Change' })).toBe(false);
    expect(detectProcedureFamily({ procedureType: 'Wound Care / Dressing Change' })).toBeUndefined();
  });

  it('laceration does not claim burn entries and vice versa', () => {
    expect(lacerationFamily.detect({ procedureType: 'Burn Treatment / Dressing' })).toBe(false);
    expect(burnTreatmentFamily.detect({ procedureType: 'Laceration Repair (Suturing/Stapling)' })).toBe(false);
  });
});

describe('burn TBSA class banding (CPT descriptor edges pinned)', () => {
  it.each([
    [3, 'small'],
    [4.9, 'small'],
    [5, 'medium'],
    [7, 'medium'],
    [10, 'medium'],
    [10.1, 'large'],
    [15, 'large'],
  ])('%s%% TBSA ⇒ %s', (percent, expected) => {
    expect(burnClassForPercent(percent as number)).toBe(expected);
  });
});

describe('burn extent extraction', () => {
  it.each([
    ['percent then TBSA', 'Burn covering 7% TBSA dressed.', 7],
    ['TBSA then percent', 'Estimated TBSA: 7%. Dressing applied.', 7],
    ['percent tied to burn language', 'Approximately 7% partial-thickness burn to the arm.', 7],
    ['burn then percent', 'Burn involving about 7% of the arm surface.', 7],
  ])('reads the documented percentage (%s)', (_label, details, expected) => {
    const facts = extractBurnFacts(input({ procedureDetails: details }));
    expect(facts.tbsaPercent).toBe(expected);
    expect(facts.extentClass?.value).toBe('medium');
    expect(citedText(facts.extentClass)).toContain('7%');
  });

  it.each([
    ['small burn to the hand dressed.', 'small'],
    ['Medium-sized burn dressed and debrided.', 'medium'],
    ['Burn involving the whole extremity, dressed.', 'medium'],
    ['Large burn area debrided.', 'large'],
    ['Burns over more than one extremity dressed.', 'large'],
  ])('reads the size-class language "%s" ⇒ %s', (details, expected) => {
    expect(extractBurnFacts(input({ procedureDetails: details })).extentClass?.value).toBe(expected);
  });

  it('a documented percentage outranks the class words', () => {
    const facts = extractBurnFacts(input({ procedureDetails: 'Small burn, 12% TBSA, dressed.' }));
    expect(facts.extentClass?.value).toBe('large');
    expect(facts.tbsaPercent).toBe(12);
  });

  it('a stray "small" without burn context pins no extent', () => {
    const facts = extractBurnFacts(input({ procedureDetails: 'A small amount of exudate noted. Dressing changed.' }));
    expect(facts.extentClass).toBeUndefined();
  });
});

describe('burn forward: extent determines the code', () => {
  it.each([
    ['3% TBSA second-degree burn, dressed.', '16020'],
    ['7% TBSA partial-thickness burn, dressed.', '16025'],
    ['12% TBSA partial-thickness burn, dressed and debrided.', '16030'],
  ])('"%s" ⇒ %s', (details, expected) => {
    const result = burnTreatmentFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(result)?.code).toBe(expected);
    expect(suggestionOf(result)?.justification).toContain('TBSA');
  });

  it('extent missing ⇒ [D] ask, all three open candidates, and the compact summary line', () => {
    const result = burnTreatmentFamily.suggestCode(
      input({ procedureDetails: 'Second-degree burn to the forearm. Dressing applied.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', "burn's extent is not documented")).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['16020', '16025', '16030']);
    expect(offeredSummary(result.outcome)).toBe(
      '16020–16030 — the treated burn extent (TBSA %) determines the exact code'
    );
  });
});

describe('burn inverse: pinned contradiction cases (both directions)', () => {
  it('16020 selected with 10% TBSA documented ⇒ [C] pointing at 16025, citing the note', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16020', display: 'Burn dressing; small' }],
        procedureDetails: FULLY_DOCUMENTED_MEDIUM_TEXT.replace('~7%', '10%'),
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '16020');
    expect(contradiction?.message).toContain('16020 covers a small burn (less than 5% TBSA)');
    expect(contradiction?.message).toContain('supports 16025');
    expect(citedText(contradiction)).toContain('10%');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('16030 selected with 3% TBSA documented ⇒ [C] pointing at 16020 (the reverse direction)', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16030', display: 'Burn dressing; large' }],
        procedureDetails: FULLY_DOCUMENTED_MEDIUM_TEXT.replace('~7%', '3%'),
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'supports 16020', '16030')).toBe(true);
  });

  it('extent missing ⇒ [D] ask per code, not a contradiction', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: 'Second-degree burn to the forearm, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'determines', "burn's extent is not documented", '16025')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('burn inverse: documentation elements', () => {
  it('depth and treatment are [R]; location coaching waits until depth and extent are documented', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: '7% TBSA.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'burn location is not documented', '16025')).toBe(false);
    expect(hasFinding(result.findings, 'bestPractice', 'burn location is not documented', '16025')).toBe(false);
    expect(hasFinding(result.findings, 'required', 'burn depth is not documented', '16025')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'treatment performed is not documented', '16025')).toBe(true);
  });

  it('missing location after depth and extent are documented is [B] and does not block green', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: '7% TBSA second-degree burn, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'burn location is not documented', '16025')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'burn location is not documented', '16025')).toBe(false);
    expect(supportedCodes(result)).toEqual(['16025']);
  });

  it('documented depth, extent, and location do not support green without the treatment type', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: 'Partial-thickness burn to the face, 7% TBSA.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'treatment performed is not documented', '16025')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('the structured Site/location field satisfies the location reminder', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: '7% TBSA second-degree burn, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'required', /location/)).toBe(false);
    expect(hasFinding(result.findings, 'bestPractice', /location/)).toBe(false);
    expect(supportedCodes(result)).toEqual(['16025']);
  });

  it('"no full-thickness involvement" documents the depth assessment without affirming full-thickness', () => {
    const facts = extractBurnFacts(input({ procedureDetails: 'Burn with no full-thickness involvement.' }));
    expect(facts.degreeDocumented?.value).toBe(true);
    expect(facts.depthClass).toBeUndefined();
  });

  it('a dressing recorded only in Supplies used counts as treatment evidence', () => {
    const facts = extractBurnFacts(
      input({ suppliesUsed: ['Other'], otherSuppliesUsed: 'Burn kit with xeroform gauze', procedureDetails: '' })
    );
    expect(evidenceSource(facts.treatmentDocumented)).toBe('field');
  });
});

describe('burn inverse: supported state and scope honesty', () => {
  it('fully documented entry supports the matching code with no [D]/[R]/[C] findings', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: FULLY_DOCUMENTED_MEDIUM_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['16025']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('a burn depth outside partial-thickness is never coded from this table (16020 not supported)', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        cptCodes: [{ code: '16020', display: 'Burn dressing; small' }],
        procedureDetails: 'Full-thickness burn, 3% TBSA. Dressing applied.',
      })
    );
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('out-of-family codes (e.g. 16000 first-degree treatment) are listed not assessed, never guessed', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [
          { code: '16025', display: 'Burn dressing; medium' },
          { code: '16000', display: 'Initial treatment, first degree burn' },
        ],
        procedureDetails: FULLY_DOCUMENTED_MEDIUM_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['16025']);
    expect(notAssessedCodes(result)).toEqual(['16000']);
  });
});

describe('burn depth gating (16020–16030 are the partial-thickness codes)', () => {
  it.each([
    ['first-degree', 'First-degree superficial burn, 3% TBSA.', 'first-degree'],
    ['second-degree', 'Second-degree burn, 3% TBSA.', 'partial-thickness'],
    ['partial-thickness', 'Partial-thickness burn, 3% TBSA.', 'partial-thickness'],
    ['third-degree', 'Third-degree burn, 3% TBSA.', 'full-thickness'],
    ['full-thickness', 'Full-thickness burn, 3% TBSA.', 'full-thickness'],
  ])('reads the documented depth (%s)', (_label, details, expected) => {
    const facts = extractBurnFacts(input({ procedureDetails: details }));
    expect(facts.depthClass?.value).toBe(expected);
    expect(citedText(facts.depthClass)).toBeDefined();
  });

  it('"First-degree superficial burn, 3% TBSA" suggests no code and names 16000 instead of 16020', () => {
    const result = burnTreatmentFamily.suggestCode(
      input({ procedureDetails: 'First-degree superficial burn, 3% TBSA' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('16000');
    expect(hasFinding(result.findings, 'contradiction', '16000')).toBe(true);
  });

  it('16020 selected on a first-degree burn ⇒ [C] naming 16000, citing the note', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16020', display: 'Burn dressing; small' }],
        procedureDetails: 'First-degree superficial burn, 3% TBSA',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '16020');
    expect(contradiction?.message).toContain('partial-thickness');
    expect(contradiction?.message).toContain('16000');
    expect(citedText(contradiction)).toContain('First-degree');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('16020 selected on a full-thickness burn ⇒ [C], not a silent pass', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16020', display: 'Burn dressing; small' }],
        procedureDetails: 'Full-thickness burn, 3% TBSA',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '16020');
    expect(contradiction?.message).toContain('full-thickness');
    expect(citedText(contradiction)).toContain('Full-thickness');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('a full-thickness burn is not coded from this table in the forward direction either', () => {
    const result = burnTreatmentFamily.suggestCode(input({ procedureDetails: 'Full-thickness burn, 3% TBSA' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
  });

  it('a mixed-depth burn is coded on the partial-thickness work, with the full-thickness areas surfaced', () => {
    const details = 'Second-degree burn with areas of full-thickness to the left forearm, 7% TBSA. Dressing applied.';
    const facts = extractBurnFacts(input({ procedureDetails: details }));
    expect(facts.depthClass?.value).toBe('partial-thickness');
    expect(facts.mixedFullThickness?.value).toBe(true);

    const forward = burnTreatmentFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(forward)?.code).toBe('16025');
    expect(hasFinding(forward.findings, 'bestPractice', 'full-thickness areas')).toBe(true);

    const inverse = burnTreatmentFamily.defendCodes(
      input({ cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }], procedureDetails: details })
    );
    expect(supportedCodes(inverse)).toEqual(['16025']);
    expect(hasFinding(inverse.findings, 'bestPractice', 'full-thickness areas')).toBe(true);
  });

  it('depth absent ⇒ the same [R] ask in both directions', () => {
    const details = '7% TBSA burn to the face. Dressing applied.';
    const forward = burnTreatmentFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(forward)?.code).toBe('16025');
    expect(hasFinding(forward.findings, 'required', 'burn depth is not documented')).toBe(true);
    expect(hasFinding(forward.findings, 'required', '16000')).toBe(true);

    const inverse = burnTreatmentFamily.defendCodes(
      input({ cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }], procedureDetails: details })
    );
    expect(hasFinding(inverse.findings, 'required', 'burn depth is not documented', '16025')).toBe(true);
    expect(hasFinding(inverse.findings, 'required', '16000', '16025')).toBe(true);
  });
});

describe('burn laterality [B] (paired sites only)', () => {
  it('a paired site without a side ⇒ non-blocking reminder naming the Side of body field', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: 'Partial-thickness burn to the forearm, 7% TBSA, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Side of body field', '16025')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'Side of body field', '16025')).toBe(false);
    expect(supportedCodes(result)).toEqual(['16025']);
  });

  it.each([
    ['the structured Side of body field', { bodySide: 'Left' }, {}],
    ['a side word tied to the site in the text', {}, { site: 'left forearm' }],
  ])('%s satisfies laterality', (_label, overrides, textOverride) => {
    const site = (textOverride as { site?: string }).site ?? 'forearm';
    const result = burnTreatmentFamily.defendCodes(
      input({
        ...overrides,
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: `Partial-thickness burn to the ${site}, 7% TBSA, dressing applied.`,
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Side of body field')).toBe(false);
    expect(supportedCodes(result)).toEqual(['16025']);
  });

  it('a midline site (face) has no side to record, so no laterality reminder', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: 'Partial-thickness burn to the face, 7% TBSA, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Side of body field')).toBe(false);
    expect(supportedCodes(result)).toEqual(['16025']);
  });

  it('a stray "left" with no body part is not laterality', () => {
    const facts = extractBurnFacts(
      input({ procedureDetails: 'Partial-thickness burn, 7% TBSA. Patient left after the dressing was applied.' })
    );
    expect(facts.lateralityDocumented).toBe(false);
  });
});

describe('burn TBSA extraction guards', () => {
  it('a negated percentage does not pin the extent (the shared negation guard applies)', () => {
    const facts = extractBurnFacts(
      input({ procedureDetails: 'Partial-thickness burn dressed; no 12% TBSA involvement.' })
    );
    expect(facts.extentClass).toBeUndefined();
    expect(facts.tbsaPercent).toBeUndefined();
  });

  it('a percentage over 100% is rejected and asked about, never banded (forward)', () => {
    const result = burnTreatmentFamily.suggestCode(
      input({ procedureDetails: 'Partial-thickness burn, 150% TBSA, dressed.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', '150%')).toBe(true);
    expect(hasFinding(result.findings, 'determines', 'cannot exceed 100%')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['16020', '16025', '16030']);
    expect(offeredSummary(result.outcome)).toBeDefined();
  });

  it('a percentage over 100% is a [D] ask per code, not a contradiction (inverse)', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: 'Partial-thickness burn, 150% TBSA, dressed.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'cannot exceed 100%', '16025')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});
