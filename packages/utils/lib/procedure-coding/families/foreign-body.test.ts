import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { foreignBodyFamily } from './foreign-body';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)', ...overrides };
}

// Skin branch, [R]-complete for 10120: incision + description + outcome + hemostasis.
const SKIN_INCISION_TEXT =
  '#11 blade stab incision over the foreign body; 4 mm wooden splinter removed completely intact. Hemostasis achieved.';
const DEEP_DISSECTION_TEXT = ' Deep dissection through subcutaneous tissue was required to reach the fragment.';

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

describe('foreign-body detection', () => {
  it.each([
    'Foreign Body Removal (Skin, Ear, Nose, Eye)',
    'Eye Irrigation or Eye Foreign Body Removal',
    'Tick or Insect Removal',
    'foreign-body-removal',
  ])('detects the product procedure type "%s"', (procedureType) => {
    expect(detectProcedureFamily({ procedureType })?.id).toBe('foreign-body');
  });

  it('detects from a selected removal code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '30300', display: 'Removal FB intranasal' }] })?.id).toBe(
      'foreign-body'
    );
    expect(detectProcedureFamily({ cptCodes: [{ code: '10120', display: 'FB removal simple' }] })?.id).toBe(
      'foreign-body'
    );
  });

  it('does not claim laceration entries, and laceration does not claim FBR entries', () => {
    expect(foreignBodyFamily.detect({ procedureType: 'Laceration Repair (Suturing/Stapling)' })).toBe(false);
    expect(lacerationFamily.detect({ procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)' })).toBe(false);
  });

  it('does not claim cerumen entries', () => {
    expect(foreignBodyFamily.detect({ procedureType: 'Ear Lavage / Cerumen Removal' })).toBe(false);
  });
});

describe('foreign-body forward: the site selects the code branch', () => {
  it('skin site with a documented incision and no deep dissection ⇒ 10120', () => {
    const result = foreignBodyFamily.suggestCode(input({ bodySite: 'Hand', procedureDetails: SKIN_INCISION_TEXT }));
    expect(result.suggestion?.code).toBe('10120');
    expect(result.suggestion?.justification).toContain('incision');
  });

  it('skin site with deep dissection documented ⇒ 10121', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Arm', procedureDetails: SKIN_INCISION_TEXT + DEEP_DISSECTION_TEXT })
    );
    expect(result.suggestion?.code).toBe('10121');
    expect(result.suggestion?.justification).toContain('deep dissection');
  });

  it('skin site without a documented incision ⇒ no suggestion; the incision is the open determinant', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: 'Wooden splinter removed with forceps. Hemostasis achieved.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(
      hasFinding(result.findings, 'determines', /incision is not documented.*defined as removal by incision/)
    ).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['10120', '10121']);
  });

  it('nose ⇒ 30300', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Nose', bodySide: 'Left', procedureDetails: 'Plastic bead removed from the nostril intact.' })
    );
    expect(result.suggestion?.code).toBe('30300');
  });

  it('nose resolved from the details text alone ⇒ 30300', () => {
    const result = foreignBodyFamily.suggestCode(input({ procedureDetails: 'Bead removed from the left nostril.' }));
    expect(result.suggestion?.code).toBe('30300');
  });

  it('eye with slit-lamp use documented in the text ⇒ 65222', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Eye',
        procedureDetails: 'Corneal metallic foreign body removed at the slit lamp with a burr.',
      })
    );
    expect(result.suggestion?.code).toBe('65222');
    expect(result.suggestion?.justification).toContain('slit-lamp');
  });

  it('eye with slit lamp recorded as a Technique value ⇒ 65222', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', technique: ['Slit Lamp & Burr'], procedureDetails: 'Corneal foreign body removed.' })
    );
    expect(result.suggestion?.code).toBe('65222');
  });

  it('eye without slit-lamp documentation ⇒ no suggestion; slit lamp is the open determinant', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', procedureDetails: 'Corneal foreign body removed with a moistened swab.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'Slit-lamp use is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['65222']);
  });

  it('ear canal without documented anesthesia ⇒ 69200', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Ear', procedureDetails: 'Insect removed from the ear canal with alligator forceps.' })
    );
    expect(result.suggestion?.code).toBe('69200');
  });

  it('ear canal with documented anesthesia ⇒ no suggestion + the anesthesia [C]', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Ear',
        medicationUsed: 'topical lidocaine',
        procedureDetails: 'Bead removed from the ear canal.',
      })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', '69200 is defined as removal of a foreign body')).toBe(true);
  });

  it('no site documented ⇒ [D] ask and the full five-code open set', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ procedureDetails: 'Foreign body removed without difficulty.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'Site/location field')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['10120', '10121', '30300', '65222', '69200']);
  });
});

