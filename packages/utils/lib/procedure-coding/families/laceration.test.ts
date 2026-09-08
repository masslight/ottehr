import { describe, expect, it } from 'vitest';
import {
  CodeOutcomeKind,
  Finding,
  ProcedureFactsInput,
  ProcedureStructuredField,
  RepairDepthSelection,
} from '../model.types';
import {
  findingCode,
  hasFinding,
  isNotAssessed,
  notAssessedCodes,
  offeredCandidates,
  offeredSummary,
  suggestionOf,
  supportedCodes,
} from '../test-support';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Laceration Repair (Suturing/Stapling)', ...overrides };
}

const SIMPLE_CLOSURE_TEXT = 'Single-layer closure with 4-0 Ethilon, total stitch count: 5.';
const LAYERED_CLOSURE_TEXT =
  'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8.';
const COMPLEX_CLOSURE_TEXT = 'Extensive undermining performed. ' + LAYERED_CLOSURE_TEXT;

describe('laceration forward: band boundaries', () => {
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
        expect(suggestionOf(result)?.code).toBe(expectedCode);
      });
    });
  }
});

describe('laceration forward: site groups differ per class', () => {
  it.each([
    ['Hand', SIMPLE_CLOSURE_TEXT, '12002'],
    ['Hand', LAYERED_CLOSURE_TEXT, '12042'],
    ['Foot', SIMPLE_CLOSURE_TEXT, '12002'],
    ['Foot', LAYERED_CLOSURE_TEXT, '12042'],
    ['Neck', SIMPLE_CLOSURE_TEXT, '12002'],
    ['Neck', LAYERED_CLOSURE_TEXT, '12042'],
    ['Head', LAYERED_CLOSURE_TEXT, '12032'],
    ['Arm', LAYERED_CLOSURE_TEXT, '12032'],
  ])('%s with %s → %s at 3.0 cm', (bodySite, closureText, expectedCode) => {
    const result = lacerationFamily.suggestCode(input({ bodySite, lengthCm: 3.0, procedureDetails: closureText }));
    expect(suggestionOf(result)?.code).toBe(expectedCode);
  });
});

describe('laceration forward: repair class paths', () => {
  it('layered closure ⇒ intermediate', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('12032');
    expect(suggestionOf(result)?.justification).toContain('layered closure documented');
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
    expect(suggestionOf(result)?.code).toBe('12032');
    expect(suggestionOf(result)?.justification).toContain('heavily contaminated');
  });

  it('tissue-adhesive-only closure ⇒ simple, with the Medicare G0168 payer footnote', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Face',
        lengthCm: 1.5,
        procedureDetails: 'Wound edges approximated with Dermabond tissue adhesive. No sutures required.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('12011');
    expect(result.payerNotes.some((n) => n.includes('G0168'))).toBe(true);
  });

  it('adhesive strips only ⇒ no repair code supported', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 2.0,
        procedureDetails: 'Steri-strips applied to the wound. No sutures required.',
      })
    );
    expect(result.outcome.kind).toBe(CodeOutcomeKind.NoCode);
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'contradiction', 'adhesive strips')).toBe(true);
  });

  it('tissue-rearrangement language ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        procedureDetails: 'Advancement flap created for closure of the defect. ' + LAYERED_CLOSURE_TEXT,
      })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
  });
});

