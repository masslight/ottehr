import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput } from '../model.types';
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
import {
  additionalHourUnits,
  extractInfusionDuration,
  extractInjectionInfusionFacts,
  INFUSION_HIERARCHY_PAYER_NOTE,
  INJECTION_J_CODE_PAYER_NOTE,
  injectionInfusionFamily,
} from './injection-infusion';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'IV Fluid Administration', ...overrides };
}

const HYDRATION_TEXT = 'NS 1000 mL IV hydration infusion via left antecubital IV.';
const DRUG_INFUSION_TEXT = 'Rocephin 1 g in 100 mL NS infused via left antecubital IV.';

describe('injection/infusion detection', () => {
  it.each([
    ['Intramuscular (IM) Medication Injection'],
    ['im-medication-injection'],
    ['IV Push Medication Administration'],
    ['iv-push-medication-administration'],
    ['IV Fluid Administration'],
    ['iv-fluid-administration'],
  ])('detects the product procedure type %s', (procedureType) => {
    expect(detectProcedureFamily({ procedureType })?.id).toBe('injection-infusion');
  });

  it('does not show infusion start/stop fields for the IV push procedure type', () => {
    expect(injectionInfusionFamily.structuredFieldsFor({ procedureType: 'IV Push Medication Administration' })).toEqual(
      []
    );
  });

  it.each([['96372'], ['96374'], ['96360'], ['96361'], ['96365'], ['96366']])(
    'detects from the selected administration code %s alone',
    (code) => {
      expect(detectProcedureFamily({ cptCodes: [{ code, display: 'administration' }] })?.id).toBe('injection-infusion');
    }
  );

  it.each([
    ['Oral Rehydration / Medication Administration (including challenge doses)', undefined],
    ['Intravenous (IV) Catheter Placement', 'iv-catheter-placement'],
    ['Nebulizer Treatment (e.g., Albuterol)', 'nebulizer'],
    ['Urinary Catheterization', 'urinary-catheterization'],
  ])('does not claim the adjacent in-house-med type %s', (procedureType, expectedFamily) => {
    expect(injectionInfusionFamily.detect({ procedureType })).toBe(false);
    expect(detectProcedureFamily({ procedureType })?.id).toBe(expectedFamily);
  });
});

describe('infusion duration extraction', () => {
  it('prefers the structured start/stop time inputs', () => {
    const duration = extractInfusionDuration(
      input({ infusionStartTime: '14:05', infusionStopTime: '14:47', procedureDetails: '13:00–13:10 unrelated' }),
      '13:00–13:10 unrelated'
    );
    expect(duration?.durationMinutes).toBe(42);
    expect(evidenceSource(duration)).toBe('field');
    expect(duration?.implausible).toBe(false);
  });

  it.each([
    ['template lines', 'Start Time: 14:05. Stop Time: 14:47.', 42],
    ['a time range', 'NS infusion 14:05–14:47, tolerated well.', 42],
    ['a time range with a shared meridiem', 'Infusion 2:05–2:47 pm.', 42],
    ['started/stopped prose with meridiems', 'Infusion started at 2:05 pm and stopped at 2:47 pm.', 42],
  ])('parses %s from the details text', (_label, text, expected) => {
    const duration = extractInfusionDuration(input({}), text);
    expect(duration?.durationMinutes).toBe(expected);
    expect(evidenceSource(duration)).toBe('text');
    expect(citedText(duration)).toBeDefined();
  });

  it('handles a cross-midnight infusion (stop earlier than start ⇒ +24 h)', () => {
    const duration = extractInfusionDuration(input({ infusionStartTime: '23:50', infusionStopTime: '00:35' }), '');
    expect(duration?.durationMinutes).toBe(45);
    expect(duration?.crossesMidnight).toBe(true);
    expect(duration?.implausible).toBe(false);
  });

  it('returns undefined when only one time is documented', () => {
    expect(extractInfusionDuration(input({ infusionStartTime: '14:05' }), 'Started at 14:05.')).toBeUndefined();
  });

  it.each([
    ['12 hours exactly stays plausible', '14:00', '02:00', 720, false],
    ['one minute past the ceiling does not', '14:00', '02:01', 721, true],
    ['a transposed entry reads as an implausible 1410 minutes', '14:30', '14:00', 1410, true],
  ])('%s', (_label, start, stop, expectedMinutes, implausible) => {
    const duration = extractInfusionDuration(input({ infusionStartTime: start, infusionStopTime: stop }), '');
    expect(duration?.durationMinutes).toBe(expectedMinutes);
    expect(duration?.implausible).toBe(implausible);
  });
});

