import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { incisionDrainageFamily } from './incision-drainage';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Incision and Drainage (I&D) of Abscess', ...overrides };
}

// [R]-complete but no complexity elements: incision + drainage + anesthesia + dressing/tolerance.
const SIMPLE_ID_TEXT =
  'After 2 mL 1% lidocaine with epinephrine, a #11 blade stab incision was made at the point of maximal fluctuance. ' +
  '~5 mL purulent drainage expressed. Dry dressing applied; procedure tolerated well.';

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

describe('incision-drainage detection', () => {
  it('detects the product procedure type display', () => {
    expect(detectProcedureFamily({ procedureType: 'Incision and Drainage (I&D) of Abscess' })?.id).toBe(
      'incision-drainage'
    );
    expect(detectProcedureFamily({ procedureType: 'abscess-drainage' })?.id).toBe('incision-drainage');
  });

  it('detects from a selected I&D code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '10060', display: 'I&D simple' }] })?.id).toBe(
      'incision-drainage'
    );
    expect(detectProcedureFamily({ cptCodes: [{ code: '10061', display: 'I&D complicated' }] })?.id).toBe(
      'incision-drainage'
    );
  });

  it('does not claim laceration entries, and laceration does not claim I&D entries', () => {
    expect(incisionDrainageFamily.detect({ procedureType: 'Laceration Repair (Suturing/Stapling)' })).toBe(false);
    expect(lacerationFamily.detect({ procedureType: 'Incision and Drainage (I&D) of Abscess' })).toBe(false);
  });
});

describe('incision-drainage forward: complexity elements select the code', () => {
  it('no complexity element documented ⇒ 10060, with the why in the justification', () => {
    const result = incisionDrainageFamily.suggestCode(input({ bodySite: 'Torso', procedureDetails: SIMPLE_ID_TEXT }));
    expect(result.suggestion?.code).toBe('10060');
    expect(result.suggestion?.justification).toContain('none of the complexity elements');
    expect(result.findings).toHaveLength(0);
  });

  it.each([
    ['blunt dissection of loculations', 'Loculations were broken up by blunt dissection.'],
    ['probing of the abscess cavity', 'The cavity was thoroughly probed.'],
    ['packing placed', 'Iodoform packing placed in the cavity.'],
    ['drain placement', 'A Penrose drain was placed.'],
    ['multiple abscesses', 'Two separate abscesses were incised and drained.'],
  ])('%s documented ⇒ 10061 citing it', (label, elementText) => {
    const result = incisionDrainageFamily.suggestCode(
      input({ bodySite: 'Torso', procedureDetails: SIMPLE_ID_TEXT + ' ' + elementText })
    );
    expect(result.suggestion?.code).toBe('10061');
    expect(result.suggestion?.justification).toContain(label);
  });

  it('packing recorded only in Supplies used (iodoform strip) ⇒ 10061', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({
        bodySite: 'Torso',
        suppliesUsed: ['Other'],
        otherSuppliesUsed: 'Iodoform strip',
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(result.suggestion?.code).toBe('10061');
    expect(result.suggestion?.justification).toContain('packing placed');
  });

  it('negated complexity language stays 10060', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({
        bodySite: 'Torso',
        procedureDetails:
          SIMPLE_ID_TEXT + ' No packing was placed. Loculations were not broken up. No drain was left in place.',
      })
    );
    expect(result.suggestion?.code).toBe('10060');
  });
});

