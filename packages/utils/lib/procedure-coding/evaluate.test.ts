import { describe, expect, expectTypeOf, it } from 'vitest';
import { aiDefense, billingCodePrompt, parseAiSuggestions } from './ai';
import { suggestedCodes } from './cpt';
import { defendCodes, detectProcedureFamily, PROCEDURE_FAMILIES, suggestCode } from './evaluate';
import { infusionMinutes } from './families/injection-infusion';
import { resolveFamilyFacts } from './family-support';
import { CodeAssessmentKind, LegacyProcedureFields, ProcedureFactsInput, ProcedureFamilyModel } from './model.types';
import { CodingField, parseStructuredFacts, StructuredFacts } from './structured-fields';

const input = (id: string, structuredFacts: StructuredFacts): ProcedureFactsInput => ({
  procedureType: PROCEDURE_FAMILIES.find((f) => f.id === id)!.procedureNames[0],
  structuredFacts,
  context: { completeDay: true, otherProcedures: [] },
});
const codes = (id: string, facts: StructuredFacts): string[] =>
  suggestedCodes(suggestCode(input(id, facts))).map((l) => l.code);
const wound = { site: 'trunk', length: 2, closure: 'single layer' };
const infusion = { route: 'IV infusion', drug: 'medication A', site: 'left arm', start: '10:00', stop: '11:31' };

describe('routing and evidence', () => {
  it('keeps routing, legacy readers and field defaults typed independently', () => {
    expectTypeOf(detectProcedureFamily).parameter(0).toEqualTypeOf<Pick<ProcedureFactsInput, 'procedureType'>>();
    expectTypeOf<NonNullable<ProcedureFamilyModel['readLegacyFacts']>>()
      .parameter(0)
      .toEqualTypeOf<LegacyProcedureFields>();
    expectTypeOf<CodingField>().extract<{ kind: 'checkbox' }>().toMatchTypeOf<{ defaultValue?: boolean }>();
    expectTypeOf<CodingField>().extract<{ kind: 'number' }>().toMatchTypeOf<{ defaultValue?: number }>();
    expectTypeOf<ProcedureFamilyModel<'16000'>['codes']>().toEqualTypeOf<readonly '16000'[]>();
  });
  it('routes every collected name uniquely and exactly', () => {
    const all = PROCEDURE_FAMILIES.flatMap((f) => f.procedureNames);
    expect(new Set(all).size).toBe(all.length);
    for (const family of PROCEDURE_FAMILIES)
      for (const name of family.procedureNames) {
        expect(detectProcedureFamily({ procedureType: name })?.id).toBe(family.id);
        expect(detectProcedureFamily({ procedureType: ` ${name}` })).toBeUndefined();
        expect(detectProcedureFamily({ procedureType: `${name} ` })).toBeUndefined();
      }
  });
  it('does not route by existing CPT or narrative', () => {
    const facts: ProcedureFactsInput = {
      procedureType: 'unknown',
      cptCodes: [{ code: '12001', display: 'Laceration' }],
      procedureDetails: 'repair',
    };
    expect(detectProcedureFamily(facts)).toBeUndefined();
    expect(detectProcedureFamily({ procedureType: 'Tick or Insect Removal' })).toBeUndefined();
    expect(detectProcedureFamily({ procedureType: 'elbow-reduction' })).toBeUndefined();
  });
  it('never extracts known-family facts from text', () => {
    const facts = input('laceration', { wounds: [wound] });
    expect(suggestCode({ ...facts, procedureDetails: 'complex repair, 50 cm' })).toEqual(suggestCode(facts));
    expect(
      suggestedCodes(suggestCode({ ...input('laceration', {}), procedureDetails: '2 cm simple trunk wound sutured' }))
    ).toEqual([]);
  });
  it('rejects invalid options and nonboolean checkbox values', () => {
    expect(codes('foreign-body', { site: 'invented', side: 'left' })).toEqual([]);
    expect(codes('incision-drainage', { collection: 'abscess', method: 'incision', packing: 'false' })).toEqual([]);
  });
  it('round-trips partial facts and refuses corrupt saved documentation', () => {
    expect(parseStructuredFacts(JSON.stringify({ wounds: [{ site: 'trunk' }], count: 0 }))).toEqual({
      wounds: [{ site: 'trunk' }],
      count: 0,
    });
    expect(parseStructuredFacts('{bad')).toBeUndefined();
    expect(parseStructuredFacts('{"count":null}')).toBeUndefined();
  });
  it('uses existing structured length/depth/site selections', () => {
    const facts = {
      ...input('laceration', {}),
      structuredFacts: undefined,
      bodySite: 'Torso',
      lengthCm: 2,
      repairDepth: 'subcutaneous-layered' as const,
    };
    expect(suggestedCodes(suggestCode(facts))[0].code).toBe('12031');
  });
});