describe('add-on unit math (each additional hour needs >30 minutes into it)', () => {
  it.each([
    [31, 0],
    [60, 0],
    [90, 0],
    [91, 1],
    [120, 1],
    [150, 1],
    [151, 2],
    [180, 2],
    [211, 3],
  ])('%i minutes ⇒ %i units', (minutes, units) => {
    expect(additionalHourUnits(minutes)).toBe(units);
  });
});

describe('injection/infusion freehand abbreviation lexicon', () => {
  it.each([
    ['SQ', 'Insulin 10 units SQ to the abdomen.'],
    ['sub-q', 'Epinephrine 0.3 mg given sub-q.'],
  ])('"%s" reads as the subcutaneous route ⇒ 96372', (_label, text) => {
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: text }));
    expect(facts.route?.value).toBe('im-subq');
    expect(suggestionOf(injectionInfusionFamily.suggestCode(input({ procedureDetails: text })))?.code).toBe('96372');
  });

  it('"NS" reads as the fluid type, and a "cc" figure as the volume (mL equivalent)', () => {
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: 'NS 1000 cc infused via left AC IV.' }));
    expect(facts.fluidDocumented?.value).toBe(true);
    expect(facts.volumeDocumented?.value).toBe(true);
    expect(facts.route?.value).toBe('infusion');
    expect(facts.infusionKind?.value).toBe('hydration');
  });

  it('a fluid plus a cc volume alone infer an infusion the same as an mL volume', () => {
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: 'D5W 500 cc given over an hour.' }));
    expect(facts.volumeDocumented?.value).toBe(true);
    expect(facts.route?.value).toBe('infusion');
  });

  it('an electrolyte additive rides along with the fluid — its mEq figure is not a drug dose', () => {
    const facts = extractInjectionInfusionFacts(
      input({ procedureDetails: 'D5½NS with 20 mEq KCl infused, 1000 mL total.' })
    );
    expect(facts.infusionKind?.value).toBe('hydration');
    expect(facts.infusionSubstanceConflict).toBe(false);
  });

  it('"w/o adverse reaction" reads as tolerance documented (w/o maps to without)', () => {
    const facts = extractInjectionInfusionFacts(
      input({ procedureDetails: 'Injection given, w/o adverse reaction noted.' })
    );
    expect(facts.toleranceDocumented?.value).toBe(true);
  });
});

describe('injection/infusion forward: the route is the determinant', () => {
  it('IM documented in the Medication used field ⇒ 96372 with the J-code footnote', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureType: 'Intramuscular (IM) Medication Injection', medicationUsed: 'Toradol 60 mg IM' })
    );
    expect(suggestionOf(result)?.code).toBe('96372');
    expect(result.payerNotes).toEqual([INJECTION_J_CODE_PAYER_NOTE]);
  });

  it('IM site language in the text ⇒ 96372', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Rocephin 500 mg administered to the left deltoid; tolerated well.' })
    );
    expect(suggestionOf(result)?.code).toBe('96372');
  });

  it('IV push documented ⇒ 96374', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Zofran 4 mg slow IV push over 2 minutes.' })
    );
    expect(suggestionOf(result)?.code).toBe('96374');
  });

  it('an NS flush after a push does not read as a hydration infusion', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Zofran 4 mg IV push, line flushed with 10 mL NS.' })
    );
    expect(suggestionOf(result)?.code).toBe('96374');
  });

  it('a flushed saline lock is line care, not an infusion ⇒ no route to code from', () => {
    const details = 'Saline lock placed and flushed with 10 mL NS.';
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: details }));
    expect(facts.infusionDocumented).toBeUndefined();
    expect(facts.route).toBeUndefined();

    const result = injectionInfusionFamily.suggestCode(input({ procedureDetails: details }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'administration route is not documented')).toBe(true);
  });

  it('no route documented ⇒ [D] ask over 96372/96374/96360/96365', () => {
    const result = injectionInfusionFamily.suggestCode(input({ procedureDetails: 'Medication administered.' }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'administration route is not documented')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['96372', '96374', '96360', '96365']);
    expect(offeredSummary(result.outcome)).toContain('96360');
  });
});

