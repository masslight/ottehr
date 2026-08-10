import { describe, expect, it } from 'vitest';
import { Finding, ProcedureFactsInput, RepairDepthSelection } from '../model.types';
import { lacerationFamily } from './laceration';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Laceration Repair (Suturing/Stapling)', ...overrides };
}

const SIMPLE_CLOSURE_TEXT = 'Single-layer closure with 4-0 Ethilon, total stitch count: 5.';
const LAYERED_CLOSURE_TEXT =
  'Layered closure: deep dermal 4-0 Vicryl, skin closed with running 5-0 nylon, total stitch count: 8.';
const COMPLEX_CLOSURE_TEXT = 'Extensive undermining performed. ' + LAYERED_CLOSURE_TEXT;

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
    expect(result.suggestion?.justification).toContain('heavily contaminated');
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

  it('tissue-rearrangement language ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.suggestCode(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        procedureDetails: 'Advancement flap created for closure of the defect. ' + LAYERED_CLOSURE_TEXT,
      })
    );
    expect(result.suggestion).toBeUndefined();
    expect(result.notAssessed).toBe(true);
  });
});

describe('laceration forward: implicit layered closure (two suture layers without "layered")', () => {
  const IMPLICIT_LAYERED_TEXT = '3 deep dermal 4-0 Vicryl, skin closed with 5-0 nylon. Wound length 3.0 cm.';

  it('two distinct suture layers ⇒ intermediate, citing the deep-layer passage', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: IMPLICIT_LAYERED_TEXT }));
    expect(result.suggestion?.code).toBe('12032');
    expect(result.suggestion?.justification).toContain('layered closure documented');
  });

  it('a single-layer note does not infer layered: the depth [D] ask stays', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Arm', lengthCm: 3.0, procedureDetails: 'Simple interrupted sutures placed.' })
    );
    expect(result.suggestion).toBeUndefined();
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
    expect(result.suggestion?.code).toBe('12002'); // simple, per the field — not 12042
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

