import { describe, expect, it } from 'vitest';
import { Finding, ProcedureFactsInput } from '../model.types';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Laceration Repair (Suturing/Stapling)', ...overrides };
}

const SIMPLE_CLOSURE_TEXT = 'Single-layer closure with 4-0 Ethilon, total stitch count: 5.';
const LAYERED_CLOSURE_TEXT =
  'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8.';

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

describe('laceration forward: band boundaries', () => {
  // [bodySite, closure text, [lengthCm, expected code][]]
  const boundaryCases: Array<[string, string, string, Array<[number, string]>]> = [
    [
      'simple, scalp/neck/axillae/genitalia/trunk/extremities (12001-12007)',
      'Arm',
      SIMPLE_CLOSURE_TEXT,
      [
        [0.5, '12001'],
        [2.5, '12001'],
        [2.6, '12002'],
        [7.5, '12002'],
        [7.6, '12004'],
        [12.5, '12004'],
        [12.6, '12005'],
        [20.0, '12005'],
        [20.1, '12006'],
        [30.0, '12006'],
        [30.1, '12007'],
        [45.0, '12007'],
      ],
    ],
    [
      'simple, face/ears/eyelids/nose/lips/mucous membranes (12011-12018)',
      'Face',
      SIMPLE_CLOSURE_TEXT,
      [
        [2.5, '12011'],
        [2.6, '12013'],
        [5.0, '12013'],
        [5.1, '12014'],
        [7.5, '12014'],
        [7.6, '12015'],
        [12.5, '12015'],
        [12.6, '12016'],
        [20.0, '12016'],
        [20.1, '12017'],
        [30.0, '12017'],
        [30.1, '12018'],
      ],
    ],
    [
      'intermediate, scalp/axillae/trunk/extremities excl. hands+feet (12031-12037)',
      'Torso',
      LAYERED_CLOSURE_TEXT,
      [
        [2.5, '12031'],
        [2.6, '12032'],
        [7.5, '12032'],
        [7.6, '12034'],
        [12.5, '12034'],
        [12.6, '12035'],
        [20.0, '12035'],
        [20.1, '12036'],
        [30.0, '12036'],
        [30.1, '12037'],
      ],
    ],
    [
      'intermediate, neck/hands/feet/genitalia (12041-12047)',
      'Hand',
      LAYERED_CLOSURE_TEXT,
      [
        [2.5, '12041'],
        [2.6, '12042'],
        [7.5, '12042'],
        [7.6, '12044'],
        [12.5, '12044'],
        [12.6, '12045'],
        [20.0, '12045'],
        [20.1, '12046'],
        [30.0, '12046'],
        [30.1, '12047'],
      ],
    ],
    [
      'intermediate, face/ears/eyelids/nose/lips/mucous membranes (12051-12057)',
      'Face',
      LAYERED_CLOSURE_TEXT,
      [
        [2.5, '12051'],
        [2.6, '12052'],
        [7.5, '12052'],
        [7.6, '12054'],
        [12.5, '12054'],
        [12.6, '12055'],
        [20.0, '12055'],
        [20.1, '12056'],
        [30.0, '12056'],
        [30.1, '12057'],
      ],
    ],
  ];

  for (const [label, bodySite, closureText, pairs] of boundaryCases) {
    describe(label, () => {
      it.each(pairs)('%s cm → %s', (lengthCm, expectedCode) => {
        const result = lacerationFamily.suggestCode(input({ bodySite, lengthCm, procedureDetails: closureText }));
        expect(result.suggestion?.code).toBe(expectedCode);
      });
    });
  }
});