describe('laceration grouping and exclusions', () => {
  it('sums wound groups and handles the complex minimum', () => {
    expect(codes('laceration', { wounds: [wound, { ...wound, length: 1 }] })).toEqual(['12002']);
    expect(
      codes('laceration', { wounds: [{ ...wound, length: 0.5, closure: 'layered', exposedStructure: true }] })
    ).toEqual(['12031']);
    expect(
      codes('laceration', { wounds: [{ ...wound, length: 1.1, closure: 'layered', exposedStructure: true }] })
    ).toEqual(['13100']);
  });
  it('excludes deliberate transfer and closure included in small benign excision', () => {
    expect(codes('laceration', { wounds: [{ ...wound, plannedTransfer: true }] })).toEqual([]);
    expect(codes('laceration', { wounds: [{ ...wound, closure: 'layered', smallBenignExcision: true }] })).toEqual([]);
  });
  it('handles midnight and leaves units uncomputed for invalid/partial times', () => {
    expect(infusionMinutes('23:30', '00:30')).toBe(60);
    for (const stop of ['10:00', '23:00', 'invalid'])
      expect(codes('injection-infusion', { administrations: [{ ...infusion, stop }] })).toEqual([]);
    expect(codes('injection-infusion', { administrations: [infusion, { drug: 'unfinished' }] })).toEqual([]);
  });
  it('sums interrupted segments without counting gaps', () => {
    const lines = suggestedCodes(
      suggestCode(
        input('injection-infusion', {
          administrations: [
            { ...infusion, event: 'A', stop: '10:45' },
            { ...infusion, event: 'A', start: '11:00', stop: '11:46' },
          ],
        })
      )
    );
    expect(lines.find((l) => l.code === '96366')?.units).toBe(1);
  });
});