describe('foreign-body inverse: pinned contradiction cases', () => {
  it('10120 selected without a documented incision ⇒ [C] with the code-definition wording', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: 'Wooden splinter removed with forceps, completely intact. Hemostasis achieved.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '10120');
    expect(contradiction?.message).toBe(
      '10120 requires removal by incision — the note does not document an incision. If one was made, add it to Procedure details, e.g. "#11 blade stab incision over the foreign body".'
    );
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('10121 selected without deep-dissection documentation ⇒ supports-10120 [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10121', display: 'FB removal complicated' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '10121');
    expect(contradiction?.message).toContain('as documented this supports 10120');
    expect(contradiction?.message).toContain('If it was performed, add it');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('65222 selected without slit-lamp documentation ⇒ [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails: 'Corneal metallic foreign body removed completely. Fluorescein exam: no residual uptake.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'does not document slit-lamp use', '65222')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('69200 selected with anesthesia in the structured medication field ⇒ [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        medicationUsed: 'topical lidocaine',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Plastic bead removed completely intact from the ear canal. TM intact.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'without anesthesia', '69200')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('69200 selected with anesthetic language in the text ⇒ the same [C], citing the snippet', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Canal anesthetized with lidocaine drops; plastic bead removed completely intact. TM intact.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '69200');
    expect(contradiction?.sourceText).toContain('lidocaine');
  });

  it('selected code from a different branch than the documented site ⇒ [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        cptCodes: [{ code: '30300', display: 'Removal FB intranasal' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        '30300 covers removal of an intranasal foreign body, but the note documents the foreign body in the skin/soft tissue.',
        '30300'
      )
    ).toBe(true);
  });

  it('no site documented ⇒ [D] ask per selected code', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Foreign body removed without difficulty.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'Site/location field', '69200')).toBe(true);
  });
});

describe('foreign-body inverse: [R] elements name their destination fields', () => {
  it('paired-site codes ask for laterality in the Side of body field', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Nose',
        cptCodes: [{ code: '30300', display: 'Removal FB intranasal' }],
        procedureDetails: 'Bead removed from the nostril completely intact. No further bleeding.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'Side of body field', '30300')).toBe(true);
  });

  it('a skin code does not ask for laterality (not a paired-site code)', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'required', 'Side of body field')).toBe(false);
  });

  it('missing description, outcome, and post-assessment surface as [R] asks with examples', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: 'Stab incision made over the area.',
      })
    );
    expect(hasFinding(result.findings, 'required', /foreign body is not described.*wooden splinter/, '10120')).toBe(
      true
    );
    expect(
      hasFinding(result.findings, 'required', /Complete removal is not documented.*removed completely intact/, '10120')
    ).toBe(true);
    expect(hasFinding(result.findings, 'required', /post-removal assessment.*hemostasis/, '10120')).toBe(true);
  });

  it('the post-assessment ask is site-matched: fluorescein for the eye, TM intact for the ear', () => {
    const eye = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Left',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails: 'Corneal metallic foreign body removed completely at the slit lamp.',
      })
    );
    expect(hasFinding(eye.findings, 'required', /fluorescein/, '65222')).toBe(true);
    const ear = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Plastic bead removed completely intact from the ear canal.',
      })
    );
    expect(hasFinding(ear.findings, 'required', /TM is intact/, '69200')).toBe(true);
  });
});

describe('foreign-body inverse: supported state and scope honesty', () => {
  it('fully documented 10120 is supported with no [D]/[R]/[C] findings', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 0.4,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['10120']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('fully documented 10121 (deep dissection) is supported', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 0.6,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '10121', display: 'FB removal complicated' }],
        procedureDetails: SKIN_INCISION_TEXT + DEEP_DISSECTION_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['10121']);
  });

  it('fully documented 69200 is supported (no anesthesia, correctly)', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails:
          'Insect foreign body removed completely intact from the ear canal using alligator forceps. Canal without abrasion; TM intact.',
      })
    );
    expect(result.supportedCodes).toEqual(['69200']);
    expect(hasFinding(result.findings, 'bestPractice', /Anesthesia/)).toBe(false); // 69200 is defined without it
  });

  it('missing anesthesia is only a best practice for non-69200 codes', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 0.4,
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['10120']);
    expect(hasFinding(result.findings, 'bestPractice', 'Anaesthesia / medication used field')).toBe(true);
  });

  it('unmodeled removal codes (30310 general-anesthesia nasal, 65205 conjunctival) ⇒ not assessed, never guessed', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Nose',
        cptCodes: [
          { code: '30310', display: 'Removal FB intranasal, general anesthesia' },
          { code: '65205', display: 'Removal FB conjunctival superficial' },
        ],
        procedureDetails: 'Bead removed from the nostril.',
      })
    );
    expect(result.notAssessedCodes).toEqual(['30310', '65205']);
    expect(result.findings.filter((f) => f.cptCode !== undefined)).toHaveLength(0);
  });
});

describe('foreign-body family metadata', () => {
  it('uses the structured length input (drives the conditional cm field for skin FBR)', () => {
    expect(foreignBodyFamily.usesStructuredLength).toBe(true);
  });
});