describe('laceration forward: implicit layered closure (two suture layers without "layered")', () => {
  const IMPLICIT_LAYERED_TEXT = '3 deep dermal 4-0 Vicryl, skin closed with 5-0 nylon. Wound length 3.0 cm.';

  it('two distinct suture layers ⇒ intermediate, citing the deep-layer passage', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: IMPLICIT_LAYERED_TEXT }));
    expect(suggestionOf(result)?.code).toBe('12032');
    expect(suggestionOf(result)?.justification).toContain('layered closure documented');
  });

  it('a single-layer note does not infer layered: the depth [D] ask stays', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: 'Simple interrupted sutures placed.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /Repair depth is not documented/)).toBe(true);
  });

  it('the structured Repair depth field wins over the inference, with the reconcile finding', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Hand',
        lengthCm: 3.2,
        repairDepth: 'superficial-single',
        procedureDetails: IMPLICIT_LAYERED_TEXT,
      })
    );
    expect(suggestionOf(result)?.code).toBe('12002');
    expect(
      hasFinding(result.findings, 'contradiction', /Repair depth field documents a single-layer closure.*reconcile/)
    ).toBe(true);
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
    expect(suggestionOf(result)?.code).toBe('12002');
    expect(suggestionOf(result)?.justification).toContain('4.0 cm');
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
    expect(suggestionOf(result)?.code).toBe('12001');
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
    expect(suggestionOf(result)?.code).toBe('12002');
    expect(hasFinding(result.findings, 'contradiction', '3.2')).toBe(true);
    expect(hasFinding(result.findings, 'contradiction', '8.0')).toBe(true);
  });
});

describe('laceration forward: structured Repair depth field', () => {
  const NO_DEPTH_CLOSURE_TEXT = 'Closed with 5 simple interrupted 4-0 Ethilon sutures.';

  it.each<[RepairDepthSelection, string]>([
    ['superficial-single', '12002'],
    ['subcutaneous-single', '12002'],
    ['subcutaneous-layered', '12042'],
    ['fascia-muscle-layered', '12042'],
  ])('%s determines the class: hand + 3.2 cm → %s, with no depth ask', (repairDepth, expectedCode) => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.2, repairDepth, procedureDetails: NO_DEPTH_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe(expectedCode);
    expect(suggestionOf(result)?.justification).toContain('Repair depth field');
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('tissue-adhesive-only ⇒ simple repair suggested normally, with the G0168 payer footnote', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Face', lengthCm: 1.5, repairDepth: 'tissue-adhesive-only', procedureDetails: 'Wound closed.' })
    );
    expect(suggestionOf(result)?.code).toBe('12011');
    expect(suggestionOf(result)?.justification).toContain('Repair depth field');
    expect(result.payerNotes.some((n) => n.includes('G0168'))).toBe(true);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('strips-only ⇒ no repair code supported, no depth ask', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 1.5, repairDepth: 'strips-only', procedureDetails: 'Wound closed.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(
      hasFinding(result.findings, 'contradiction', /Repair depth field documents closure with adhesive strips only/)
    ).toBe(true);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('field says single-layer but the text documents a layered closure ⇒ reconcile [C], field wins', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Hand',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-single',
        procedureDetails: LAYERED_CLOSURE_TEXT,
      })
    );
    expect(suggestionOf(result)?.code).toBe('12002');
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Repair depth field documents a single-layer closure, but the Procedure details text documents a layered closure.*value from the field/
      )
    ).toBe(true);
  });

  it('field says layered but the text documents a single-layer closure ⇒ reconcile [C], field wins', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Hand',
        lengthCm: 3.2,
        repairDepth: 'fascia-muscle-layered',
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(suggestionOf(result)?.code).toBe('12042');
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Repair depth field documents a layered closure, but the Procedure details text documents a single-layer closure.*value from the field/
      )
    ).toBe(true);
  });

  it('field says tissue-adhesive-only but the text documents sutures ⇒ reconcile [C], field wins', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Hand',
        lengthCm: 1.5,
        repairDepth: 'tissue-adhesive-only',
        procedureDetails: NO_DEPTH_CLOSURE_TEXT,
      })
    );
    expect(suggestionOf(result)?.code).toBe('12001');
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Repair depth field documents a tissue-adhesive-only closure.*text documents sutures.*value from the field/
      )
    ).toBe(true);
  });

  it('field says strips-only but the text documents sutures ⇒ the same reconcile [C]', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 1.5, repairDepth: 'strips-only', procedureDetails: NO_DEPTH_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Repair depth field documents closure with adhesive strips only \(no sutures or staples\).*text documents sutures/
      )
    ).toBe(true);
  });

  it('field matching the text depth ⇒ no reconcile finding', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Hand',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-layered',
        procedureDetails: LAYERED_CLOSURE_TEXT,
      })
    );
    expect(suggestionOf(result)?.code).toBe('12042');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('laceration forward: missing determinants', () => {
  it('missing length ⇒ open candidate set for the known class+group, with a [D] finding', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: SIMPLE_CLOSURE_TEXT }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /length/i)).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual([
      '12001',
      '12002',
      '12004',
      '12005',
      '12006',
      '12007',
    ]);
  });

  it('missing length with class+group known ⇒ compact open-set summary for the single code table', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: SIMPLE_CLOSURE_TEXT }));
    expect(offeredSummary(result.outcome)).toBe('12001–12007 — wound length (cm) determines the exact code');
    const intermediate = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(offeredSummary(intermediate.outcome)).toBe('12041–12047 — wound length (cm) determines the exact code');
  });

  it('missing depth ⇒ [D] finding and candidates spanning both classes for the site', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.0, procedureDetails: 'Closed with 4-0 Ethilon, total stitch count: 5.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(true);
    const codes = offeredCandidates(result.outcome)?.map((c) => c.code) ?? [];
    expect(codes).toContain('12002');
    expect(codes).toContain('12042');
  });

  it('nothing documented ⇒ all determinants asked for, full open set, no compact summary', () => {
    const result = lacerationFamily.suggestCode(input({}));
    expect(suggestionOf(result)).toBeUndefined();
    expect(result.findings.filter((f) => f.level === 'determines')).toHaveLength(3);
    const codes = offeredCandidates(result.outcome)?.map((c) => c.code) ?? [];
    expect(codes).toEqual([...new Set(codes)]);
    for (const representative of ['12001', '12011', '12031', '12041', '12051']) {
      expect(codes).toContain(representative);
    }
    expect(codes.some((code) => code.startsWith('13'))).toBe(false);
    expect(offeredSummary(result.outcome)).toBe(
      '12001–12057 — the body site, the repair depth, and the total repaired length (cm) determine the exact code'
    );
  });
});

