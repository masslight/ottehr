import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput } from '../model.types';
import {
  citedText,
  evidenceSource,
  findingCode,
  hasFinding,
  notAssessedCodes,
  offeredCandidates,
  offeredSummary,
  suggestionOf,
  supportedCodes,
} from '../test-support';
import { foreignBodyFamily } from './foreign-body';
import { lacerationFamily } from './laceration';
import { splintingFamily } from './splinting';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'Splint Application / Immobilization', ...overrides };
}

const FULL_SPLINT_INPUT: Partial<ProcedureFactsInput> = {
  bodySide: 'Left',
  suppliesUsed: ['Fiberglass'],
  procedureDetails:
    'Short arm volar splint molded and applied by me. Static splint. ' +
    'Pre-application neurovascular exam: 2+ radial pulse, brisk cap refill, sensation intact. ' +
    'Post-application: pulses, motor, and sensation intact. Splint care and elevation reviewed.',
};

const STRAPPING_NOTES: Array<[label: string, procedureDetails: string, expected: string]> = [
  ['chest', 'Chest wall strapping applied for rib contusion.', '29200'],
  ['shoulder', 'Shoulder strapping applied.', '29240'],
  ['wrist', 'Wrist strapping applied with elastic tape', '29260'],
  ['elbow', 'Elbow strapping applied.', '29260'],
  ['hand', 'Hand strapping applied.', '29280'],
  ['finger', 'Buddy taping of the index finger applied.', '29280'],
  ['hip', 'Hip strapping applied.', '29520'],
  ['knee', 'Knee strapping applied.', '29530'],
  ['ankle/foot', 'Ankle strapping applied with elastic tape.', '29540'],
  ['toes', 'Buddy taping of the fractured toe applied', '29550'],
  ['Unna boot', 'Unna boot applied to the lower leg.', '29580'],
  ['multi-layer compression', 'Multi-layer compression system applied to the left lower leg.', '29581'],
];

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
    expect(suggestionOf(result)?.code).toBe(expected);
  });

  it.each(STRAPPING_NOTES)('strapping of the %s ⇒ %s', (_label, procedureDetails, expected) => {
    const result = splintingFamily.suggestCode(input({ procedureDetails }));
    expect(suggestionOf(result)?.code).toBe(expected);
  });

  it('a documented strapping region is mapped, never reported back as undocumented', () => {
    for (const [, procedureDetails] of STRAPPING_NOTES) {
      const result = splintingFamily.suggestCode(input({ procedureDetails }));
      expect(hasFinding(result.findings, 'determines', 'region is not documented')).toBe(false);
    }
  });

  it('a buddy-taped toe is 29550, not the ankle/foot code', () => {
    const toe = splintingFamily.suggestCode(input({ procedureDetails: 'Buddy taping of the fractured toe applied' }));
    expect(suggestionOf(toe)?.code).toBe('29550');

    const ankle = splintingFamily.suggestCode(
      input({ procedureDetails: 'Ankle strapping applied with elastic tape.' })
    );
    expect(suggestionOf(ankle)?.code).toBe('29540');
  });

  it('a thumb spica is short-arm territory (it crosses the wrist), not a finger splint', () => {
    const spica = splintingFamily.suggestCode(
      input({ procedureDetails: 'Static thumb spica splint applied to the thumb' })
    );
    expect(suggestionOf(spica)?.code).toBe('29125');

    const dynamicSpica = splintingFamily.suggestCode(
      input({ procedureDetails: 'Dynamic thumb-spica splint applied to the left thumb and wrist.' })
    );
    expect(suggestionOf(dynamicSpica)?.code).toBe('29126');
  });

  it('a bare thumb splint with no spica/wrist involvement stays a finger splint', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Static splint applied to the thumb.' }));
    expect(suggestionOf(result)?.code).toBe('29130');
  });

  it('the structured Body site resolves the region without site words in the text', () => {
    const result = splintingFamily.suggestCode(
      input({ bodySite: 'Wrist', procedureDetails: 'Static splint applied.' })
    );
    expect(suggestionOf(result)?.code).toBe('29125');
  });
});

