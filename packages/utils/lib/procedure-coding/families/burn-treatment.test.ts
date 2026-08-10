import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { burnClassForPercent, burnTreatmentFamily, extractBurnFacts } from './burn-treatment';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Burn Treatment / Dressing', ...overrides };
}

const FULLY_DOCUMENTED_MEDIUM_TEXT =
  'Partial-thickness (second-degree) burn to the left forearm, ~7% TBSA. ' +
  'Wound cleansed, bacitracin and non-adherent dressing applied.';

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
    expect(facts.extentClass?.sourceText).toContain('7%');
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
    expect(result.suggestion?.code).toBe(expected);
    expect(result.suggestion?.justification).toContain('TBSA');
  });

  it('extent missing ⇒ [D] ask, all three open candidates, and the compact summary line', () => {
    const result = burnTreatmentFamily.suggestCode(
      input({ procedureDetails: 'Second-degree burn to the forearm. Dressing applied.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', "burn's extent is not documented")).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['16020', '16025', '16030']);
    expect(result.openCandidatesSummary).toBe(
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
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '16020');
    expect(contradiction?.message).toContain('16020 covers a small burn (less than 5% TBSA)');
    expect(contradiction?.message).toContain('supports 16025');
    expect(contradiction?.sourceText).toContain('10%');
    expect(result.supportedCodes).toHaveLength(0);
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

describe('burn inverse: [R] elements', () => {
  it('location, degree, and treatment each missing ⇒ individual [R] findings', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: '7% TBSA.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'burn location is not documented', '16025')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'burn degree is not documented', '16025')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'treatment performed is not documented', '16025')).toBe(true);
  });

  it('the structured Site/location field satisfies the location [R]', () => {
    const result = burnTreatmentFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '16025', display: 'Burn dressing; medium' }],
        procedureDetails: '7% TBSA second-degree burn, dressing applied.',
      })
    );
    expect(hasFinding(result.findings, 'required', /location/)).toBe(false);
    expect(result.supportedCodes).toEqual(['16025']);
  });

  it('"no full-thickness involvement" still documents the degree (assessment language)', () => {
    const facts = extractBurnFacts(input({ procedureDetails: 'Burn with no full-thickness involvement.' }));
    expect(facts.degreeDocumented?.value).toBe(true);
  });

  it('a dressing recorded only in Supplies used counts as treatment evidence', () => {
    const facts = extractBurnFacts(
      input({ suppliesUsed: ['Other'], otherSuppliesUsed: 'Burn kit with xeroform gauze', procedureDetails: '' })
    );
    expect(facts.treatmentDocumented?.confidence).toBe('structured');
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
    expect(result.supportedCodes).toEqual(['16025']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['16025']);
    expect(result.notAssessedCodes).toEqual(['16000']);
  });
});