describe('laceration family metadata: the structured-input flags match the behaviour they advertise', () => {
  const NO_DEPTH_NO_LENGTH_TEXT = 'Closed with 5 simple interrupted 4-0 Ethilon sutures.';

  it('the structured length input determines the band', () => {
    expect(lacerationFamily.structuredFieldsFor({})).toContain(ProcedureStructuredField.Length);
    const withoutLength = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', repairDepth: 'superficial-single', procedureDetails: NO_DEPTH_NO_LENGTH_TEXT })
    );
    const withLength = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        repairDepth: 'superficial-single',
        procedureDetails: NO_DEPTH_NO_LENGTH_TEXT,
      })
    );
    expect(suggestionOf(withoutLength)).toBeUndefined();
    expect(suggestionOf(withLength)?.code).toBe('12002');
  });

  it('the structured Repair depth select determines the class', () => {
    expect(lacerationFamily.structuredFieldsFor({})).toContain(ProcedureStructuredField.RepairDepth);
    const withoutDepth = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: NO_DEPTH_NO_LENGTH_TEXT })
    );
    const withDepth = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        repairDepth: 'subcutaneous-layered',
        procedureDetails: NO_DEPTH_NO_LENGTH_TEXT,
      })
    );
    expect(suggestionOf(withoutDepth)).toBeUndefined();
    expect(suggestionOf(withDepth)?.code).toBe('12032');
  });
});

describe('laceration: missing-depth asks point first at the Repair depth field', () => {
  const NO_DEPTH_TEXT = 'Closed with 4-0 Ethilon, total stitch count: 5.';

  it('forward ask names the Repair depth field, with details text as the fallback', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.0, procedureDetails: NO_DEPTH_TEXT })
    );
    const ask = result.findings.find((f) => f.level === 'determines' && /depth/i.test(f.message));
    expect(ask?.message).toContain('Select it in the Repair depth field, or describe the closure in Procedure details');
  });

  it('inverse ask names the Repair depth field, with details text as the fallback', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 3.0,
        cptCodes: [{ code: '12041', display: 'Intermediate repair 2.5 cm or less' }],
        procedureDetails: NO_DEPTH_TEXT,
      })
    );
    const ask = result.findings.find((f) => f.level === 'determines' && /depth/i.test(f.message));
    expect(ask?.message).toContain('Select it in the Repair depth field, or describe the closure in Procedure details');
  });
});

