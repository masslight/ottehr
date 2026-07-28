import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput, ProcedureStructuredField } from '../model.types';
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
import { extractForeignBodyFacts, foreignBodyFamily } from './foreign-body';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)', ...overrides };
}

const SKIN_INCISION_TEXT =
  '#11 blade stab incision over the foreign body; 4 mm wooden splinter removed completely intact. Hemostasis achieved.';
const DEEP_DISSECTION_TEXT = ' Deep dissection through subcutaneous tissue was required to reach the fragment.';

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
    expect(
      detectProcedureFamily({ cptCodes: [{ code: '65220', display: 'Removal FB corneal without slit lamp' }] })?.id
    ).toBe('foreign-body');
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
    expect(suggestionOf(result)?.code).toBe('10120');
    expect(suggestionOf(result)?.justification).toContain('incision');
  });

  it('skin site with deep dissection documented ⇒ 10121', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Arm', procedureDetails: SKIN_INCISION_TEXT + DEEP_DISSECTION_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('10121');
    expect(suggestionOf(result)?.justification).toContain('deep dissection');
  });

  it('skin site without a documented incision ⇒ no suggestion; the incision is the open determinant', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: 'Wooden splinter removed with forceps. Hemostasis achieved.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(
      hasFinding(result.findings, 'determines', /incision is not documented.*defined as removal by incision/)
    ).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['10120', '10121', 'none']);
    expect(offeredCandidates(result.outcome)?.[2].display).toContain('part of the visit (E/M) charge');
    expect(offeredSummary(result.outcome)).toBe(
      '10120–10121, or no separate procedure code — whether an incision was made decides which'
    );
  });

  it('nose ⇒ 30300', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Nose', bodySide: 'Left', procedureDetails: 'Plastic bead removed from the nostril intact.' })
    );
    expect(suggestionOf(result)?.code).toBe('30300');
  });

  it('nose resolved from the details text alone ⇒ 30300', () => {
    const result = foreignBodyFamily.suggestCode(input({ procedureDetails: 'Bead removed from the left nostril.' }));
    expect(suggestionOf(result)?.code).toBe('30300');
  });

  it('eye with slit-lamp use documented in the text ⇒ 65222', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Eye',
        procedureDetails: 'Corneal metallic foreign body removed at the slit lamp with a burr.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('65222');
    expect(suggestionOf(result)?.justification).toContain('slit-lamp');
  });

  it('eye with slit lamp recorded as a Technique value ⇒ 65222', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', technique: ['Slit Lamp & Burr'], procedureDetails: 'Corneal foreign body removed.' })
    );
    expect(suggestionOf(result)?.code).toBe('65222');
  });

  it('explicit corneal removal without a slit lamp ⇒ 65220', () => {
    const facts = extractForeignBodyFacts(
      input({ bodySite: 'Eye', procedureDetails: 'Corneal foreign body removed without a slit lamp.' })
    );
    expect(facts.slitLampDocumented).toBeUndefined();
    expect(facts.withoutSlitLampDocumented?.value).toBe(true);

    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', procedureDetails: 'Corneal foreign body removed without a slit lamp.' })
    );
    expect(result.findings).toEqual([]);
    expect(suggestionOf(result)?.code).toBe('65220');
    expect(suggestionOf(result)?.justification).toContain('without a slit lamp');
  });

  it('corneal removal with no slit-lamp answer ⇒ both codes stay open rather than guessing', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', procedureDetails: 'Corneal foreign body removed with a moistened swab.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'Slit-lamp use is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['65220', '65222']);
    expect(offeredSummary(result.outcome)).toBe(
      '65220–65222 — whether a slit lamp was used selects 65222 (with slit lamp) or 65220 (without slit lamp)'
    );
  });

  it('ear canal without documented anesthesia ⇒ 69200', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Ear', procedureDetails: 'Insect removed from the ear canal with alligator forceps.' })
    );
    expect(suggestionOf(result)?.code).toBe('69200');
  });

  it('ear canal with topical anesthesia ⇒ still 69200 (69200 excludes general anesthesia only)', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Ear',
        procedureDetails: 'Canal anesthetized with topical lidocaine; bead removed with alligator forceps.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('69200');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('ear canal with local anesthesia in the structured medication field ⇒ still 69200', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Ear',
        medicationUsed: 'topical lidocaine',
        procedureDetails: 'Bead removed from the ear canal.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('69200');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });

  it('ear canal under general anesthesia ⇒ no suggestion, [C] pointing at the unassessed 69205', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Ear',
        procedureDetails: 'Bead removed from the ear canal in the OR under general anesthesia.',
      })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', /without general anesthesia.*69205/)).toBe(true);
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('69205');
  });

  it.each([
    ['procedural sedation', 'Foreign body removed from the ear canal under procedural sedation with ketamine.'],
    ['sedated in the ED', 'Child sedated for the procedure; bead removed from the ear canal.'],
  ])('ear canal with %s ⇒ the 69205 [C], not a 69200 suggestion', (_label, details) => {
    const result = foreignBodyFamily.suggestCode(input({ bodySite: 'Ear', procedureDetails: details }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', '69205')).toBe(true);
  });

  it('nose under general anesthesia ⇒ no 30300 suggestion, [C] pointing at the unassessed 30310', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Nose',
        bodySide: 'Left',
        procedureDetails: 'Bead removed from the left nostril under general anesthesia.',
      })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', /office-type intranasal foreign-body removal.*30310/)).toBe(
      true
    );
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('30310');
  });

  it('nose with topical anesthesia ⇒ still 30300', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Nose',
        bodySide: 'Left',
        medicationUsed: 'topical lidocaine',
        procedureDetails: 'Plastic bead removed from the nostril intact.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('30300');
  });

  it('no site documented ⇒ [D] ask and the full six-code open set', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ procedureDetails: 'Foreign body removed without difficulty.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'Site/location field')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual([
      '10120',
      '10121',
      '30300',
      '65220',
      '65222',
      '69200',
    ]);
    expect(offeredSummary(result.outcome)).toBe(
      '10120, 10121, 30300, 65220, 65222, 69200 — the documented body site selects the branch'
    );
  });
});