describe('advisory checks and AI', () => {
  it('keeps quantities above limits and excludes the edited saved procedure', () => {
    const facts = {
      ...input('nail-trephination', { count: 3 }),
      procedureId: 'editing',
      context: {
        completeDay: true,
        otherProcedures: [{ procedureId: 'editing', codes: [{ code: '11740', display: '', billableUnits: 3 }] }],
      },
    };
    const suggestion = suggestCode(facts);
    expect(suggestedCodes(suggestion)[0].units).toBe(3);
    expect(suggestion.findings.some((f) => f.message.includes('quantity 3 exceeds'))).toBe(true);
    expect(suggestion.findings.some((f) => f.message.includes('quantity 6'))).toBe(false);
  });
  it('compares code/quantity/modifiers and preserves unknown day completeness', () => {
    const facts = {
      ...input('foreign-body', { site: 'cornea', side: 'left', slitLamp: true }),
      cptCodes: [{ code: '65222', display: '', modifier: [{ code: 'LT', display: '' }] }],
    };
    expect(defendCodes(facts).codeAssessments['65222'].kind).toBe(CodeAssessmentKind.Supported);
    expect(defendCodes({ ...facts, context: undefined }).codeAssessments['65222'].kind).toBe(
      CodeAssessmentKind.Supported
    );
    expect(
      defendCodes({ ...facts, cptCodes: [{ code: '65222', display: '', billableUnits: 2 }] }).codeAssessments['65222']
        .kind
    ).toBe(CodeAssessmentKind.Unsupported);
  });
  it('does not count mutually exclusive bilateral formats twice', () => {
    const facts = input('cerumen', {
      impaction: 'obstructed examination',
      leftMethod: 'instruments',
      rightMethod: 'instruments',
    });
    const suggestion = suggestCode(facts);
    expect(suggestedCodes(suggestion)).toHaveLength(2);
    expect(suggestion.findings.some((f) => f.message.includes('exceeds'))).toBe(false);
    const cptCodes = [{ code: '69210', display: '' }];
    expect(defendCodes({ ...facts, cptCodes }, suggestion).codeAssessments['69210'].kind).toBe(
      CodeAssessmentKind.Supported
    );
    expect(
      defendCodes(
        { ...facts, cptCodes: [...cptCodes, { code: '69210', display: '', modifier: [{ code: '50', display: '' }] }] },
        suggestion
      ).codeAssessments['69210'].kind
    ).toBe(CodeAssessmentKind.Unsupported);
  });
  it('checks an active CMS pair missing from the supplied cerumen spec', () => {
    const facts = {
      ...input('cerumen', { impaction: 'obstructed examination', leftMethod: 'instruments' }),
      cptCodes: [{ code: '69210', display: '', modifier: [{ code: 'LT', display: '' }] }],
      context: {
        completeDay: true,
        otherProcedures: [{ procedureId: 'office', codes: [{ code: '99213', display: '' }] }],
      },
    };
    expect(defendCodes(facts).findings.some((f) => f.billingDetail?.includes('69210 / 99213'))).toBe(true);
  });
  it('validates AI output and never treats it as documentation proof', () => {
    expect(parseAiSuggestions('[{"code":"12345","description":"Example","useWhen":"Review first"}]').source).toBe('ai');
    expect(() => parseAiSuggestions('[{"code":"invalid","description":"x","useWhen":"x"}]')).toThrow();
    expect(aiDefense({ cptCodes: [{ code: '12345', display: '' }] }).codeAssessments['12345'].kind).toBe(
      CodeAssessmentKind.NotAssessed
    );
    const prompt = billingCodePrompt({
      ...input('laceration', {}),
      procedureDetails: 'Clinical narrative',
      procedureId: 'DO-NOT-SEND-ID',
    });
    expect(prompt).toContain('Clinical narrative');
    expect(prompt).not.toContain('DO-NOT-SEND-ID');
  });
});

describe('documentation and related lines', () => {
  it('keeps clinical support separate from a daily billing warning', () => {
    const facts = {
      ...input('nail-trephination', { count: 3 }),
      cptCodes: [{ code: '11740', display: '', billableUnits: 3 }],
    };
    const suggestion = suggestCode(facts);
    expect(suggestion.findings.some((f) => f.message.includes('daily allowance'))).toBe(true);
    expect(defendCodes(facts, suggestion).codeAssessments['11740'].kind).toBe(CodeAssessmentKind.Supported);
  });
  it('flags an add-on selected without the documented base code', () => {
    const facts = {
      ...input('injection-infusion', { administrations: [infusion] }),
      cptCodes: [{ code: '96366', display: '' }],
    };
    expect(defendCodes(facts).codeAssessments['96366'].kind).toBe(CodeAssessmentKind.Unsupported);
  });
  it('requires a specific complex facial site instead of guessing the CPT site group', () => {
    expect(
      codes('laceration', { wounds: [{ site: 'face', length: 3, closure: 'layered', freeMargin: true }] })
    ).toEqual([]);
  });
  it('detects overlapping clock intervals on either side of midnight', () => {
    expect(
      codes('injection-infusion', {
        administrations: [
          { ...infusion, event: 'one', start: '23:30', stop: '01:00' },
          { ...infusion, event: 'one', start: '00:30', stop: '01:30' },
        ],
      })
    ).toEqual([]);
  });
});