describe('laceration inverse: structured Repair depth field', () => {
  const NO_DEPTH_CLOSURE_TEXT = 'Closed with 5 simple interrupted 4-0 Ethilon sutures.';

  it('field set ⇒ no depth ask; the field-determined class defends the matching code', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        lengthCm: 3.0,
        medicationUsed: '1% lidocaine',
        repairDepth: 'superficial-single',
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails: NO_DEPTH_CLOSURE_TEXT + ' Wound irrigated with normal saline. Tetanus status up to date.',
      })
    );
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
    expect(supportedCodes(result)).toEqual(['12002']);
  });

  it('field-determined class contradicts the selected code ⇒ [C] naming the field', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        repairDepth: 'subcutaneous-layered',
        cptCodes: [{ code: '12002', display: 'Simple repair 2.6-7.5 cm' }],
        procedureDetails: NO_DEPTH_CLOSURE_TEXT,
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /^12002 is a simple-repair code, but the Repair depth field documents a layered closure/,
        '12002'
      )
    ).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('tissue-adhesive-only selected ⇒ the matching simple code is supported, with the G0168 payer note', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        bodySide: 'Left',
        lengthCm: 2.0,
        medicationUsed: '1% lidocaine',
        repairDepth: 'tissue-adhesive-only',
        cptCodes: [{ code: '12001', display: 'Simple repair 2.5 cm or less' }],
        procedureDetails: 'Wound irrigated with normal saline and closed. Tetanus status up to date.',
      })
    );
    expect(supportedCodes(result)).toEqual(['12001']);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
    expect(result.payerNotes.some((n) => n.includes('G0168'))).toBe(true);
  });

  it('tissue-adhesive-only selected + an intermediate code ⇒ [C] naming the field', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 3.0,
        repairDepth: 'tissue-adhesive-only',
        cptCodes: [{ code: '12032', display: 'Intermediate repair 2.6-7.5 cm' }],
        procedureDetails: 'Wound closed.',
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /^12032 is an intermediate-repair code, but the Repair depth field documents closure with tissue adhesive alone/,
        '12032'
      )
    ).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('strips-only selected + a repair code ⇒ [C] per code naming the field, no supported codes', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 2.0,
        repairDepth: 'strips-only',
        cptCodes: [{ code: '12001', display: 'Simple repair 2.5 cm or less' }],
        procedureDetails: 'Wound closed.',
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /^12001 is selected, but the Repair depth field documents closure with adhesive strips only/,
        '12001'
      )
    ).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('field-vs-text class disagreement ⇒ the entry-level reconcile [C] clears supported codes', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 3.2,
        repairDepth: 'fascia-muscle-layered',
        cptCodes: [{ code: '12042', display: 'Intermediate repair 2.6-7.5 cm' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Repair depth field documents a layered closure, but the Procedure details text/
      )
    ).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(supportedCodes(result)).toHaveLength(0);
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
    expect(supportedCodes(result)).toHaveLength(0);
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

  it('extremity site mismatch reads "an extremity wound", never "a extremity"', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '12013', display: 'Simple repair face 2.6-5.0 cm' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'an extremity wound', '12013')).toBe(true);
    expect(result.findings.some((f) => f.message.includes('a extremity'))).toBe(false);
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
    expect(supportedCodes(result)).toHaveLength(0);
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
    const required = result.findings.find((f) => f.level === 'required' && findingCode(f) === '12002');
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

  it('unmodeled 13xxx code (13160, secondary closure) ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '13160', display: 'Secondary closure of surgical wound' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(notAssessedCodes(result)).toContain('13160');
    expect(result.findings.filter((f) => findingCode(f) === '13160')).toHaveLength(0);
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
    expect(supportedCodes(result)).toEqual(['12002']);
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
    expect(supportedCodes(result)).toEqual(['12032']);
  });
});