describe('injection/infusion forward: the infusate picks the infusion family', () => {
  it('prepackaged fluid alone reads as hydration ⇒ 96360, never 96365', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: HYDRATION_TEXT, infusionStartTime: '14:00', infusionStopTime: '15:00' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.display).toContain('hydration');
  });

  it('a drug hanging in a saline bag reads as a drug infusion ⇒ 96365, with the hierarchy footnote', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: DRUG_INFUSION_TEXT, infusionStartTime: '14:00', infusionStopTime: '14:45' })
    );
    expect(suggestionOf(result)?.code).toBe('96365');
    expect(suggestionOf(result)?.justification).toContain('total 45 minutes');
    expect(result.payerNotes).toEqual([INFUSION_HIERARCHY_PAYER_NOTE]);
  });

  it('a drug given by its own route leaves the bag as hydration ⇒ 96360', () => {
    const facts = extractInjectionInfusionFacts(
      input({ procedureDetails: 'Rocephin 1 g IM to the right deltoid, then NS 1000 mL infusion.' })
    );
    expect(facts.infusionKind?.value).toBe('hydration');
    expect(facts.infusionSubstanceConflict).toBe(false);
  });

  it('a drug and a fluid with no route between them ⇒ [D] ask, never a guess', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Zofran 4 mg given. NS 1000 mL infused over an hour.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'infusate is ambiguous')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['96360', '96361', '96365', '96366']);
    expect(offeredSummary(result.outcome)).toContain('96365');
  });

  it('an unnamed substance mixed into the bag ⇒ [D] ask (the family cannot be read off it)', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Vancomycin 1 g in 250 mL NS infused over 60 minutes.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'infusate')).toBe(true);
  });

  it('an infusion with no substance documented at all ⇒ [D] ask naming both families', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Infusion started via left AC IV. Start Time: 14:00. Stop Time: 15:00.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('infused substance is not documented');
    expect(ask?.message).toContain('96360');
    expect(ask?.message).toContain('96365');
    expect(ask?.message).toContain('Medication used');
  });
});