it('keeps opposite-ear cerumen treatment separate from foreign-body access work', () => {
  const evaluation = suggestCode(
    input('cerumen', {
      impaction: 'hard symptomatic wax',
      leftMethod: 'instruments',
      rightMethod: 'instruments',
      leftForeignBodyAccess: true,
    })
  );
  expect(suggestedCodes(evaluation)).toMatchObject([{ code: '69210', modifiers: ['RT'] }]);
});

describe('source-aligned form coverage and documentation', () => {
  it('supports replacement splints and withholds application codes for postoperative dressings', () => {
    const facts = {
      device: 'splint',
      region: 'forearm',
      side: 'left',
      fabricated: true,
      care: 'replacement during/after follow-up',
    };
    expect(codes('splinting', facts)).toEqual(['29125']);
    expect(codes('splinting', { ...facts, care: 'dressing after a procedure' })).toEqual([]);
  });
  it('does not bill temporary nasal pledgets or a nebulizer without treatment', () => {
    expect(codes('nasal-packing', { leftEffort: 'temporary pledget only' })).toEqual([]);
    expect(codes('nebulizer', { context: 'no treatment' })).toEqual([]);
    expect(codes('nursemaid-elbow', { condition: 'other/unconfirmed' })).toEqual([]);
  });
  it('does not let hidden incision details determine the result after changing approach', () => {
    const family = PROCEDURE_FAMILIES.find((f) => f.id === 'incision-drainage')!;
    const facts = resolveFamilyFacts(
      family,
      input('incision-drainage', { collection: 'abscess', method: 'needle', packing: true })
    );
    expect(facts.packing).toBeUndefined();
    expect(codes('incision-drainage', { ...facts, method: 'incision' })).toEqual(['10060']);
  });
  it('does not use a hidden slit-lamp answer for an ear procedure', () => {
    const family = PROCEDURE_FAMILIES.find((f) => f.id === 'foreign-body')!;
    const facts = resolveFamilyFacts(family, input('foreign-body', { site: 'ear', slitLamp: true, side: 'left' }));
    expect(facts.slitLamp).toBeUndefined();
    expect(codes('foreign-body', { ...facts, site: 'cornea' })).toEqual(['65220']);
  });
  it('retains relevant catheter and infusion reminders and does not ask for an ECG report for tracing only', () => {
    const messages = (id: string, facts: StructuredFacts): string =>
      suggestCode(input(id, facts))
        .findings.map((f) => f.message)
        .join('\n');
    expect(messages('urinary-catheterization', { catheter: 'indwelling' })).toContain('French size');
    expect(messages('urinary-catheterization', { catheter: 'indwelling' })).toContain('removal/follow-up plan');
    expect(messages('injection-infusion', { administrations: [infusion] })).toContain('each additional hour');
    expect(messages('cerumen', { impaction: 'obstructed examination', leftMethod: 'instruments' })).toContain(
      'clinician skill'
    );
    expect(messages('ekg', { component: 'tracing only' })).not.toContain('ST-T');
    expect(messages('ekg', { component: 'tracing and report' })).toContain('ST-T');
  });
  it.each([
    ['injection-infusion', '96366', '96523', false],
    ['injection-infusion', '96365', '36410', true],
    ['splinting', '64450', '29515', false],
    ['splinting', '97760', '29125', true],
    ['splinting', '25600', '29125', true],
    ['foreign-body', '65222', '65435', true],
  ])('checks the source PTP pair %s %s/%s', (id, first, second, modifierAllowed) => {
    const result = defendCodes({
      ...input(id as string, {}),
      cptCodes: [
        { code: first as string, display: '' },
        { code: second as string, display: '' },
      ],
    });
    expect(
      result.findings.some(
        (finding) =>
          finding.billingDetail?.includes(`${first} / ${second}`) &&
          finding.billingDetail.includes(modifierAllowed ? 'appropriate modifier' : 'does not allow')
      )
    ).toBe(true);
  });
});

it('does not show trephination documentation requirements when nail removal routes the case out', () => {
  const result = suggestCode(input('nail-trephination', { nailRemoved: true }));
  expect(result.findings.some((finding) => finding.message.includes('retained nail plate'))).toBe(false);
});