describe('laceration forward: complex repairs (CPT 13100-13153)', () => {
  describe('band and add-on boundaries (trunk: 13100/13101/+13102)', () => {
    it.each<[number, string, number | undefined]>([
      [1.1, '13100', undefined],
      [2.5, '13100', undefined],
      [2.6, '13101', undefined],
      [7.5, '13101', undefined],
      [7.6, '13101', 1],
      [12.5, '13101', 1],
      [12.6, '13101', 2],
    ])('%s cm → %s (add-on units: %s)', (lengthCm, expectedCode, addOnUnits) => {
      const result = lacerationFamily.suggestCode(
        input({ bodySite: 'Torso', lengthCm, procedureDetails: COMPLEX_CLOSURE_TEXT })
      );
      expect(suggestionOf(result)?.code).toBe(expectedCode);
      if (addOnUnits === undefined) {
        expect(suggestionOf(result)?.addOns).toBeUndefined();
      } else {
        expect(suggestionOf(result)?.addOns).toHaveLength(1);
        expect(suggestionOf(result)?.addOns?.[0]).toMatchObject({ code: '13102', units: addOnUnits });
      }
    });
  });

  it.each([
    ['Torso', '13100'],
    ['Head', '13120'],
    ['Arm', '13120'],
    ['Hand', '13131'],
    ['Foot', '13131'],
    ['Neck', '13131'],
    ['Forehead', '13131'],
    ['Nose', '13151'],
    ['Ear', '13151'],
  ])('complex site groups differ from simple and intermediate: %s at 2.0 cm → %s', (bodySite, expectedCode) => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite, lengthCm: 2.0, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe(expectedCode);
  });

  it.each([
    ['extensive undermining', 'Extensive undermining performed prior to closure.'],
    ['retention sutures', 'Retention sutures placed given wound tension.'],
    ['stents', 'Stent placed to support the closure.'],
    ['debridement', 'Wound edges debrided of devitalized tissue.'],
    ['exposed structure', 'Extensor tendon exposed at the wound base.'],
    ['free margin', 'Laceration crossing the vermilion border.'],
  ])('qualifying element (%s) supports a complex suggestion', (_label, elementText) => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 2.0, procedureDetails: elementText + ' ' + LAYERED_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('13131');
    expect(suggestionOf(result)?.justification).toContain('Complex repair');
  });

  it('layered closure alone stays intermediate — a complex code is never suggested without a qualifying element', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 2.0, procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('12041');
  });

  it('plain (non-extensive) undermining is not a qualifying element', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.0, procedureDetails: 'Wound edges undermined. ' + LAYERED_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('12042');
  });

  it('pinned compound suggestion: 16 cm forehead-group wound ⇒ 13132 + 13133 × 2, carried in the display', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Forehead', lengthCm: 16, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('13132');
    expect(suggestionOf(result)?.addOns).toHaveLength(1);
    expect(suggestionOf(result)?.addOns?.[0]).toMatchObject({ code: '13133', units: 2 });
    expect(suggestionOf(result)?.display).toContain('13133 × 2');
    expect(suggestionOf(result)?.justification).toContain('13132 + 13133 × 2');
  });

  it('sub-1.1 cm with a complex element falls back to the closure class, with an advisory', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Torso', lengthCm: 1.0, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)?.code).toBe('12031');
    expect(hasFinding(result.findings, 'bestPractice', 'complex repair codes start at 1.1 cm')).toBe(true);
  });

  it('complex class + site known, length missing ⇒ compact open-set summary over the complex table', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Hand', procedureDetails: COMPLEX_CLOSURE_TEXT }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(offeredSummary(result.outcome)).toBe('13131–13133 — wound length (cm) determines the exact code');
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['13131', '13132', '13133']);
  });
});

