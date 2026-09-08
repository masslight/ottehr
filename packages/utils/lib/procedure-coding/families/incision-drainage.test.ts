import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput, ProcedureStructuredField } from '../model.types';
import {
  citedText,
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
import { incisionDrainageFamily } from './incision-drainage';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Incision and Drainage (I&D) of Abscess', ...overrides };
}

const SIMPLE_ID_TEXT =
  'After 2 mL 1% lidocaine with epinephrine, a #11 blade stab incision was made at the point of maximal fluctuance. ' +
  '~5 mL purulent drainage expressed. Dry dressing applied; procedure tolerated well.';

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
    expect(suggestionOf(result)?.code).toBe('10060');
    expect(suggestionOf(result)?.justification).toContain('none of the complexity elements');
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
    expect(suggestionOf(result)?.code).toBe('10061');
    expect(suggestionOf(result)?.justification).toContain(label);
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
    expect(suggestionOf(result)?.code).toBe('10061');
    expect(suggestionOf(result)?.justification).toContain('packing placed');
  });

  it('negated complexity language stays 10060', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({
        bodySite: 'Torso',
        procedureDetails:
          SIMPLE_ID_TEXT + ' No packing was placed. Loculations were not broken up. No drain was left in place.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('10060');
  });
});

describe('incision-drainage forward: the I&D itself has to be documented before a code is asserted', () => {
  it('an essentially empty note asks rather than asserting 10060', () => {
    const result = incisionDrainageFamily.suggestCode({
      procedureType: 'Incision and Drainage (I&D) of Abscess',
    });
    expect(suggestionOf(result)).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('The procedure itself is not documented');
    expect(ask?.message).toContain('the incision and the drainage');
    expect(ask?.message).toContain('to Procedure details');
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['10060', '10061']);
    expect(offeredSummary(result.outcome)).toContain('10060');
    expect(offeredSummary(result.outcome)).toContain('10061');
  });

  it('half the procedure documented still asks, naming only the missing half', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({ bodySite: 'Torso', procedureDetails: '~5 mL purulent drainage expressed.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('(the incision missing)');
  });

  it('complexity language alone, with no I&D on the page, asks rather than asserting 10061', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({ bodySite: 'Torso', procedureDetails: 'Iodoform packing placed.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['10060', '10061']);
  });
});

describe('incision-drainage: site- and lesion-specific I&D codes are reported, never coded as 10060/10061', () => {
  it.each([
    ['a pilonidal abscess', 'Pilonidal abscess in the sacrococcygeal midline incised; purulent drainage.', '10080'],
    ['a perianal abscess', 'Perianal abscess incised and drained; purulent drainage expressed.', '46050'],
    ['an external-ear abscess', 'Auricular abscess of the external ear incised; pus expressed.', '69000'],
    ['a finger abscess', 'Felon of the left index finger incised; purulent drainage expressed.', '26010'],
    ['a hematoma', 'Fluctuant hematoma over the forearm incised and drained.', '10140'],
  ])('%s ⇒ no suggestion, not assessed with %s named', (_label, procedureDetails, expectedCodes) => {
    const result = incisionDrainageFamily.suggestCode(input({ procedureDetails }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain(expectedCodes);
    const note = result.findings[0];
    expect(note?.message).toContain(expectedCodes);
    expect(citedText(note)).toBeDefined();
  });

  it('the structured body site is read as well as the details text', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({ otherBodySite: 'Pilonidal sinus', procedureDetails: SIMPLE_ID_TEXT })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(notAssessedReason(result)).toContain('10080');
  });

  it('a selected 10060 is contradicted when the note names a pilonidal abscess', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: 'Pilonidal abscess incised and drained; purulent drainage expressed.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '10080', '10060')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
    expect(hasFinding(result.findings, 'required', 'is not documented', '10060')).toBe(false);
  });

  it('an ordinary cutaneous abscess is unaffected by the out-of-scope table', () => {
    const result = incisionDrainageFamily.suggestCode(input({ bodySite: 'Torso', procedureDetails: SIMPLE_ID_TEXT }));
    expect(suggestionOf(result)?.code).toBe('10060');
    expect(isNotAssessed(result)).toBe(false);
  });
});

describe('incision-drainage: multiplicity has to be about the abscesses drained at this encounter', () => {
  it('a history of recurrent abscesses does not upcode to 10061', () => {
    const result = incisionDrainageFamily.suggestCode(
      input({
        bodySite: 'Torso',
        procedureDetails: 'Patient has a history of recurrent abscesses. Stab incision made; pus drained.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('10060');
    expect(suggestionOf(result)?.justification).toContain('none of the complexity elements');
  });

  it('a selected 10060 is not contradicted by a history mention of abscesses', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: 'History of recurrent abscesses. ' + SIMPLE_ID_TEXT,
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['10060']);
  });

  it.each([
    ['Two separate abscesses were incised and drained.'],
    ['Multiple abscesses over the back were each incised and drained.'],
    ['Incised and drained three separate abscesses.'],
  ])('%s still selects 10061', (elementText) => {
    const result = incisionDrainageFamily.suggestCode(
      input({ bodySite: 'Torso', procedureDetails: SIMPLE_ID_TEXT + ' ' + elementText })
    );
    expect(suggestionOf(result)?.code).toBe('10061');
    expect(suggestionOf(result)?.justification).toContain('multiple abscesses');
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
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '10061');
    expect(contradiction?.message).toContain('does not document any complexity element');
    expect(contradiction?.message).toContain('as documented this supports 10060 (simple or single abscess)');
    expect(contradiction?.message).toContain('If one was performed, add it to Procedure details');
    expect(contradiction?.message).toContain('probing of the abscess cavity');
    expect(contradiction?.message).toContain('or multiple abscesses');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('10060 selected with packing only ⇒ a [B] hint, and 10060 stays supported', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT + ' Iodoform packing placed in the cavity.',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    const hint = result.findings.find((f) => f.level === 'bestPractice' && findingCode(f) === '10060');
    expect(hint?.message).toContain('packing supports a complicated I&D rather than establishing one on its own');
    expect(hint?.message).toContain('10060 stands as documented');
    expect(hint?.message).not.toContain('packing placed,');
    expect(citedText(hint)).toContain('packing');
    expect(supportedCodes(result)).toEqual(['10060']);
  });

  it('packing alongside another element is still a hard [C] against 10060', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10060', display: 'I&D simple' }],
        procedureDetails: SIMPLE_ID_TEXT + ' The cavity was probed; iodoform packing placed.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'as documented this supports 10061', '10060')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(hasFinding(result.findings, 'bestPractice', 'Anaesthesia / medication used field')).toBe(false);
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
    expect(supportedCodes(result)).toEqual(['10061']);
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
    expect(supportedCodes(result)).toEqual(['10060']);
  });

  it('unmodeled I&D-adjacent code (10160, puncture aspiration) ⇒ not assessed, never guessed', () => {
    const result = incisionDrainageFamily.defendCodes(
      input({
        bodySite: 'Torso',
        cptCodes: [{ code: '10160', display: 'Puncture aspiration of abscess' }],
        procedureDetails: SIMPLE_ID_TEXT,
      })
    );
    expect(notAssessedCodes(result)).toContain('10160');
    expect(result.findings.filter((f) => findingCode(f) === '10160')).toHaveLength(0);
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
    expect(supportedCodes(result)).toEqual(['10060']);
    expect(notAssessedCodes(result)).toEqual(['99213']);
  });
});

describe('incision-drainage family metadata', () => {
  it('uses the structured length input (drives the conditional cm field)', () => {
    expect(incisionDrainageFamily.structuredFieldsFor({})).toContain(ProcedureStructuredField.Length);
  });
});