describe('foreign-body forward: 65220/65222 are corneal only', () => {
  it('a conjunctival foreign body is not 65220/65222 — it is honestly not assessed', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        procedureDetails: 'Conjunctival foreign body removed at the slit lamp.',
      })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('65205/65210');
    expect(offeredCandidates(result.outcome)).toBeUndefined();
  });

  it('an eyelid foreign body is not 65220/65222 either', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eyelid', procedureDetails: 'Foreign body embedded in the eyelid removed at the slit lamp.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('67938');
  });

  it('an incidental conjunctival mention does not derail a documented corneal removal', () => {
    const result = foreignBodyFamily.suggestCode(
      input({
        bodySite: 'Eye',
        procedureDetails:
          'Conjunctival injection noted. Corneal metallic foreign body removed at the slit lamp with a burr.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('65222');
  });

  it('an eye note that never says which structure ⇒ [D] ask, not a corneal-code guess', () => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Eye', procedureDetails: 'Foreign body removed at the slit lamp with a needle.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /eye structure is not documented.*65205\/65210/)).toBe(true);
    expect(hasFinding(result.findings, 'determines', 'Procedure details')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['65222']);
    expect(offeredSummary(result.outcome)).toContain('65222');
  });
});

describe('foreign-body forward: the CPT "complicated" elements select 10121', () => {
  it.each([
    ['multiple foreign bodies', ' Multiple wooden splinters were removed from the wound.'],
    ['imaging-assisted localization', ' The fragment was localized with bedside ultrasound guidance.'],
    ['an explicitly complicated removal', ' This was a complicated removal.'],
  ])('%s documented ⇒ 10121', (label, extraText) => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: SKIN_INCISION_TEXT + extraText })
    );
    expect(suggestionOf(result)?.code).toBe('10121');
    expect(suggestionOf(result)?.justification).toContain(label);
  });

  it.each([
    ['a single foreign body that broke up', ' The splinter came out in multiple fragments.'],
    ['an x-ray that only confirmed removal', ' Post-procedure x-ray showed no retained foreign body.'],
  ])('%s does not make the removal complicated ⇒ 10120', (_label, extraText) => {
    const result = foreignBodyFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: SKIN_INCISION_TEXT + extraText })
    );
    expect(suggestionOf(result)?.code).toBe('10120');
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
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '10120');
    expect(contradiction?.message).toBe(
      '10120 requires removal by incision — the note does not document an incision. If one was made, add it to Procedure details, e.g. "#11 blade stab incision over the foreign body".'
    );
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('10121 selected with none of the complicating elements documented ⇒ supports-10120 [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10121', display: 'FB removal complicated' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '10121');
    expect(contradiction?.message).toContain('as documented this supports 10120');
    expect(contradiction?.message).toContain('If it was performed, add it');
    for (const element of [
      'deep dissection',
      'multiple foreign bodies',
      'imaging-assisted localization',
      'an explicitly complicated removal',
    ]) {
      expect(contradiction?.message).toContain(element);
    }
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it.each([
    ['multiple foreign bodies', ' Multiple wooden splinters were removed.'],
    ['ultrasound localization', ' Fragment localized with bedside ultrasound guidance.'],
  ])('10121 selected with %s documented ⇒ no complexity [C]', (_label, extraText) => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        lengthCm: 0.6,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '10121', display: 'FB removal complicated' }],
        procedureDetails: SKIN_INCISION_TEXT + extraText,
      })
    );
    expect(supportedCodes(result)).toEqual(['10121']);
  });

  it('65222 selected without a slit-lamp answer ⇒ [D], not a guessed contradiction', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails: 'Corneal metallic foreign body removed completely. Fluorescein exam: no residual uptake.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'Slit-lamp use is not documented', '65222')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('65220 is supported when corneal removal without a slit lamp is documented', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65220', display: 'Removal FB corneal without slit lamp' }],
        procedureDetails:
          'Without a slit lamp, the corneal metallic foreign body was removed completely intact. Fluorescein: no residual uptake.',
      })
    );
    expect(supportedCodes(result)).toEqual(['65220']);
  });

  it('the documented slit-lamp choice contradicts the opposite corneal code in both directions', () => {
    const without = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails:
          'Corneal metallic foreign body removed completely without a slit lamp. Fluorescein: no residual uptake.',
      })
    );
    expect(hasFinding(without.findings, 'contradiction', 'supports 65220', '65222')).toBe(true);

    const withSlit = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65220', display: 'Removal FB corneal without slit lamp' }],
        procedureDetails:
          'Corneal metallic foreign body removed completely at the slit lamp. Fluorescein: no residual uptake.',
      })
    );
    expect(hasFinding(withSlit.findings, 'contradiction', 'supports 65222', '65220')).toBe(true);
  });

  it('69200 selected with topical anesthesia in the structured medication field ⇒ no [C], code supported', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        medicationUsed: 'topical lidocaine',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Plastic bead removed completely intact from the ear canal. TM intact.',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['69200']);
  });

  it('69200 selected with local anesthetic language in the text ⇒ no [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Canal anesthetized with lidocaine drops; plastic bead removed completely intact. TM intact.',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['69200']);
  });

  it('69200 selected under general anesthesia ⇒ [C] naming 69205, which stays not assessed', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [
          { code: '69200', display: 'Removal FB ear canal' },
          { code: '69205', display: 'Removal FB ear canal, general anesthesia' },
        ],
        procedureDetails:
          'Bead removed completely intact from the ear canal under general anesthesia in the OR. TM intact.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '69200');
    expect(contradiction?.message).toContain('without general anesthesia');
    expect(contradiction?.message).toContain('69205');
    expect(citedText(contradiction)).toContain('general anesthesia');
    expect(notAssessedCodes(result)).toEqual(['69205']);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('69200 selected with sedation in the structured medication field ⇒ the same [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        medicationUsed: 'ketamine (procedural sedation)',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails: 'Plastic bead removed completely intact from the ear canal. TM intact.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '69200');
    expect(evidenceSource(contradiction)).toBe('field');
    expect(contradiction?.message).toContain('69205');
  });

  it('30300 selected under general anesthesia ⇒ [C] naming 30310, which stays not assessed', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Nose',
        bodySide: 'Left',
        cptCodes: [
          { code: '30300', display: 'Removal FB intranasal' },
          { code: '30310', display: 'Removal FB intranasal, general anesthesia' },
        ],
        procedureDetails:
          'Plastic bead removed completely intact from the left nostril under general anesthesia. No further bleeding.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '30300');
    expect(contradiction?.message).toContain('office-type');
    expect(contradiction?.message).toContain('30310');
    expect(notAssessedCodes(result)).toEqual(['30310']);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('30300 selected with topical anesthesia only ⇒ no [C]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Nose',
        bodySide: 'Left',
        medicationUsed: 'topical lidocaine',
        cptCodes: [{ code: '30300', display: 'Removal FB intranasal' }],
        procedureDetails: 'Plastic bead removed completely intact from the left nostril. No further bleeding.',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['30300']);
  });

  it.each([
    ['conjunctival', 'Conjunctival foreign body removed at the slit lamp completely intact. Fluorescein: no uptake.'],
    ['eyelid', 'Foreign body embedded in the upper lid removed at the slit lamp intact. Fluorescein: no uptake.'],
  ])('65222 selected for a %s foreign body ⇒ [C], because 65222 is corneal only', (label, details) => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails: details,
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '65222');
    expect(contradiction?.message).toContain(label);
    expect(contradiction?.message).toContain('corneal removal only');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('65222 selected on an eye note that never names the structure ⇒ [D] ask', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Eye',
        bodySide: 'Right',
        cptCodes: [{ code: '65222', display: 'Removal FB corneal with slit lamp' }],
        procedureDetails: 'Metallic foreign body removed completely at the slit lamp. Fluorescein: no residual uptake.',
      })
    );
    expect(hasFinding(result.findings, 'determines', /eye structure is not documented for 65222/, '65222')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
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

  it('a skin code on a paired site requires laterality for green support', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'required', 'Side of body field', '10120')).toBe(true);
  });

  it('a skin code on a midline site does not invent a laterality requirement', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Torso',
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

  it.each(['Engorged tick removed with fine forceps.', 'Bee stinger removed from the left forearm with forceps.'])(
    '"%s" satisfies the foreign-body description',
    (text) => {
      const facts = extractForeignBodyFacts(input({ procedureDetails: text }));
      expect(facts.descriptionDocumented?.value).toBe(true);
    }
  );

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
        bodySide: 'Left',
        lengthCm: 0.4,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['10120']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('fully documented 10121 (deep dissection) is supported', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        bodySide: 'Left',
        lengthCm: 0.6,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '10121', display: 'FB removal complicated' }],
        procedureDetails: SKIN_INCISION_TEXT + DEEP_DISSECTION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['10121']);
  });

  it('fully documented 69200 is supported, and still gets the anesthesia [B]', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Ear',
        bodySide: 'Left',
        cptCodes: [{ code: '69200', display: 'Removal FB ear canal' }],
        procedureDetails:
          'Insect foreign body removed completely intact from the ear canal using alligator forceps. Canal without abrasion; TM intact.',
      })
    );
    expect(supportedCodes(result)).toEqual(['69200']);
    expect(hasFinding(result.findings, 'bestPractice', 'Anaesthesia / medication used field')).toBe(true);
  });

  it('missing anesthesia is a best practice, never a code driver', () => {
    const result = foreignBodyFamily.defendCodes(
      input({
        bodySite: 'Hand',
        bodySide: 'Left',
        lengthCm: 0.4,
        cptCodes: [{ code: '10120', display: 'FB removal simple' }],
        procedureDetails: SKIN_INCISION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['10120']);
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
    expect(notAssessedCodes(result)).toEqual(['30310', '65205']);
    expect(result.findings.filter((f) => findingCode(f) !== undefined)).toHaveLength(0);
  });
});

describe('foreign-body family metadata', () => {
  it('uses the structured length input (drives the conditional cm field for skin FBR)', () => {
    expect(foreignBodyFamily.structuredFieldsFor({})).toContain(ProcedureStructuredField.Length);
  });
});
