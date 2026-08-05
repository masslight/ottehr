import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { foreignBodyFamily } from './foreign-body';
import { lacerationFamily } from './laceration';
import { splintingFamily } from './splinting';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Splint Application / Immobilization', ...overrides };
}

// Fully documented short-arm static splint: region + type + static, clinician application,
// pre- and post-application NV exams, laterality, material, and instructions.
const FULL_SPLINT_INPUT: Partial<ProcedureFactsInput> = {
  bodySide: 'Left',
  suppliesUsed: ['Fiberglass'],
  procedureDetails:
    'Short arm volar splint molded and applied by me. Static splint. ' +
    'Pre-application neurovascular exam: 2+ radial pulse, brisk cap refill, sensation intact. ' +
    'Post-application: pulses, motor, and sensation intact. Splint care and elevation reviewed.',
};

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

describe('splinting detection', () => {
  it('detects the product procedure type display and code slug', () => {
    expect(detectProcedureFamily({ procedureType: 'Splint Application / Immobilization' })?.id).toBe('splinting');
    expect(detectProcedureFamily({ procedureType: 'splint-application' })?.id).toBe('splinting');
  });

  it('detects from a selected splint or strapping code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '29125', display: 'Short arm splint; static' }] })?.id).toBe(
      'splinting'
    );
    expect(detectProcedureFamily({ cptCodes: [{ code: '29580', display: 'Unna boot' }] })?.id).toBe('splinting');
  });

  it.each([
    ['Laceration Repair (Suturing/Stapling)'],
    ['Foreign Body Removal (Skin, Ear, Nose, Eye)'],
    ['Reduction of Nursemaid’s Elbow'],
    ['Staple or Suture Removal'],
  ])('does not claim %s', (procedureType) => {
    expect(splintingFamily.detect({ procedureType })).toBe(false);
  });

  it('other families do not claim splinting entries ("splinter" stays foreign-body vocabulary)', () => {
    expect(lacerationFamily.detect({ procedureType: 'Splint Application / Immobilization' })).toBe(false);
    expect(foreignBodyFamily.detect({ procedureType: 'Splint Application / Immobilization' })).toBe(false);
    expect(splintingFamily.detect({ procedureType: 'Foreign Body Removal (Skin, Ear, Nose, Eye)' })).toBe(false);
  });
});

describe('splinting forward: region + type resolve the code', () => {
  it.each([
    ['long arm splint (explicit type)', 'Long arm posterior splint applied and molded by me.', '29105'],
    ['elbow involvement ⇒ long arm', 'Splint applied for supracondylar injury; elbow immobilized.', '29105'],
    ['sugar-tong is short-arm territory (static)', 'Static sugar-tong splint applied to the forearm.', '29125'],
    ['short arm dynamic', 'Dynamic short arm splint applied.', '29126'],
    ['finger static', 'Static finger splint applied to the index finger.', '29130'],
    ['finger dynamic', 'Dynamic finger splint applied.', '29131'],
    ['long leg', 'Long leg splint applied, knee immobilized.', '29505'],
    ['short leg (ankle)', 'Short leg posterior splint applied to the ankle.', '29515'],
  ])('%s ⇒ %s', (_label, procedureDetails, expected) => {
    const result = splintingFamily.suggestCode(input({ procedureDetails }));
    expect(result.suggestion?.code).toBe(expected);
  });

  it.each([
    ['chest', 'Chest wall strapping applied for rib contusion.', '29200'],
    ['shoulder', 'Shoulder strapping applied.', '29240'],
    ['hip', 'Hip strapping applied.', '29520'],
    ['knee', 'Knee strapping applied.', '29530'],
    ['ankle/foot', 'Ankle strapping applied with elastic tape.', '29540'],
  ])('strapping of the %s ⇒ %s', (_label, procedureDetails, expected) => {
    const result = splintingFamily.suggestCode(input({ procedureDetails }));
    expect(result.suggestion?.code).toBe(expected);
  });

  it('an Unna boot is its own strapping code ⇒ 29580', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Unna boot applied to the lower leg.' }));
    expect(result.suggestion?.code).toBe('29580');
  });

  it('the structured Body site resolves the region without site words in the text', () => {
    const result = splintingFamily.suggestCode(
      input({ bodySite: 'Wrist', procedureDetails: 'Static splint applied.' })
    );
    expect(result.suggestion?.code).toBe('29125');
  });
});