describe('laceration forward: structured Repair depth field', () => {
  // Closure elements documented without any depth/layer language, so the field is the only depth source.
  const NO_DEPTH_CLOSURE_TEXT = 'Closed with 5 simple interrupted 4-0 Ethilon sutures.';

  it.each<[RepairDepthSelection, string]>([
    ['superficial-single', '12002'], // simple: hand sits with trunk/extremities
    ['subcutaneous-single', '12002'],
    ['subcutaneous-layered', '12042'], // intermediate: hand moves to neck/hands/feet/genitalia
    ['fascia-muscle-layered', '12042'],
  ])('%s determines the class: hand + 3.2 cm → %s, with no depth ask', (repairDepth, expectedCode) => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.2, repairDepth, procedureDetails: NO_DEPTH_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe(expectedCode);
    expect(result.suggestion?.justification).toContain('Repair depth field');
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('tissue-adhesive-only ⇒ simple repair suggested normally, with the G0168 payer footnote', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Face', lengthCm: 1.5, repairDepth: 'tissue-adhesive-only', procedureDetails: 'Wound closed.' })
    );
    expect(result.suggestion?.code).toBe('12011'); // simple face table, ≤2.5 cm
    expect(result.suggestion?.justification).toContain('Repair depth field');
    expect(result.payerNotes?.some((n) => n.includes('G0168'))).toBe(true);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
  });

  it('strips-only ⇒ no repair code supported, no depth ask', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 1.5, repairDepth: 'strips-only', procedureDetails: 'Wound closed.' })
    );
    expect(result.suggestion).toBeUndefined();
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        'The Repair depth field documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code; that care is part of the visit (E/M) charge instead.'
      )
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
    expect(result.suggestion?.code).toBe('12002'); // simple per the field, not intermediate per the text
    const mismatch = result.findings.find((f) => f.level === 'contradiction');
    expect(mismatch?.message).toBe(
      'The Repair depth field documents a single-layer closure, but the Procedure details text documents a layered closure — please reconcile them; the checks use the value from the field.'
    );
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
    expect(result.suggestion?.code).toBe('12042'); // intermediate per the field, not simple per the text
    const mismatch = result.findings.find((f) => f.level === 'contradiction');
    expect(mismatch?.message).toBe(
      'The Repair depth field documents a layered closure, but the Procedure details text documents a single-layer closure — please reconcile them; the checks use the value from the field.'
    );
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
    expect(result.suggestion?.code).toBe('12001'); // simple per the field; the suggestion still proceeds
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        'The Repair depth field documents a tissue-adhesive-only closure (no sutures or staples), but the Procedure details text documents sutures — please reconcile them; the checks use the value from the field.'
      )
    ).toBe(true);
  });

  it('field says strips-only but the text documents sutures ⇒ the same reconcile [C]', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 1.5, repairDepth: 'strips-only', procedureDetails: NO_DEPTH_CLOSURE_TEXT })
    );
    expect(result.suggestion).toBeUndefined();
    expect(
      hasFinding(
        result.findings,
        'contradiction',
        'The Repair depth field documents closure with adhesive strips only (no sutures or staples), but the Procedure details text documents sutures — please reconcile them; the checks use the value from the field.'
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
    expect(result.suggestion?.code).toBe('12042');
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('laceration forward: missing determinants', () => {
  it('missing length ⇒ open candidate set for the known class+group, with a [D] finding', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: SIMPLE_CLOSURE_TEXT }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', /length/i)).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['12001', '12002', '12004', '12005', '12006', '12007']);
  });

  it('missing length with class+group known ⇒ compact open-set summary for the single code table', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Arm', procedureDetails: SIMPLE_CLOSURE_TEXT }));
    expect(result.openCandidatesSummary).toBe('12001–12007 — wound length (cm) determines the exact code');
    const intermediate = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(intermediate.openCandidatesSummary).toBe('12041–12047 — wound length (cm) determines the exact code');
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

  it('nothing documented ⇒ all determinants asked for, full open set, no compact summary', () => {
    const result = lacerationFamily.suggestCode(input({}));
    expect(result.suggestion).toBeUndefined();
    expect(result.findings.filter((f) => f.level === 'determines')).toHaveLength(3);
    expect(result.openCandidates).toHaveLength(31);
    expect(result.openCandidatesSummary).toBeUndefined();
  });
});

describe('laceration family metadata', () => {
  it('uses the structured length input (drives the conditional cm field)', () => {
    expect(lacerationFamily.usesStructuredLength).toBe(true);
  });

  it('uses the structured Repair depth select (drives the conditional depth field)', () => {
    expect(lacerationFamily.usesStructuredRepairDepth).toBe(true);
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
    expect(result.supportedCodes).toEqual(['12002']);
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
        '12002 is a simple-repair code, but the Repair depth field documents a layered closure (an intermediate repair).',
        '12002'
      )
    ).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['12001']);
    expect(hasFinding(result.findings, 'determines', /depth/i)).toBe(false);
    expect(result.payerNotes?.some((n) => n.includes('G0168'))).toBe(true);
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
        '12032 is an intermediate-repair code, but the Repair depth field documents closure with tissue adhesive alone (a simple repair).',
        '12032'
      )
    ).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
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
        '12001 is selected, but the Repair depth field documents closure with adhesive strips only — adhesive strips alone do not support a wound-repair code.',
        '12001'
      )
    ).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toHaveLength(0);
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

  it('unmodeled 13xxx code (13160, secondary closure) ⇒ not assessed, never guessed', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Arm',
        lengthCm: 3.0,
        cptCodes: [{ code: '13160', display: 'Secondary closure of surgical wound' }],
        procedureDetails: SIMPLE_CLOSURE_TEXT,
      })
    );
    expect(result.notAssessedCodes).toContain('13160');
    expect(result.findings.filter((f) => f.cptCode === '13160')).toHaveLength(0);
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
      expect(result.suggestion?.code).toBe(expectedCode);
      if (addOnUnits === undefined) {
        expect(result.suggestion?.addOns).toBeUndefined();
      } else {
        expect(result.suggestion?.addOns).toHaveLength(1);
        expect(result.suggestion?.addOns?.[0]).toMatchObject({ code: '13102', units: addOnUnits });
      }
    });
  });

  it.each([
    ['Torso', '13100'],
    ['Head', '13120'], // scalp
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
    expect(result.suggestion?.code).toBe(expectedCode);
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
    expect(result.suggestion?.code).toBe('13131');
    expect(result.suggestion?.justification).toContain('Complex repair');
  });

  it('layered closure alone stays intermediate — a complex code is never suggested without a qualifying element', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 2.0, procedureDetails: LAYERED_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe('12041');
  });

  it('plain (non-extensive) undermining is not a qualifying element', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Hand', lengthCm: 3.0, procedureDetails: 'Wound edges undermined. ' + LAYERED_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe('12042');
  });

  it('pinned compound suggestion: 16 cm forehead-group wound ⇒ 13132 + 13133 × 2, carried in the display', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Forehead', lengthCm: 16, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe('13132');
    expect(result.suggestion?.addOns).toHaveLength(1);
    expect(result.suggestion?.addOns?.[0]).toMatchObject({ code: '13133', units: 2 });
    expect(result.suggestion?.display).toContain('13133 × 2');
    expect(result.suggestion?.justification).toContain('13132 + 13133 × 2');
  });

  it('sub-1.1 cm with a complex element falls back to the closure class, with an advisory', () => {
    const result = lacerationFamily.suggestCode(
      input({ bodySite: 'Torso', lengthCm: 1.0, procedureDetails: COMPLEX_CLOSURE_TEXT })
    );
    expect(result.suggestion?.code).toBe('12031');
    expect(hasFinding(result.findings, 'bestPractice', 'complex repair codes start at 1.1 cm')).toBe(true);
  });

  it('complex class + site known, length missing ⇒ compact open-set summary over the complex table', () => {
    const result = lacerationFamily.suggestCode(input({ bodySite: 'Hand', procedureDetails: COMPLEX_CLOSURE_TEXT }));
    expect(result.suggestion).toBeUndefined();
    expect(result.openCandidatesSummary).toBe('13131–13133 — wound length (cm) determines the exact code');
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['13131', '13132', '13133']);
  });
});