describe('injection/infusion forward: hydration duration math (96360/96361)', () => {
  function hydrationInput(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
    return input({ procedureDetails: HYDRATION_TEXT, ...overrides });
  }

  it('no start/stop times ⇒ [D] ask that names the Time spent limitation', () => {
    const result = injectionInfusionFamily.suggestCode(hydrationInput({}));
    expect(suggestionOf(result)).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('Start and stop times are not documented');
    expect(ask?.message).toContain('Time spent dropdown records a total only');
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['96360', '96361']);
    expect(offeredSummary(result.outcome)).toContain('96360–96361');
  });

  it('30 minutes documented ⇒ [C] with the computed minutes, no suggestion (the 31-minute boundary)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: '14:35' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const contradiction = result.findings.find((f) => f.level === 'contradiction');
    expect(contradiction?.message).toContain('total 30 minutes');
    expect(contradiction?.message).toContain('96360 requires at least 31 minutes');
  });

  it('31 minutes documented ⇒ 96360 (the other side of the boundary)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: '14:36' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.addOns).toBeUndefined();
    expect(suggestionOf(result)?.justification).toContain('total 31 minutes');
  });

  it('90 minutes ⇒ 96360 alone (only 30 minutes into the additional hour)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:00', infusionStopTime: '15:30' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.addOns).toBeUndefined();
  });

  it('91 minutes ⇒ 96360 + 96361 × 1, with the math stated', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:00', infusionStopTime: '15:31' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.addOns).toEqual([expect.objectContaining({ code: '96361', units: 1 })]);
    expect(suggestionOf(result)?.justification).toContain('total 91 minutes');
    expect(suggestionOf(result)?.justification).toContain('31 minutes beyond the first hour');
    expect(suggestionOf(result)?.justification).toContain('more than 30 minutes');
  });

  it.each([
    ['150 minutes', '16:35', 1],
    ['151 minutes', '16:36', 2],
  ])('%s ⇒ 96361 × %i', (_label, stopTime, units) => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: stopTime })
    );
    expect(suggestionOf(result)?.addOns).toEqual([expect.objectContaining({ code: '96361', units })]);
  });

  it('a cross-midnight infusion computes through 00:00 and says so', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '23:50', infusionStopTime: '00:35' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.justification).toContain('crossing midnight');
    expect(suggestionOf(result)?.justification).toContain('total 45 minutes');
  });

  it('text-derived times drive the same math as the structured inputs', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: `${HYDRATION_TEXT} Start Time: 14:05. Stop Time: 16:36.` })
    );
    expect(suggestionOf(result)?.addOns).toEqual([expect.objectContaining({ code: '96361', units: 2 })]);
  });
});

describe('injection/infusion forward: drug-infusion duration math (96365/96366)', () => {
  function drugInfusionInput(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
    return input({ procedureDetails: DRUG_INFUSION_TEXT, ...overrides });
  }

  it('15 minutes ⇒ [C] pointing at 96374 (an IV drug administration that short is a push)', () => {
    const result = injectionInfusionFamily.suggestCode(
      drugInfusionInput({ infusionStartTime: '14:00', infusionStopTime: '14:15' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const contradiction = result.findings.find((f) => f.level === 'contradiction');
    expect(contradiction?.message).toContain('total 15 minutes');
    expect(contradiction?.message).toContain('96374');
  });

  it('16 minutes ⇒ 96365 (the other side of the push boundary — no 31-minute floor applies)', () => {
    const result = injectionInfusionFamily.suggestCode(
      drugInfusionInput({ infusionStartTime: '14:00', infusionStopTime: '14:16' })
    );
    expect(suggestionOf(result)?.code).toBe('96365');
    expect(suggestionOf(result)?.addOns).toBeUndefined();
    expect(suggestionOf(result)?.justification).toContain('total 16 minutes');
  });

  it.each([
    ['90 minutes', '15:30', undefined],
    ['91 minutes', '15:31', 1],
    ['151 minutes', '16:31', 2],
  ])('%s ⇒ 96365 with the documented 96366 units', (_label, stopTime, units) => {
    const result = injectionInfusionFamily.suggestCode(
      drugInfusionInput({ infusionStartTime: '14:00', infusionStopTime: stopTime })
    );
    expect(suggestionOf(result)?.code).toBe('96365');
    expect(suggestionOf(result)?.addOns).toEqual(
      units === undefined ? undefined : [expect.objectContaining({ code: '96366', units })]
    );
  });
});

describe('injection/infusion forward: the duration plausibility ceiling', () => {
  it('a transposed start/stop entry ⇒ [C] naming the span, never 96361 units', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: HYDRATION_TEXT, infusionStartTime: '14:30', infusionStopTime: '14:00' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const contradiction = result.findings.find((f) => f.level === 'contradiction');
    expect(contradiction?.message).toContain('total 1410 minutes');
    expect(contradiction?.message).toContain('12 hours');
    expect(contradiction?.message).toContain('past midnight');
    expect(contradiction?.message).toContain('Start Time');
    // Falls back to the "times not usable" branch rather than billing from the typo.
    expect(hasFinding(result.findings, 'determines', 'cannot be used as recorded')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['96360', '96361']);
    expect(offeredSummary(result.outcome)).toBeDefined();
  });

  it('12 hours exactly still bills its add-on units (the ceiling is not a code rule)', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: HYDRATION_TEXT, infusionStartTime: '14:00', infusionStopTime: '02:00' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    expect(suggestionOf(result)?.addOns).toEqual([expect.objectContaining({ code: '96361', units: 11 })]);
  });

  it('a selected 96360 with an implausible span ⇒ [C] and no support', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96360', display: 'IV hydration initial' }],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:30',
        infusionStopTime: '14:00',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'total 1410 minutes', '96360')).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });
});