describe('laceration forward: site groups differ per class', () => {
  it.each([
    ['Hand', SIMPLE_CLOSURE_TEXT, '12002'], // simple: hands sit with trunk/extremities
    ['Hand', LAYERED_CLOSURE_TEXT, '12042'], // intermediate: hands move to neck/hands/feet/genitalia
    ['Foot', SIMPLE_CLOSURE_TEXT, '12002'],
    ['Foot', LAYERED_CLOSURE_TEXT, '12042'],
    ['Neck', SIMPLE_CLOSURE_TEXT, '12002'],
    ['Neck', LAYERED_CLOSURE_TEXT, '12042'],
    ['Head', LAYERED_CLOSURE_TEXT, '12032'], // scalp stays with trunk/extremities for intermediate
    ['Arm', LAYERED_CLOSURE_TEXT, '12032'],
  ])('%s with %s → %s at 3.0 cm', (bodySite, closureText, expectedCode) => {
    const result = lacerationFamily.suggestCode(input({ bodySite, lengthCm: 3.0, procedureDetails: closureText }));
    expect(result.suggestion?.code).toBe(expectedCode);
  });
});

describe('laceration forward: repair class paths', () => {
  it('layered closure ⇒ intermediate', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe('12032');
    expect(result.suggestion?.justification).toContain('layered closure documented');
  });

  it('single-layer + heavy contamination with extensive cleaning ⇒ intermediate, noted in the justification', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Torso',
        lengthCm: 4.0,
        procedureDetails:
          'Heavily contaminated wound; extensively cleaned and irrigated with 500 mL saline. Single-layer closure with 4-0 Ethilon, total stitch count: 6.',
      })
    );
    expect(result.suggestion?.code).toBe('12032');
    expect(result.suggestion?.justification).toContain('contamination path');
  });

  it('tissue-adhesive-only closure ⇒ simple, with the Medicare G0168 payer footnote', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Face',
        lengthCm: 1.5,
        procedureDetails: 'Wound edges approximated with Dermabond tissue adhesive. No sutures required.',
      })
    );
    expect(result.suggestion?.code).toBe('12011');
    expect(result.payerNotes?.some((n) => n.includes('G0168'))).toBe(true);
  });

  it('adhesive strips only ⇒ no repair code supported', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 2.0,
        procedureDetails: 'Steri-strips applied to the wound. No sutures required.',
      })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', 'adhesive strips')).toBe(true);
  });

  it('debridement/undermining language ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        procedureDetails: 'Wound edges debrided and undermined prior to closure. ' + SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(result.suggestion).toBeUndefined();
    expect(result.notAssessed).toBe(true);
  });
});

describe('laceration forward: multi-wound sum rule', () => {
  it('sums two same-group wounds: two 2.0 cm scalp simple wounds ⇒ 12002 with 4.0 cm total', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Head',
        procedureDetails:
          'A 2.0 cm laceration of the scalp was closed single-layer with 4-0 Ethilon sutures, total stitch count: 4. ' +
          'A second 2.0 cm laceration of the scalp was closed single-layer with 4-0 Ethilon sutures, total stitch count: 3.',
      })
    );
    expect(result.suggestion?.code).toBe('12002');
    expect(result.suggestion?.justification).toContain('4.0 cm');
  });

  it('does NOT sum different-group wounds; the other-group wound gets its own advisory finding', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Head',
        procedureDetails:
          'A 2.0 cm laceration of the scalp was closed single-layer with 4-0 Ethilon sutures, total stitch count: 4. ' +
          'A 3.0 cm laceration of the left cheek was closed single-layer with 5-0 Ethilon sutures, total stitch count: 5.',
      })
    );
    expect(result.suggestion?.code).toBe('12001'); // scalp wound alone: 2.0 cm, not 5.0
    expect(hasFinding(result.findings, 'bestPractice', 'own procedure entry')).toBe(true);
  });
});

describe('laceration forward: structured length preferred over text', () => {
  it('uses the structured lengthCm and flags the mismatch with the details text', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.2,
        procedureDetails: 'Wound Length: 8 cm. ' + SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(result.suggestion?.code).toBe('12002'); // 3.2 cm, not 8 cm (which would be 12004)
    expect(hasFinding(result.findings, 'contradiction', '3.2')).toBe(true);
    expect(hasFinding(result.findings, 'contradiction', '8.0')).toBe(true);
  });
});