describe('splinting forward: [D] asks name what is missing', () => {
  it('neither splint nor strapping documented ⇒ [D] appliance ask over the full family', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Immobilization performed.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'appliance is not documented')).toBe(true);
    for (const candidate of offeredCandidates(result.outcome) ?? []) {
      expect(candidate.code).toMatch(/^29\d{3}$/);
      expect(candidate.display).toMatch(new RegExp(`^${candidate.code} — \\S`));
    }
    // The full family = the splint codes + the strapping codes, with nothing stranded.
    const splintCodes = offeredCandidates(
      splintingFamily.suggestCode(input({ procedureDetails: 'Splint molded and applied by me.' })).outcome
    )?.map((c) => c.code);
    const strappingCodes = offeredCandidates(
      splintingFamily.suggestCode(input({ procedureDetails: 'Strapping applied and secured.' })).outcome
    )?.map((c) => c.code);
    expect([...(offeredCandidates(result.outcome) ?? []).map((c) => c.code)].sort()).toEqual(
      [...(splintCodes ?? []), ...(strappingCodes ?? [])].sort()
    );
  });

  it('the region table reaches every strapping code in the code table', () => {
    const strappingCodes = offeredCandidates(
      splintingFamily.suggestCode(input({ procedureDetails: 'Strapping applied and secured.' })).outcome
    )?.map((c) => c.code);
    const reached = new Set(
      STRAPPING_NOTES.map(
        ([, procedureDetails]) => suggestionOf(splintingFamily.suggestCode(input({ procedureDetails })))?.code
      )
    );
    expect([...reached].sort()).toEqual([...(strappingCodes ?? [])].sort());
  });

  it('splint documented but no region ⇒ [D] region ask over the splint codes', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Splint molded and applied by me.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'splinted region is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual([
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
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'static or dynamic')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['29125', '29126']);
  });

  it('finger splint without static/dynamic ⇒ [D] ask over 29130/29131', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Finger splint applied.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['29130', '29131']);
  });

  it('strapping documented but no region ⇒ [D] strapped-region ask over the strapping codes', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Strapping applied and secured.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'strapped region is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual([
      '29200',
      '29240',
      '29260',
      '29280',
      '29520',
      '29530',
      '29540',
      '29550',
      '29580',
      '29581',
    ]);
  });

  it('the strapped-region ask prints the regions the extractor actually maps', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Strapping applied and secured.' }));
    const ask = result.findings.find(
      (f) => f.level === 'determines' && f.message.includes('strapped region is not documented')
    );
    for (const region of [
      'chest',
      'shoulder',
      'elbow or wrist',
      'hand or finger',
      'hip',
      'knee',
      'toes',
      'ankle/foot',
    ]) {
      expect(ask?.message).toContain(region);
    }
  });

  it('an Unna boot confirms the lower-leg region instead of assuming it from the appliance word', () => {
    const result = splintingFamily.suggestCode(input({ procedureDetails: 'Unna boot applied.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'treated region is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['29580', '29581']);
  });

  it.each([
    ['appliance', 'Immobilization performed.', /^29105–29581 — \S/],
    ['splinted region', 'Splint molded and applied by me.', /^29105–29515 — \S/],
    ['static vs dynamic', 'Short arm splint applied to the wrist.', /^29125–29126 — \S/],
    ['strapped region', 'Strapping applied and secured.', /^29200–29581 — \S/],
    ['compression region', 'Unna boot applied.', /^29580–29581 — \S/],
  ])('the %s ask sets a one-line openCandidatesSummary alongside openCandidates', (_label, procedureDetails, shape) => {
    const result = splintingFamily.suggestCode(input({ procedureDetails }));
    expect(offeredCandidates(result.outcome)?.length).toBeGreaterThan(0);
    expect(offeredSummary(result.outcome)).toMatch(shape);
    expect(offeredSummary(result.outcome)).not.toContain('\n');
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
    const mismatch = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '29515');
    expect(mismatch?.message).toContain('short-leg territory');
    expect(mismatch?.message).toContain('short-arm territory');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('static code with dynamic documented ⇒ [C]', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29125', display: 'Short arm splint; static' }],
        procedureDetails: 'Dynamic short arm splint applied to the wrist.',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '29125');
    expect(contradiction?.message).toContain('29125 is the static splint code');
    expect(contradiction?.message).toContain('dynamic splint');
    expect(citedText(contradiction)).toContain('Dynamic');
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

  it('toe strapping (29550) vs a documented ankle ⇒ [C] naming both regions', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29550', display: 'Strapping; toes' }],
        procedureDetails: 'Ankle strapping applied with elastic tape.',
      })
    );
    const mismatch = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '29550');
    expect(mismatch?.message).toContain('the toes');
    expect(mismatch?.message).toContain('the ankle/foot');
  });

  it('a thumb spica documented against the finger splint code ⇒ [C]', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29130', display: 'Finger splint; static' }],
        procedureDetails: 'Static thumb spica splint applied to the thumb',
      })
    );
    const mismatch = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '29130');
    expect(mismatch?.message).toContain('short-arm territory');
  });

  it('29581 needs its multi-layer system named, not just a strapped region', () => {
    const result = splintingFamily.defendCodes(
      input({
        cptCodes: [{ code: '29581', display: 'Multi-layer compression system; leg below knee' }],
        procedureDetails: 'Ankle strapping applied with elastic tape.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 29540', '29581')).toBe(true);
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

  it('an uncued neurovascular exam is one "not tied to application" [R], not two missing exams', () => {
    const result = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        suppliesUsed: ['Fiberglass'],
        procedureDetails:
          'Static short arm splint molded and applied by me. Neurovascular exam intact distally; pulses 2+, sensation intact',
      })
    );
    expect(hasFinding(result.findings, 'required', 'pre-application neurovascular exam is not documented')).toBe(false);
    expect(hasFinding(result.findings, 'required', 'post-application neurovascular exam is not documented')).toBe(
      false
    );
    const untied = result.findings.filter(
      (f) => f.level === 'required' && f.message.includes('not tied to before or after application')
    );
    expect(untied).toHaveLength(1);
    expect(findingCode(untied[0])).toBe('29125');
    expect(citedText(untied[0])).toContain('Neurovascular');
    expect(evidenceSource(untied[0])).toBe('text');
    // The ask carries the cued phrasing to copy.
    expect(untied[0].message).toContain('pre-application');
    expect(untied[0].message).toContain('Procedure details');
  });

  it('a cued exam on one side plus an uncued one asks only for the missing label', () => {
    const result = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        suppliesUsed: ['Fiberglass'],
        procedureDetails:
          'Neurovascular exam intact distally. Splint molded and applied by me. Post-application: pulses, motor, and sensation intact.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'not tied to before application')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'pre-application neurovascular exam is not documented')).toBe(false);
    expect(hasFinding(result.findings, 'required', 'post-application neurovascular exam is not documented')).toBe(
      false
    );
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

  it('material is a [B] reminder for splint codes, does not block support, and is satisfied by Supplies used', () => {
    const missing = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        procedureDetails:
          'Static short arm splint molded and applied by me. Pre-application: pulses intact. Post-application: sensation intact.',
      })
    );
    expect(hasFinding(missing.findings, 'bestPractice', 'splint material is not documented', '29125')).toBe(true);
    expect(supportedCodes(missing)).toEqual(['29125']);

    const viaSupplies = splintingFamily.defendCodes(
      input({
        ...BASE,
        bodySide: 'Left',
        suppliesUsed: ['Fiberglass'],
        procedureDetails:
          'Static short arm splint molded and applied by me. Pre-application: pulses intact. Post-application: sensation intact.',
      })
    );
    expect(hasFinding(viaSupplies.findings, 'bestPractice', 'splint material is not documented')).toBe(false);
    expect(supportedCodes(viaSupplies)).toEqual(['29125']);
  });

  it('finger splints accept the aluminium/foam vocabulary — a casting material is not demanded', () => {
    const fingerBase = {
      bodySide: 'Left',
      cptCodes: [{ code: '29130', display: 'Finger splint; static' }],
    };
    const missing = splintingFamily.defendCodes(
      input({
        ...fingerBase,
        procedureDetails:
          'Static finger splint molded and applied by me. Pre-application: pulses intact. Post-application: sensation intact.',
      })
    );
    const material = missing.findings.find(
      (f) => f.level === 'bestPractice' && f.message.includes('splint material is not documented')
    );
    expect(findingCode(material)).toBe('29130');
    expect(material?.message).toContain('aluminium foam');
    expect(material?.message).not.toContain('fiberglass');

    const satisfied = splintingFamily.defendCodes(
      input({
        ...fingerBase,
        procedureDetails:
          'Static finger splint applied to the index finger; aluminum foam splint molded and applied by me. ' +
          'Pre-application: pulses intact. Post-application: sensation intact.',
      })
    );
    expect(hasFinding(satisfied.findings, 'bestPractice', 'splint material is not documented')).toBe(false);
    expect(supportedCodes(satisfied)).toEqual(['29130']);
  });

  it('the moulded regions still ask for a casting material', () => {
    const result = splintingFamily.defendCodes(
      input({ ...BASE, bodySide: 'Left', procedureDetails: 'Static short arm splint molded and applied by me.' })
    );
    const material = result.findings.find(
      (f) => f.level === 'bestPractice' && f.message.includes('splint material is not documented')
    );
    expect(material?.message).toContain('fiberglass');
  });

  it('material reminders do not apply to strapping codes', () => {
    const result = splintingFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '29530', display: 'Strapping; knee' }],
        procedureDetails: 'Knee strapping applied.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'splint material is not documented')).toBe(false);
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
    expect(supportedCodes(result)).toEqual(['29125']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('a fully documented wrist strapping supports 29260', () => {
    const result = splintingFamily.defendCodes(
      input({
        bodySide: 'Left',
        cptCodes: [{ code: '29260', display: 'Strapping; elbow or wrist' }],
        procedureDetails:
          'Wrist strapping applied with elastic tape by me. Pre-application: radial pulse 2+, sensation intact. ' +
          'Post-application: pulses, motor, and sensation intact. Strapping care and elevation reviewed.',
      })
    );
    expect(supportedCodes(result)).toEqual(['29260']);
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
    expect(supportedCodes(result)).toEqual(['29125']);
    expect(notAssessedCodes(result)).toEqual(['29075']);
  });
});