describe('injection/infusion: the IV push window', () => {
  const PUSH_TEXT = 'Zofran 4 mg IV push via left antecubital IV.';

  it('a selected 96374 with documented times far past the push window ⇒ [C] naming the infusion code', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96374', display: 'IV push' }],
        procedureDetails: PUSH_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '17:00',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '96374');
    expect(contradiction?.message).toContain('total 180 minutes');
    expect(contradiction?.message).toContain('15 minutes or less');
    expect(contradiction?.message).toContain('96365');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('a selected 96374 within the push window stays supported', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96374', display: 'IV push' }],
        procedureDetails: PUSH_TEXT,
        patientResponse: 'Tolerated well',
        infusionStartTime: '14:00',
        infusionStopTime: '14:03',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['96374']);
  });

  it('forward: push language with infusion-length times ⇒ [D] reconcile, no suggestion', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: PUSH_TEXT, infusionStartTime: '14:00', infusionStopTime: '17:00' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'is an infusion, not a push')).toBe(true);
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['96374', '96360', '96365']);
    expect(offeredSummary(result.outcome)).toContain('96374');
  });
});

describe('injection/infusion: more than one documented route', () => {
  const MULTI_ROUTE_TEXT = 'Rocephin 1 g IM to the right deltoid, then NS 1000 mL infusion.';

  it('forward suggests the hierarchy primary and surfaces the other administration', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: MULTI_ROUTE_TEXT, infusionStartTime: '14:00', infusionStopTime: '15:00' })
    );
    expect(suggestionOf(result)?.code).toBe('96360');
    const advisory = result.findings.find((f) => f.level === 'bestPractice');
    expect(advisory?.message).toContain('IM/SubQ injection');
    expect(advisory?.message).toContain('96372');
    expect(advisory?.message).toContain('needs its own procedure entry');
  });

  it('inverse judges a selected code for any documented route, not only the primary', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96372', display: 'IM injection' }],
        procedureDetails: MULTI_ROUTE_TEXT,
        patientResponse: 'Tolerated well',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(result)).toEqual(['96372']);
    expect(hasFinding(result.findings, 'bestPractice', 'also documents an IV infusion')).toBe(true);
  });

  it('inverse says nothing extra when a selected code already covers each documented route', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '96372', display: 'IM injection' },
          { code: '96360', display: 'IV hydration initial' },
        ],
        procedureDetails: MULTI_ROUTE_TEXT,
        patientResponse: 'Tolerated well',
        infusionStartTime: '14:00',
        infusionStopTime: '15:00',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', 'also documents')).toBe(false);
    expect(supportedCodes(result)).toEqual(['96372', '96360']);
  });
});