describe('laceration inverse: complex repairs (CPT 13100-13153)', () => {
  const COMPLEX_ELEMENT_DETAILS =
    'Extensive undermining performed. Closed with 5 simple interrupted 4-0 Ethilon sutures. Wound irrigated with normal saline. Tetanus status up to date.';

  it('pinned live case: 13131 + hand + 2.0 cm + layered field + empty details ⇒ supports-intermediate [C] naming 12041', () => {
    const result = lacerationFamily.defendCodes(
      input({
        bodySite: 'Hand',
        lengthCm: 2.0,
        repairDepth: 'subcutaneous-layered',
        cptCodes: [{ code: '13131', display: 'Complex repair 1.1-2.5 cm' }],
        procedureDetails: '',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '13131');
    expect(contradiction?.message).toBe(
      '13131 is selected, but the Repair depth field documents a layered closure without any complex-repair element (extensive undermining, retention sutures, stents, debridement, exposed bone/cartilage/tendon, or free-margin involvement) — as documented this supports an intermediate repair (12041). If it was performed, add the qualifying element to Procedure details, e.g. "extensive undermining performed; retention sutures placed".'
    );
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['13131']);
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
    expect(result.supportedCodes).toHaveLength(0);
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
        '13131 is a complex-repair code, but the Repair depth field documents a single-layer closure (a simple repair).',
        '13131'
      )
    ).toBe(true);
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toHaveLength(0);
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
    expect(result.supportedCodes).toEqual(['13131']);
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
    expect(result.notAssessed).toBe(true);
    expect(result.notAssessedCodes).toContain('13131');
  });
});