describe('laceration inverse: complex repairs (CPT 13100-13153)', () => {
  const COMPLEX_ELEMENT_DETAILS =
    'Extensive undermining performed. Closed with 5 simple interrupted 4-0 Ethilon sutures. Wound irrigated with normal saline. Tetanus status up to date.';

  it('live case: 13131 + hand + 2.0 cm + layered field + empty details ⇒ supports-intermediate [C] naming 12041', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        repairDepth: 'subcutaneous-layered',
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: '',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '13131');
    expect(contradiction?.message).toMatch(/^13131 is selected/);
    expect(contradiction?.message).toContain('Repair depth field documents a layered closure');
    expect(contradiction?.message).toContain('without any complex-repair element');
    expect(contradiction?.message).toContain('supports an intermediate repair (12041)');
    expect(contradiction?.message).toContain('add the qualifying element to Procedure details');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('13131 + extensive undermining documented ⇒ supported', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        bodySide: 'Left',
        lengthCm: 2.0,
        medicationUsed: '1% lidocaine',
        repairDepth: 'subcutaneous-layered',
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(supportedCodes(result)).toEqual(['13131']);
  });

  it('no qualifying element and no depth documented ⇒ [C] naming the missing element', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: 'Closed with 5 simple interrupted 4-0 Ethilon sutures.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'does not document any complex-repair element', '13131')).toBe(
      true
    );
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('single-layer Repair depth selection contradicts a complex code ⇒ [C] naming the field', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        repairDepth: 'subcutaneous-single',
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /^13131 is a complex-repair code, but the Repair depth field documents a single-layer closure/,
        '13131'
      )
    ).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('sub-1.1 cm + complex code ⇒ [C] below the complex minimum', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 0.8,
        repairDepth: 'subcutaneous-layered',
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported starting at 1.1 cm', '13131')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('documented length outside the selected complex band ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 5.0,
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '5.0', '13131')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('documented site group contradicts the selected complex code table ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        cptCodes: [{ code: '13100', display: 'Complex repair, trunk, 1.1-2.5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'hand', '13100')).toBe(true);
  });

  it('add-on from the wrong site-group family ⇒ [C]; the matching primary stays supported', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        bodySide: 'Left',
        lengthCm: 2.0,
        medicationUsed: '1% lidocaine',
        cptCodes: [
          { code: '13131', display: 'Complex repair 1.1-2.5 cm' },
          { code: '13102', display: 'Complex repair, trunk, each additional 5 cm' },
        ],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'same site group', '13102')).toBe(true);
    expect(supportedCodes(result)).toEqual(['13131']);
  });

  it('add-on without its base code ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Forehead',
        lengthCm: 16,
        cptCodes: [{ code: '13133', display: 'Complex repair, each additional 5 cm' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'but 13132 is not selected', '13133')).toBe(true);
  });

  it('add-on selected with a total length that never exceeds 7.5 cm ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Forehead',
        lengthCm: 5.0,
        cptCodes: [
          { code: '13132', display: 'Complex repair 2.6-7.5 cm' },
          { code: '13133', display: 'Complex repair, each additional 5 cm' },
        ],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'each additional 5 cm', '13133')).toBe(true);
  });

  it('intermediate code selected while the note documents a complex-repair element ⇒ [C]', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        cptCodes: [{ code: '12041', display: 'Intermediate repair 2.5 cm or less' }],
        procedureDetails: COMPLEX_CLOSURE_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'complex-repair qualifying element', '12041')).toBe(true);
  });

  it('tissue-rearrangement language keeps complex codes not assessed', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: 'Z-plasty performed for closure of the defect.',
      })
    );
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedCodes(result)).toContain('13131');
  });

  it('13150 was deleted from CPT in 2014, so a selected 13150 never claims the entry as a complex repair', () => {
    expect(lacerationFamily.detectBySelectedCode({ cptCodes: [{ code: '13150', display: 'Deleted' }] })).toBe(false);
    expect(lacerationFamily.detectBySelectedCode({ cptCodes: [{ code: '13151', display: 'Complex repair' }] })).toBe(
      true
    );
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Nose',
        lengthCm: 2.0,
        cptCodes: [{ code: '13150', display: 'Deleted complex repair code' }],
        procedureDetails: COMPLEX_ELEMENT_DETAILS,
      })
    );
    expect(notAssessedCodes(result)).toContain('13150');
    expect(result.findings.filter((f) => findingCode(f) === '13150')).toHaveLength(0);
  });
});