describe('injection/infusion: immunizations are a different code family', () => {
  it('a vaccine in the Medication used field is not assessed, and never becomes 96372', () => {
    const vaccineInput = input({
      procedureType: 'Intramuscular (IM) Medication Injection',
      medicationUsed: 'Tdap vaccine 0.5 mL',
      bodySite: 'Deltoid',
    });
    const suggestion = injectionInfusionFamily.suggestCode(vaccineInput);
    expect(suggestionOf(suggestion)).toBeUndefined();
    expect(isNotAssessed(suggestion)).toBe(true);
    expect(notAssessedReason(suggestion)).toContain('90471/90472');

    const defense = injectionInfusionFamily.defendCodes({
      ...vaccineInput,
      cptCodes: [{ code: '96372', display: 'IM injection' }],
    });
    expect(isNotAssessed(defense)).toBe(true);
    expect(notAssessedCodes(defense)).toEqual(['96372']);
    expect(supportedCodes(defense)).toHaveLength(0);
  });

  it('a vaccine noted alongside a therapeutic injection is advised separately, not blocking', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({
        procedureType: 'Intramuscular (IM) Medication Injection',
        medicationUsed: 'Toradol 60 mg IM',
        procedureDetails: 'Left deltoid. Tdap also given today.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('96372');
    expect(hasFinding(result.findings, 'bestPractice', 'also documents an immunization')).toBe(true);
  });
});

describe('injection/infusion inverse: pinned contradictions', () => {
  const HYDRATION_CODES = [{ code: '96360', display: 'IV hydration initial' }];

  it('96360 selected with 30 minutes documented ⇒ [C] stating the math (31 ⇒ no [C])', () => {
    const short = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:05',
        infusionStopTime: '14:35',
      })
    );
    const contradiction = short.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '96360');
    expect(contradiction?.message).toContain('total 30 minutes');
    expect(contradiction?.message).toContain('96360 requires at least 31 minutes');
    expect(supportedCodes(short)).toHaveLength(0);

    const exact = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:05',
        infusionStopTime: '14:36',
      })
    );
    expect(exact.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(supportedCodes(exact)).toEqual(['96360']);
  });

  it('96360 selected with no start/stop times ⇒ [R] naming the Time spent limitation', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({ cptCodes: HYDRATION_CODES, procedureDetails: HYDRATION_TEXT, timeSpent: '30-45 minutes' })
    );
    const ask = result.findings.find((f) => f.level === 'required' && /start and stop times/i.test(f.message));
    expect(ask?.message).toContain('Time spent dropdown records a total only');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('96365 selected while the note documents plain hydration fluid ⇒ [C] pointing at 96360', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96365', display: 'IV infusion, therapy' }],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '15:00',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '96365');
    expect(contradiction?.message).toContain('hydration');
    expect(contradiction?.message).toContain('96360');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('96360 selected while the note documents a drug infusion ⇒ [C] pointing at 96365', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: DRUG_INFUSION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '15:00',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '96360');
    expect(contradiction?.message).toContain('96365');
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('an ambiguous infusate is asked about, not contradicted', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: 'Zofran 4 mg given. NS 1000 mL infused. Start Time: 14:00. Stop Time: 15:00.',
      })
    );
    expect(result.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(hasFinding(result.findings, 'determines', 'infusate is ambiguous', '96360')).toBe(true);
  });

  it.each([
    ['96361', '96360', 'hydration'],
    ['96366', '96365', 'drug infusion'],
  ])('%s selected without %s ⇒ [C] add-on pairing', (addOn, base) => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: addOn, display: 'each additional hour' }],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '16:00',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', `${base} is not selected`, addOn)).toBe(true);
  });

  it('96361 selected with a duration supporting zero units ⇒ [C] stating the add-on math', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '96360', display: 'IV hydration initial' },
          { code: '96361', display: 'IV hydration additional hour' },
        ],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '15:20',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && findingCode(f) === '96361');
    expect(contradiction?.message).toContain('20 minutes beyond the first hour');
    expect(contradiction?.message).toContain('support no 96361 units');
    expect(supportedCodes(result)).toEqual(['96360']);
  });

  it('96372 selected while the note documents IV administration ⇒ [C]', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96372', display: 'IM injection' }],
        procedureDetails: 'Zofran 4 mg IV push via left antecubital line.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'an IV push', '96372')).toBe(true);
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96374', '96372')).toBe(true);
  });

  it('96374 selected while the note documents an IM injection ⇒ [C] (the reverse direction)', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96374', display: 'IV push' }],
        procedureDetails: 'Rocephin 500 mg IM to the left deltoid.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96372', '96374')).toBe(true);
  });

  it('96374 selected while the note documents a hydration infusion ⇒ [C] pointing at 96360', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96374', display: 'IV push' }],
        procedureDetails: 'NS 1000 mL infusion over one hour.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96360', '96374')).toBe(true);
  });

  it('96360 selected while the note documents only an IV push ⇒ [C] pointing at 96374', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: 'Zofran 4 mg slow IV push.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96374', '96360')).toBe(true);
  });
});