describe('splinting forward: [D] asks name what is missing', () => {
  it('neither splint nor strapping documented ⇒ [D] appliance ask over the full family', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Immobilization performed.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'appliance is not documented')).toBe(true);
    expect(result.openCandidates).toHaveLength(13);
  });

  it('splint documented but no region ⇒ [D] region ask over the splint codes', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Splint molded and applied by me.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'splinted region is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual([
      '29105',
      '29125',
      '29126',
      '29130',
      '29131',
      '29505',
      '29515',
    ]);
  });

  it('short arm splint without static/dynamic ⇒ [D] ask — static is never assumed', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Short arm splint applied to the wrist.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'static or dynamic')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['29125', '29126']);
  });

  it('finger splint without static/dynamic ⇒ [D] ask over 29130/29131', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Finger splint applied.' }));
    expect(result.suggestion).toBeUndefined();
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['29130', '29131']);
  });

  it('strapping documented but no region ⇒ [D] strapped-region ask over the strapping codes', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Strapping applied and secured.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'strapped region is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['29200', '29240', '29520', '29530', '29540', '29580']);
  });
});

describe('splinting inverse: pinned contradictions', () => {
  it('code region vs documented site mismatch ⇒ [C]', () => {
    const result = splintingFamily.defendCodes(
      input({
        bodySite: 'Wrist',
        cptCodes: [{ code: '29515', display: 'Short leg splint' }],
        procedureDetails: 'Static splint applied.',
      })
    );
    const mismatch = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '29515');
    expect(mismatch?.message).toContain('short-leg territory');
    expect(mismatch?.message).toContain('short-arm territory');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('static code with dynamic documented ⇒ [C]', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29125', display: 'Short arm splint; static' }],
        procedureDetails: 'Dynamic short arm splint applied to the wrist.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '29125');
    expect(contradiction?.message).toContain('29125 is the static splint code');
    expect(contradiction?.message).toContain('dynamic splint');
    expect(contradiction?.sourceText).toContain('Dynamic');
  });

  it('dynamic code with static documented ⇒ [C] (the reverse direction)', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29131', display: 'Finger splint; dynamic' }],
        procedureDetails: 'Static finger splint applied.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '29131 is the dynamic splint code', '29131')).toBe(true);
  });

  it('splint code with only strapping documented ⇒ [C]', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29125', display: 'Short arm splint; static' }],
        procedureDetails: 'Wrist taping applied.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'documents strapping/taping only', '29125')).toBe(true);
  });

  it('strapping code with only a splint documented ⇒ [C] (the reverse direction)', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29540', display: 'Strapping; ankle and/or foot' }],
        procedureDetails: 'Short leg splint applied to the ankle.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'documents a splint only', '29540')).toBe(true);
  });

  it('a non-Unna strapping code with an Unna boot documented ⇒ [C] pointing at 29580', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29540', display: 'Strapping; ankle and/or foot' }],
        procedureDetails: 'Unna boot applied to the lower leg.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 29580', '29540')).toBe(true);
  });

  it('static/dynamic undocumented on a split code ⇒ [D] ask, not a contradiction', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29125', display: 'Short arm splint; static' }],
        procedureDetails: 'Short arm splint applied to the wrist.',
      })
    );
    expect(hasFinding(result.findings, 'determines', 'static or dynamic', '29125')).toBe(true);
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
  });
});