describe('laceration forward: the complex fallback re-groups the total', () => {
  const CHEEK_AND_NECK =
    'A 0.5 cm laceration of the cheek and a 0.4 cm laceration of the neck. Extensive undermining performed. ' +
    'Layered closure: deep dermal 4-0 Vicryl, skin closed with 5-0 nylon.';

  it('a sub-1.1 cm face+neck pair falls back to the face table on the face wound alone', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Face', procedureDetails: CHEEK_AND_NECK }));
    expect(suggestionOf(result)?.code).toBe('12051');
    expect(suggestionOf(result)?.justification).toContain('total 0.5 cm');
    expect(suggestionOf(result)?.justification).not.toContain('0.9 cm');
  });

  it('the neck wound gets its own other-group advisory once the class is intermediate', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Face', procedureDetails: CHEEK_AND_NECK }));
    expect(hasFinding(result.findings, 'bestPractice', /0\.4 cm wound on the neck.*own procedure entry/s)).toBe(true);
  });

  it('the same note produces the same other-group advisory in the inverse direction', () => {
    const forward = lacerationFamily.suggestCode(input({ bodySite: 'Face', procedureDetails: CHEEK_AND_NECK }));
    const inverse = lacerationFamily.defendCodes(
      input({
        bodySite: 'Face',
        cptCodes: [{ code: '12051', display: 'Intermediate repair face 2.5 cm or less' }],
        procedureDetails: CHEEK_AND_NECK,
      })
    );
    const advisories = (result: { findings: Finding[] }): string[] =>
      result.findings
        .filter((f) => f.level === 'bestPractice' && /own procedure entry/.test(f.message))
        .map((f) => f.message);
    expect(advisories(inverse)).toEqual(advisories(forward));
    expect(advisories(forward)).toHaveLength(1);
  });
});

describe('laceration: the structured length field is validated', () => {
  const CLOSURE = 'Single-layer closure with 5 simple interrupted 4-0 Ethilon sutures.';
  const implausible: Array<[string, number]> = [
    ['zero', 0],
    ['negative', -5],
    ['not a number', Number.NaN],
    ['absurdly large', 1_000_000],
  ];

  it.each(implausible)('%s ⇒ no suggestion, an honest ask, and no invented band', (_label, lengthCm) => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', lengthCm, procedureDetails: CLOSURE }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /Wound\/lesion size \(cm\) field/)).toBe(true);
    expect(offeredCandidates(result.outcome)?.length).toBeGreaterThan(0);
  });

  it.each(implausible)(
    '%s ⇒ forward and inverse agree (no contradiction from an unparsed value)',
    (_label, lengthCm) => {
      const forward = lacerationFamily.suggestCode(input({ bodySite: 'Arm', lengthCm, procedureDetails: CLOSURE }));
      const inverse = lacerationFamily.defendCodes(
        input({
          bodySite: 'Arm',
          lengthCm,
          cptCodes: [{ code: '12001', display: 'Simple repair 2.5 cm or less' }],
          procedureDetails: CLOSURE,
        })
      );
      expect(suggestionOf(forward)).toBeUndefined();
      expect(supportedCodes(inverse)).toHaveLength(0);
      expect(inverse.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
      expect(hasFinding(inverse.findings, 'determines', /length/i, '12001')).toBe(true);
    }
  );

  it('a negative length with a complex element still asks rather than falling back to a band', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: -3, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(result.findings.some((f) => f.message.includes('field holds -3'))).toBe(true);
    expect(result.findings.every((f) => !/total -3/.test(f.message))).toBe(true);
    expect(offeredSummary(result.outcome)).toBe('13120–13122 — wound length (cm) determines the exact code');
  });

  it('a plausible length is unaffected', () => {
    expect(
      suggestionOf(lacerationFamily.suggestCode(input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: CLOSURE })))
        ?.code
    ).toBe('12002');
  });
});