describe('incision-drainage inverse: pinned contradiction cases', () => {
  it('10061 selected with no complexity element ⇒ supports-10060 [C] with the if-performed clause', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10061', display: 'I&D complicated' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '10061');
    expect(contradiction?.message).toBe(
      '10061 is selected, but the note does not document any complexity element (blunt dissection of loculations, probing of the cavity, packing, drain placement, or multiple abscesses) — as documented this supports 10060 (simple or single abscess). If one was performed, add it to Procedure details, e.g. "loculations broken up by blunt dissection; iodoform packing placed".'
    );
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('10060 selected with packing documented ⇒ supports-10061 [C] citing the source text', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT + ' Iodoform packing placed in the cavity.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '10060');
    expect(contradiction?.message).toContain('as documented this supports 10061');
    expect(contradiction?.message).toContain('packing placed');
    expect(contradiction?.sourceText).toContain('packing');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('10060 selected with a drain placed ⇒ supports-10061 [C]', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT + ' A Penrose drain was placed.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'drain placement', '10060')).toBe(true);
  });
});

describe('incision-drainage inverse: [R] elements name their destination fields', () => {
  it('nothing documented ⇒ location, incision, and drainage asks for the selected code', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({ cptCodes: [{ code: '10060', display: 'I&D simple' }], procedureDetails: '' })
    );
    expect(hasFinding(result.findings, 'required', 'Site/location field', '10060')).toBe(true);
    expect(
      hasFinding(result.findings, 'required', /incision is not documented.*#11 blade stab incision/, '10060')
    ).toBe(true);
    expect(hasFinding(result.findings, 'required', /Drainage is not documented.*purulent drainage/, '10060')).toBe(
      true
    );
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('a recognized site keyword in the text satisfies the location ask', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: 'Abscess on the left thigh. ' + SIMPLE_ID_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'required', 'Site/location field')).toBe(false);
  });
});

describe('incision-drainage inverse: [B] best practices, once per entry', () => {
  it('missing size, culture, and dressing surface as best-practice asks naming the structured fields', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: 'After 1% lidocaine, a #11 blade stab incision was made; purulent drainage expressed.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Wound/lesion size (cm) field')).toBe(true);
    expect(hasFinding(result.findings, 'bestPractice', 'Specimen sent field')).toBe(true);
    expect(hasFinding(result.findings, 'bestPractice', /Dressing and patient tolerance/)).toBe(true);
    expect(hasFinding(result.findings, 'bestPractice', 'Anaesthesia / medication used field')).toBe(false); // lidocaine documented
  });

  it('the structured Specimen sent answer satisfies the culture check either way', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        specimenSent: false,
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Specimen sent field')).toBe(false);
  });

  it('the structured lesion size satisfies the size check', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 2.0,
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Wound/lesion size (cm) field')).toBe(false);
  });
});

describe('incision-drainage inverse: supported state and scope honesty', () => {
  it('fully documented complicated I&D supports 10061 with no [D]/[R]/[C] findings', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 2.0,
        specimenSent: true,
        medicationUsed: '1% lidocaine with epinephrine',
        cptCodes: [{ code: '10061', display: 'I&D complicated' }],
        procedureDetails:
          '#11 blade stab incision at the point of maximal fluctuance; the cavity was probed and loculations were broken up by blunt dissection. ' +
          '~5 mL purulent drainage expressed; iodoform packing placed. Dry dressing applied; tolerated well.',
      })
    );
    expect(result.supportedCodes).toEqual(['10061']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('fully documented simple I&D supports 10060', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['10060']);
  });

  it('unmodeled I&D-adjacent code (10160, puncture aspiration) ⇒ not assessed, never guessed', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10160', display: 'Puncture aspiration of abscess' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(result.notAssessedCodes).toContain('10160');
    expect(result.findings.filter((f) => f.cptCode === '10160')).toHaveLength(0);
  });

  it('mixed selection: in-scope code judged, out-of-family code listed not assessed', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [
          { code: '10060', display: 'I&D simple' },
          { code: '99213', display: 'Office visit' },
        ],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['10060']);
    expect(result.notAssessedCodes).toEqual(['99213']);
  });
});

describe('incision-drainage family metadata', () => {
  it('uses the structured length input (drives the conditional cm field)', () => {
    expect(incisionDrainageFamily.usesStructuredLength).toBe(true);
  });
});