describe('splinting inverse: [R] elements', () => {
  const BASE = {
    cptCodes: [{ code: '29125', display: 'Short arm splint; static' }],
  };

  it('application by the clinician missing ⇒ [R]; the Performed by / Documented by fields satisfy it', () => {
    const missing = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        procedureDetails:
          'Static short arm splint. Pre-application: pulses intact. After application: sensation intact.',
      })
    );
    expect(hasFinding(missing.findings, 'required', 'Application by the clinician is not documented', '29125')).toBe(
      true
    );

    const viaFields = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        documentedBy: 'Jane Smith, PA',
        procedureDetails:
          'Static short arm splint. Pre-application: pulses intact. After application: sensation intact.',
      })
    );
    expect(hasFinding(viaFields.findings, 'required', 'Application by the clinician is not documented')).toBe(false);
  });

  it('pre- and post-application neurovascular exams are separate [R] findings', () => {
    const result = splintingFamily.defendCodes(
      input({ ...BASE, bodySide: 'Left', procedureDetails: 'Static short arm splint molded and applied by me.' })
    );
    expect(hasFinding(result.findings, 'required', 'pre-application neurovascular exam', '29125')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'post-application neurovascular exam', '29125')).toBe(true);
  });

  it('only the post-application exam documented ⇒ the pre-application [R] still fires alone', () => {
    const result = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        procedureDetails:
          'Static short arm splint molded and applied by me. After application, pulses and sensation intact.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'pre-application neurovascular exam')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'post-application neurovascular exam')).toBe(false);
  });

  it('only the pre-application exam documented ⇒ the post-application [R] still fires alone', () => {
    const result = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        procedureDetails:
          'Static short arm splint molded and applied by me. Pre-application neurovascular exam: radial pulse 2+, sensation intact.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'pre-application neurovascular exam')).toBe(false);
    expect(hasFinding(result.findings, 'required', 'post-application neurovascular exam')).toBe(true);
  });

  it('laterality is [R] for every code except chest strapping (29200)', () => {
    const ankle = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29540', display: 'Strapping; ankle and/or foot' }],
        procedureDetails: 'Ankle strapping applied.',
      })
    );
    expect(hasFinding(ankle.findings, 'required', 'Laterality is not documented', '29540')).toBe(true);

    const chest = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29200', display: 'Strapping; thorax' }],
        procedureDetails: 'Chest strapping applied.',
      })
    );
    expect(hasFinding(chest.findings, 'required', 'Laterality is not documented')).toBe(false);
  });

  it('material (fiberglass/plaster) is [R] for splint codes and satisfied by Supplies used', () => {
    const missing = splintingFamily.defendCodes(
      input({ ...BASE, bodySide: 'Left', procedureDetails: 'Static short arm splint molded and applied by me.' })
    );
    expect(hasFinding(missing.findings, 'required', 'splint material is not documented', '29125')).toBe(true);

    const viaSupplies = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        suppliesUsed: ['Fiberglass'],
        procedureDetails: 'Static short arm splint molded and applied by me.',
      })
    );
    expect(hasFinding(viaSupplies.findings, 'required', 'splint material is not documented')).toBe(false);
  });

  it('material is not required for strapping codes', () => {
    const result = splintingFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '29530', display: 'Strapping; knee' }],
        procedureDetails: 'Knee strapping applied.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'splint material is not documented')).toBe(false);
  });

  it('patient instructions missing ⇒ entry-level [B]', () => {
    const result = splintingFamily.defendCodes(
      input({ ...BASE, procedureDetails: 'Static short arm splint applied.' })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'Patient instructions are not documented')).toBe(true);
  });
});

describe('splinting inverse: supported state and scope honesty', () => {
  it('fully documented entry supports 29125 with no [D]/[R]/[C] findings', () => {
    const result = splintingFamily.defendCodes(
      input({ ...FULL_SPLINT_INPUT, cptCodes: [{ code: '29125', display: 'Short arm splint; static' }] })
    );
    expect(result.supportedCodes).toEqual(['29125']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('cast application (29075) is outside scope ⇒ not assessed, never guessed', () => {
    const result = splintingFamily.defendCodes(
      input({
        ...FULL_SPLINT_INPUT,
        cptCodes: [
          { code: '29125', display: 'Short arm splint; static' },
          { code: '29075', display: 'Application of cast; elbow to finger' },
        ],
      })
    );
    expect(result.supportedCodes).toEqual(['29125']);
    expect(result.notAssessedCodes).toEqual(['29075']);
  });
});