describe('laceration: the structured site is reconciled against the details text', () => {
  it('field says eyelid, text says trunk ⇒ reconcile [C] naming both, field wins', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Left upper eyelid',
        lengthCm: 3.0,
        procedureDetails: '3 cm lac of the trunk. Single-layer closure with 5 simple interrupted 4-0 Ethilon sutures.',
      })
    );
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        /Site\/location field documents an eyelid wound, but the Procedure details text documents a trunk wound.*value from the field/
      )
    ).toBe(true);
    expect(suggestionOf(result)?.code).toBe('12013');
  });

  it('the same disagreement clears supported codes in the inverse direction', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Left upper eyelid',
        bodySide: 'Left',
        lengthCm: 3.0,
        medicationUsed: '1% lidocaine',
        cptCodes: [{ code: '12013', display: 'Simple repair face 2.6-5.0 cm' }],
        procedureDetails:
          '3 cm lac of the trunk. Single-layer closure with 5 simple interrupted 4-0 Ethilon sutures. ' +
          'Wound irrigated with normal saline. Tetanus status up to date.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', /Site\/location field documents an eyelid wound/)).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('agreeing site values produce no finding', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        procedureDetails: 'Left forearm laceration. Single-layer closure with 5 interrupted 4-0 Ethilon sutures.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', /Site\/location field/)).toBe(false);
  });
});

describe('laceration: text-derived wound totals (A5/A6 reaching the code)', () => {
  it('three mentions of one 3 cm arm wound are billed as 3 cm, not 6 cm', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        procedureDetails:
          'A 3.0 cm laceration and 3.0 cm and 3.0 cm on the arm. ' +
          'Single-layer closure with 5 simple interrupted 4-0 nylon sutures.',
      })
    );
    expect(suggestionOf(result)?.justification).toContain('total 3.0 cm');
    expect(hasFinding(result.findings, 'bestPractice', /repeats the same wound length/)).toBe(true);
  });

  it('a nose wound and a chest wound in one line are not summed into a trunk total', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Torso',
        procedureDetails: 'Nose bridge lac 2cm; 3 cm chest lac also closed single-layer with 5 x 4-0 nylon.',
      })
    );
    expect(suggestionOf(result)?.justification).toContain('total 3.0 cm');
    expect(hasFinding(result.findings, 'bestPractice', /2\.0 cm wound on the nose/)).toBe(true);
  });
});

describe('laceration: payer notes and alternates', () => {
  it('a tissue-adhesive-only closure offers G0168 as a candidate, not only as a footnote', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Face',
        lengthCm: 1.5,
        procedureDetails: 'Wound edges approximated with Dermabond tissue adhesive. No sutures required.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('12011');
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['G0168']);
    expect(offeredSummary(result.outcome)).toContain('G0168');
    expect(result.payerNotes.some((n) => n.includes('G0168'))).toBe(true);
  });

  it('the contamination upgrade carries a payer note in both directions', () => {
    const details =
      'Heavily contaminated wound; extensively cleaned and irrigated with 500 mL saline. ' +
      'Single-layer closure with 4-0 Ethilon, total stitch count: 6.';
    const forward = lacerationFamily.suggestCode(
      input({ bodySite: 'Torso', lengthCm: 4.0, procedureDetails: details })
    );
    expect(suggestionOf(forward)?.code).toBe('12032');
    expect(forward.payerNotes.some((n) => /denial/i.test(n))).toBe(true);
    const inverse = lacerationFamily.defendCodes(
      input({
        bodySite: 'Torso',
        lengthCm: 4.0,
        cptCodes: [{ code: '12032', display: 'Intermediate repair 2.6-7.5 cm' }],
        procedureDetails: details,
      })
    );
    expect(inverse.payerNotes.some((n) => /denial/i.test(n))).toBe(true);
  });
});

describe('laceration: structured-vs-text length reconcile prints what it compared', () => {
  it('a sub-0.05 cm disagreement at display precision is not reported', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.2,
        procedureDetails: 'Wound length 3.16 cm. Single-layer closure with 5 interrupted 4-0 Ethilon sutures.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', /Wound\/lesion size \(cm\) field documents/)).toBe(false);
  });

  it('a real disagreement prints both values at the precision it compared', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.2,
        procedureDetails: 'Wound length 4.0 cm. Single-layer closure with 5 interrupted 4-0 Ethilon sutures.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', /documents 3\.2 cm.*documents 4\.0 cm/)).toBe(true);
  });
});