describe('injection/infusion inverse: [R]/[B] elements', () => {
  it('96372 with drug, dose, and site missing ⇒ three [R] findings', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        procedureType: 'Intramuscular (IM) Medication Injection',
        cptCodes: [{ code: '96372', display: 'IM injection' }],
        procedureDetails: 'IM injection given.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'medication administered is not documented', '96372')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'dose is not documented', '96372')).toBe(true);
    expect(hasFinding(result.findings, 'required', 'administration site is not documented', '96372')).toBe(true);
  });

  it('a fully documented IM injection supports 96372, with the J-code footnote', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        procedureType: 'Intramuscular (IM) Medication Injection',
        medicationUsed: 'Toradol 60 mg IM',
        bodySite: 'Deltoid',
        patientResponse: 'Tolerated without adverse reaction',
        cptCodes: [{ code: '96372', display: 'IM injection' }],
      })
    );
    expect(supportedCodes(result)).toEqual(['96372']);
    expect(result.payerNotes).toEqual([INJECTION_J_CODE_PAYER_NOTE]);
  });

  it('hydration with fluid type and volume missing ⇒ one combined [R] naming both', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96360', display: 'IV hydration initial' }],
        procedureDetails: 'IV hydration infusion. Start Time: 14:00. Stop Time: 15:00.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'not documented: fluid type, volume', '96360')).toBe(true);
  });

  it('a drug infusion code with the substance and dose missing ⇒ one combined [R]', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96365', display: 'IV infusion, therapy' }],
        procedureDetails: 'Antibiotic infused via left AC IV. Start Time: 14:00. Stop Time: 15:00.',
      })
    );
    expect(
      hasFinding(result.findings, 'required', 'not documented: the infused drug or substance, dose', '96365')
    ).toBe(true);
  });

  it('tolerance missing ⇒ entry-level [B]; the Patient response field satisfies it', () => {
    const missing = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96360', display: 'IV hydration initial' }],
        procedureDetails: `${HYDRATION_TEXT} Start Time: 14:00. Stop Time: 15:00.`,
      })
    );
    expect(hasFinding(missing.findings, 'bestPractice', 'Patient tolerance is not documented')).toBe(true);

    const viaField = injectionInfusionFamily.defendCodes(
      input({
        patientResponse: 'Tolerated well',
        cptCodes: [{ code: '96360', display: 'IV hydration initial' }],
        procedureDetails: `${HYDRATION_TEXT} Start Time: 14:00. Stop Time: 15:00.`,
      })
    );
    expect(hasFinding(viaField.findings, 'bestPractice', 'Patient tolerance is not documented')).toBe(false);
  });

  it('out-of-family codes are listed not assessed, never guessed', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '96367', display: 'Sequential infusion, additional sequential' },
          { code: '99213', display: 'Office visit' },
        ],
        procedureDetails: HYDRATION_TEXT,
      })
    );
    expect(notAssessedCodes(result)).toEqual(['96367', '99213']);
    expect(result.findings).toHaveLength(0);
  });
});

describe('injection/infusion: open candidates always carry their summary line', () => {
  it.each([
    ['no route documented', input({ procedureDetails: 'Medication administered.' })],
    ['an ambiguous infusate', input({ procedureDetails: 'Zofran 4 mg given. NS 1000 mL infused over an hour.' })],
    ['no start/stop times', input({ procedureDetails: HYDRATION_TEXT })],
    [
      'push wording against infusion-length times',
      input({ procedureDetails: 'Zofran 4 mg IV push.', infusionStartTime: '14:00', infusionStopTime: '17:00' }),
    ],
  ])('%s ⇒ openCandidates and openCandidatesSummary together', (_label, facts) => {
    const result = injectionInfusionFamily.suggestCode(facts);
    expect(offeredCandidates(result.outcome)?.length).toBeGreaterThan(0);
    expect(offeredSummary(result.outcome)).toBeTruthy();
  });
});
