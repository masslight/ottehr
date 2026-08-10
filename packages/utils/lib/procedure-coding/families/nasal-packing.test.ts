import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { cerumenFamily } from './cerumen';
import { foreignBodyFamily } from './foreign-body';
import { extractNasalPackingFacts, nasalPackingFamily } from './nasal-packing';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Nasal Packing (Epistaxis Control)', ...overrides };
}

const SIMPLE_ANTERIOR_TEXT =
  'Anterior epistaxis, left naris. Silver nitrate cautery applied, then Merocel packing placed. Hemostasis achieved.';
const COMPLEX_ANTERIOR_TEXT =
  'Anterior epistaxis, left naris. Extensive layered packing placed after a second attempt. No further bleeding.';
const POSTERIOR_TEXT = 'Posterior epistaxis, right naris. Posterior pack placed. Bleeding controlled.';

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

describe('nasal-packing detection and mutual exclusivity', () => {
  it('detects the product procedure type display and slug', () => {
    expect(detectProcedureFamily({ procedureType: 'Nasal Packing (Epistaxis Control)' })?.id).toBe('nasal-packing');
    expect(detectProcedureFamily({ procedureType: 'nasal-packing' })?.id).toBe('nasal-packing');
  });

  it('detects the 30901 CPT descriptor type shape', () => {
    expect(
      detectProcedureFamily({
        procedureType: 'Control nasal hemorrhage, anterior, simple (limited cautery and/or packing) any method',
      })?.id
    ).toBe('nasal-packing');
  });

  it.each(['30901', '30903', '30905'])('detects from the selected %s alone', (code) => {
    expect(detectProcedureFamily({ cptCodes: [{ code, display: 'Control nasal hemorrhage' }] })?.id).toBe(
      'nasal-packing'
    );
  });

  it('nasal FBR stays foreign-body territory, and nasal packing never claims it (both directions)', () => {
    expect(nasalPackingFamily.detect({ procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)' })).toBe(false);
    expect(detectProcedureFamily({ procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)' })?.id).toBe(
      'foreign-body'
    );
    expect(foreignBodyFamily.detect({ procedureType: 'Nasal Packing (Epistaxis Control)' })).toBe(false);
    expect(cerumenFamily.detect({ procedureType: 'Nasal Packing (Epistaxis Control)' })).toBe(false);
  });

  it('nasal lavage (a no-code type) is not claimed', () => {
    expect(nasalPackingFamily.detect({ procedureType: 'Nasal Lavage (schnozzle)' })).toBe(false);
    expect(detectProcedureFamily({ procedureType: 'Nasal Lavage (schnozzle)' })).toBeUndefined();
  });
});

describe('nasal-packing fact extraction', () => {
  it('posterior governs when both locations are documented (posterior control includes the anterior work)', () => {
    const facts = extractNasalPackingFacts(
      input({ procedureDetails: 'Anterior packing failed to control bleeding; posterior pack placed.' })
    );
    expect(facts.location?.value).toBe('posterior');
  });

  it.each([
    ['left naris packed with Merocel.', true],
    ['packing placed in the right nostril.', true],
    ['nasal packing placed.', false],
  ])('naris laterality from text: "%s" ⇒ %s', (details, expected) => {
    expect(extractNasalPackingFacts(input({ procedureDetails: details })).lateralityDocumented).toBe(expected);
  });

  it('the structured Side of body field satisfies laterality', () => {
    expect(extractNasalPackingFacts(input({ bodySide: 'Left', procedureDetails: '' })).lateralityDocumented).toBe(true);
  });

  it.each(['Merocel placed.', 'Rapid Rhino inserted.', 'petrolatum gauze packing placed.'])(
    'a named packing product counts as packing evidence ("%s")',
    (details) => {
      expect(extractNasalPackingFacts(input({ procedureDetails: details })).packingDocumented?.value).toBe(true);
    }
  );

  it('a packing product recorded only in Supplies used counts as structured packing evidence', () => {
    const facts = extractNasalPackingFacts(
      input({ suppliesUsed: ['Other'], otherSuppliesUsed: 'Rapid Rhino 5.5', procedureDetails: '' })
    );
    expect(facts.packingDocumented?.confidence).toBe('structured');
  });

  it('"no further bleeding" documents hemostasis (the negated form is the documentation)', () => {
    expect(
      extractNasalPackingFacts(input({ procedureDetails: 'Packing placed; no further bleeding.' })).hemostasisDocumented
        ?.value
    ).toBe(true);
  });
});

describe('nasal-packing forward: location and extent determine the code', () => {
  it('anterior with no complexity elements ⇒ 30901, saying why', () => {
    const result = nasalPackingFamily.suggestCode(input({ procedureDetails: SIMPLE_ANTERIOR_TEXT }));
    expect(result.suggestion?.code).toBe('30901');
    expect(result.suggestion?.justification).toContain('none of the complexity elements');
  });

  it('anterior with extensive/layered packing ⇒ 30903, citing the elements', () => {
    const result = nasalPackingFamily.suggestCode(input({ procedureDetails: COMPLEX_ANTERIOR_TEXT }));
    expect(result.suggestion?.code).toBe('30903');
    expect(result.suggestion?.justification).toContain('layered packing');
  });

  it('posterior packing ⇒ 30905', () => {
    const result = nasalPackingFamily.suggestCode(input({ procedureDetails: POSTERIOR_TEXT }));
    expect(result.suggestion?.code).toBe('30905');
  });

  it('location missing ⇒ [D] ask, all three open candidates, and the compact summary line', () => {
    const result = nasalPackingFamily.suggestCode(input({ procedureDetails: 'Epistaxis controlled with packing.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'bleeding site is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['30901', '30903', '30905']);
    expect(result.openCandidatesSummary).toBe(
      '30901–30905 — the bleeding site (anterior vs posterior) and packing extent determine the code'
    );
  });
});

describe('nasal-packing inverse: pinned contradiction cases', () => {
  it('30905 selected with only anterior packing documented ⇒ [C], citing the note', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30905', display: 'Control nasal hemorrhage, posterior; initial' }],
        procedureDetails: SIMPLE_ANTERIOR_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '30905');
    expect(contradiction?.message).toContain('30905 covers posterior epistaxis control');
    expect(contradiction?.message).toContain('anterior packing only');
    expect(contradiction?.sourceText).toContain('Anterior');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('30901 selected with posterior packing documented ⇒ [C] pointing at 30905 (the reverse direction)', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30901', display: 'Control nasal hemorrhage, anterior, simple' }],
        procedureDetails: POSTERIOR_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'supports 30905', '30901')).toBe(true);
  });

  it('30903 selected with no complexity element documented ⇒ [C] "as documented this supports 30901"', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30903', display: 'Control nasal hemorrhage, anterior, complex' }],
        procedureDetails: SIMPLE_ANTERIOR_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '30903');
    expect(contradiction?.message).toContain('supports 30901');
    expect(contradiction?.message).toContain('If extensive control was performed, add it');
  });

  it('30901 selected while extensive/layered packing is documented ⇒ [C] pointing at 30903, citing the note', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30901', display: 'Control nasal hemorrhage, anterior, simple' }],
        procedureDetails: COMPLEX_ANTERIOR_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '30901');
    expect(contradiction?.message).toContain('supports 30903');
    expect(contradiction?.sourceText).toBeDefined();
  });

  it('location missing ⇒ [D] ask per code, not a contradiction', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30905', display: 'Control nasal hemorrhage, posterior; initial' }],
        procedureDetails: 'Epistaxis controlled with packing.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'bleeding site is not documented', '30905')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('nasal-packing inverse: [R] elements', () => {
  it('naris, method, and hemostasis each missing ⇒ individual [R] findings', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30901', display: 'Control nasal hemorrhage, anterior, simple' }],
        procedureDetails: 'Anterior epistaxis on arrival.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'treated naris is not documented', '30901')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'control method is not documented', '30901')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'Hemostasis is not documented', '30901')).toBe(true);
  });

  it('cautery alone satisfies the method [R] (the codes cover cautery and/or packing)', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '30901', display: 'Control nasal hemorrhage, anterior, simple' }],
        procedureDetails: 'Anterior bleeding point cauterized with silver nitrate. Hemostasis achieved.',
      })
    );
    expect(hasFinding(result.findings, 'required', /control method/)).toBe(false);
    expect(result.supportedCodes).toEqual(['30901']);
  });
});

describe('nasal-packing inverse: supported state and scope honesty', () => {
  it('fully documented simple anterior control supports 30901 with no [D]/[R]/[C] findings', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30901', display: 'Control nasal hemorrhage, anterior, simple' }],
        procedureDetails: SIMPLE_ANTERIOR_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['30901']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('fully documented complex anterior control supports 30903', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [{ code: '30903', display: 'Control nasal hemorrhage, anterior, complex' }],
        procedureDetails: COMPLEX_ANTERIOR_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['30903']);
  });

  it('out-of-family codes (e.g. 30906 subsequent posterior) are listed not assessed, never guessed', () => {
    const result = nasalPackingFamily.defendCodes(
      input({
        cptCodes: [
          { code: '30905', display: 'Control nasal hemorrhage, posterior; initial' },
          { code: '30906', display: 'Control nasal hemorrhage, posterior; subsequent' },
        ],
        procedureDetails: POSTERIOR_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['30905']);
    expect(result.notAssessedCodes).toEqual(['30906']);
  });
});