describe('laceration forward: missing determinants', () => {
  it('missing length ⇒ open candidate set for the known class+group, with a [D] finding', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: SIMPLE_CLOSURE_TEXT }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /length/i)).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['12001', '12002', '12004', '12005', '12006', '12007']);
  });

  it('missing depth ⇒ [D] finding and candidates spanning both classes for the site', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.0, procedureDetails: 'Closed with 4-0 Ethilon, total stitch count: 5.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(true);
    const codes = result.openCandidates?.map((c) => c.code) ?? [];
    expect(codes).toContain('12002'); // simple: hand → 1200x
    expect(codes).toContain('12042'); // intermediate: hand → 1204x
  });

  it('nothing documented ⇒ all determinants asked for, full open set', () => {
    const result = lacerationFamily.suggestCode(input({}));
    expect(result.suggestion).toBeUndefined();
    expect(result.findings.filter((f) => f.level === 'determines')).toHaveLength(3);
    expect(result.openCandidates).toHaveLength(31);
  });
});

describe('laceration inverse: pinned contradiction cases', () => {
  it('12002 selected + layered closure documented ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails: LAYERED_CLOSURE_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'layered closure', '12002')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('12013 selected + 8 cm documented ⇒ [C] band mismatch citing the documented length', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Face',
        cptCodes: [{ code: '12013', display: 'Simple repair face 2.6-5.0 cm' }],
        procedureDetails: 'Wound Length: 8 cm. Single-layer closure with running 5-0 nylon, total stitch count: 6.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '8.0', '12013')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('adhesive strips only + any 120xx ⇒ [C] no repair code supported', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 2.0,
        cptCodes: [{ code: '12001', display: 'Simple repair 2.5 cm or less' }],
        procedureDetails: 'Steri-strips applied to the wound. No sutures required.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'adhesive strips', '12001')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('documented site group contradicts the selected code table ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 3.0,
        cptCodes: [{ code: '12013', display: 'Simple repair face 2.6-5.0 cm' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'hand', '12013')).toBe(true);
  });
});

describe('laceration inverse: missing elements', () => {
  it('missing length ⇒ [D] ask naming the element, per selected code', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'determines', /length/i, '12002')).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('missing closure details ⇒ [R] listing the missing pieces per code', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails: 'Single-layer superficial closure of the wound.',
      })
    );
    const required = result.findings.find((f) => f.level === 'required' && f.cptCode === '12002');
    expect(required?.message).toContain('closure method');
    expect(required?.message).toContain('suture material');
    expect(required?.message).toContain('suture count');
  });

  it('missing depth ⇒ [D]; contamination without documented cleaning upgrades irrigation to [R] for an intermediate code', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 3.0,
        cptCodes: [{ code: '12032', display: 'Intermediate repair 2.6-7.5 cm' }],
        procedureDetails: 'Heavily contaminated wound closed with 4-0 Ethilon, total stitch count: 6.',
      })
    );
    expect(hasFinding(result.findings, 'determines', /depth/i, '12032')).toBe(true);
    expect(hasFinding(result.findings, 'required', /cleaning|irrigation/i, '12032')).toBe(true);
  });

  it('complex-repair code (13120) ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '13120', display: 'Complex repair, scalp/arms/legs' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(result.notAssessedCodes).toContain('13120');
    expect(result.findings.filter((f) => f.cptCode === '13120')).toHaveLength(0);
  });
});

describe('laceration inverse: supported state', () => {
  it('fully documented entry supports the selected code with no [D]/[R]/[C] findings', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        lengthCm: 3.0,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails:
          'Single-layer closure with 5 simple interrupted 4-0 Ethilon sutures. Wound irrigated with normal saline. Tetanus status up to date.',
      })
    );
    expect(result.supportedCodes).toEqual(['12002']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('contamination path with documented cleaning supports an intermediate code', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 4.0,
        cptCodes: [{ code: '12032', display: 'Intermediate repair 2.6-7.5 cm' }],
        procedureDetails:
          'Heavily contaminated wound, copiously irrigated with 500 mL normal saline. Single-layer closure with running 4-0 Ethilon, total stitch count: 6.',
      })
    );
    expect(result.supportedCodes).toEqual(['12032']);
  });
});
