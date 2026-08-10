import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import {
  additionalHourUnits,
  extractInfusionDuration,
  extractInjectionInfusionFacts,
  INJECTION_J_CODE_PAYER_NOTE,
  injectionInfusionFamily,
} from './injection-infusion';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'IV Fluid Administration', ...overrides };
}

const HYDRATION_TEXT = 'NS 1000 mL IV hydration infusion via left antecubital IV.';

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

describe('injection/infusion detection', () => {
  it.each([
    ['Intramuscular (IM) Medication Injection'],
    ['im-medication-injection'],
    ['IV Fluid Administration'],
    ['iv-fluid-administration'],
  ])('detects the product procedure type %s', (procedureType) => {
    expect(detectProcedureFamily({ procedureType })?.id).toBe('injection-infusion');
  });

  it('detects from a selected administration code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '96372', display: 'IM injection' }] })?.id).toBe(
      'injection-infusion'
    );
    expect(detectProcedureFamily({ cptCodes: [{ code: '96365', display: 'IV hydration' }] })?.id).toBe(
      'injection-infusion'
    );
  });

  // The adjacent in-house-med types are different services: oral rehydration stays uncovered
  // (no-code type), the others belong to their own (fixed-code or urinary) families.
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
    expect(duration?.confidence).toBe('structured');
  });

  it.each([
    ['template lines', 'Start Time: 14:05. Stop Time: 14:47.', 42],
    ['a time range', 'NS infusion 14:05–14:47, tolerated well.', 42],
    ['a time range with a shared meridiem', 'Infusion 2:05–2:47 pm.', 42],
    ['started/stopped prose with meridiems', 'Infusion started at 2:05 pm and stopped at 2:47 pm.', 42],
  ])('parses %s from the details text', (_label, text, expected) => {
    const duration = extractInfusionDuration(input({}), text);
    expect(duration?.durationMinutes).toBe(expected);
    expect(duration?.confidence).toBe('text');
    expect(duration?.sourceText).toBeDefined();
  });

  it('handles a cross-midnight infusion (stop earlier than start ⇒ +24 h)', () => {
    const duration = extractInfusionDuration(input({ infusionStartTime: '23:50', infusionStopTime: '00:35' }), '');
    expect(duration?.durationMinutes).toBe(45);
    expect(duration?.crossesMidnight).toBe(true);
  });

  it('returns undefined when only one time is documented', () => {
    expect(extractInfusionDuration(input({ infusionStartTime: '14:05' }), 'Started at 14:05.')).toBeUndefined();
  });
});

describe('96366 add-on unit math (each additional hour needs >30 minutes into it)', () => {
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
    expect(injectionInfusionFamily.suggestCode(input({ procedureDetails: text })).suggestion?.code).toBe('96372');
  });

  it('"NS" reads as the fluid type, and a "cc" figure as the volume (mL equivalent)', () => {
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: 'NS 1000 cc infused via left AC IV.' }));
    expect(facts.fluidDocumented?.value).toBe(true);
    expect(facts.volumeDocumented?.value).toBe(true);
    expect(facts.route?.value).toBe('infusion');
  });

  it('a fluid plus a cc volume alone infer an infusion the same as an mL volume', () => {
    const facts = extractInjectionInfusionFacts(input({ procedureDetails: 'D5W 500 cc given over an hour.' }));
    expect(facts.volumeDocumented?.value).toBe(true);
    expect(facts.route?.value).toBe('infusion');
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
    expect(result.suggestion?.code).toBe('96372');
    expect(result.payerNotes).toEqual([INJECTION_J_CODE_PAYER_NOTE]);
  });

  it('SubQ site language in the text ⇒ 96372', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Rocephin 500 mg administered to the left deltoid; tolerated well.' })
    );
    expect(result.suggestion?.code).toBe('96372');
  });

  it('IV push documented ⇒ 96374', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Zofran 4 mg slow IV push over 2 minutes.' })
    );
    expect(result.suggestion?.code).toBe('96374');
  });

  it('an NS flush after a push does not read as a hydration infusion', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: 'Zofran 4 mg IV push, line flushed with 10 mL NS.' })
    );
    expect(result.suggestion?.code).toBe('96374');
  });

  it('no route documented ⇒ [D] ask over 96372/96374/96365', () => {
    const result = injectionInfusionFamily.suggestCode(input({ procedureDetails: 'Medication administered.' }));
    expect(result.suggestion).toBeUndefined();
    expect(hasFinding(result.findings, 'determines', 'administration route is not documented')).toBe(true);
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['96372', '96374', '96365']);
  });
});

describe('injection/infusion forward: hydration duration math', () => {
  function hydrationInput(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
    return input({ procedureDetails: HYDRATION_TEXT, ...overrides });
  }

  it('no start/stop times ⇒ [D] ask that names the Time spent limitation', () => {
    const result = injectionInfusionFamily.suggestCode(hydrationInput({}));
    expect(result.suggestion).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('Start and stop times are not documented');
    expect(ask?.message).toContain('Time spent dropdown records a total only');
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['96365', '96366']);
  });

  it('30 minutes documented ⇒ [C] with the computed minutes, no suggestion (the 31-minute boundary)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: '14:35' })
    );
    expect(result.suggestion).toBeUndefined();
    const contradiction = result.findings.find((f) => f.level === 'contradiction');
    expect(contradiction?.message).toContain('total 30 minutes');
    expect(contradiction?.message).toContain('96365 requires at least 31 minutes');
  });

  it('31 minutes documented ⇒ 96365 (the other side of the boundary)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: '14:36' })
    );
    expect(result.suggestion?.code).toBe('96365');
    expect(result.suggestion?.addOns).toBeUndefined();
    expect(result.suggestion?.justification).toContain('total 31 minutes');
  });

  it('90 minutes ⇒ 96365 alone (only 30 minutes into the additional hour)', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:00', infusionStopTime: '15:30' })
    );
    expect(result.suggestion?.code).toBe('96365');
    expect(result.suggestion?.addOns).toBeUndefined();
  });

  it('91 minutes ⇒ 96365 + 96366 × 1, with the math stated', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:00', infusionStopTime: '15:31' })
    );
    expect(result.suggestion?.code).toBe('96365');
    expect(result.suggestion?.addOns).toEqual([expect.objectContaining({ code: '96366', units: 1 })]);
    expect(result.suggestion?.justification).toContain('total 91 minutes');
    expect(result.suggestion?.justification).toContain('31 minutes beyond the first hour');
    expect(result.suggestion?.justification).toContain('more than 30 minutes');
  });

  it('151 minutes ⇒ 96365 + 96366 × 2', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '14:05', infusionStopTime: '16:36' })
    );
    expect(result.suggestion?.addOns).toEqual([expect.objectContaining({ code: '96366', units: 2 })]);
  });

  it('a cross-midnight infusion computes through 00:00 and says so', () => {
    const result = injectionInfusionFamily.suggestCode(
      hydrationInput({ infusionStartTime: '23:50', infusionStopTime: '00:35' })
    );
    expect(result.suggestion?.code).toBe('96365');
    expect(result.suggestion?.justification).toContain('crossing midnight');
    expect(result.suggestion?.justification).toContain('total 45 minutes');
  });

  it('text-derived times drive the same math as the structured inputs', () => {
    const result = injectionInfusionFamily.suggestCode(
      input({ procedureDetails: `${HYDRATION_TEXT} Start Time: 14:05. Stop Time: 16:36.` })
    );
    expect(result.suggestion?.addOns).toEqual([expect.objectContaining({ code: '96366', units: 2 })]);
  });
});

describe('injection/infusion inverse: pinned contradictions', () => {
  const HYDRATION_CODES = [{ code: '96365', display: 'IV hydration initial' }];

  it('96365 selected with 30 minutes documented ⇒ [C] stating the math (31 ⇒ no [C])', () => {
    const short = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:05',
        infusionStopTime: '14:35',
      })
    );
    const contradiction = short.findings.find((f) => f.level === 'contradiction' && f.cptCode === '96365');
    expect(contradiction?.message).toContain('total 30 minutes');
    expect(contradiction?.message).toContain('96365 requires at least 31 minutes');
    expect(short.supportedCodes).toHaveLength(0);

    const exact = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: HYDRATION_CODES,
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:05',
        infusionStopTime: '14:36',
      })
    );
    expect(exact.findings.filter((f) => f.level === 'contradiction')).toHaveLength(0);
    expect(exact.supportedCodes).toEqual(['96365']);
  });

  it('96365 selected with no start/stop times ⇒ [R] naming the Time spent limitation', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({ cptCodes: HYDRATION_CODES, procedureDetails: HYDRATION_TEXT, timeSpent: '30-45 minutes' })
    );
    const ask = result.findings.find((f) => f.level === 'required' && /start and stop times/i.test(f.message));
    expect(ask?.message).toContain('Time spent dropdown records a total only');
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('96366 selected without 96365 ⇒ [C] add-on pairing', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96366', display: 'IV hydration additional hour' }],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '16:00',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '96365 is not selected', '96366')).toBe(true);
  });

  it('96366 selected with a duration supporting zero units ⇒ [C] stating the add-on math', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '96365', display: 'IV hydration initial' },
          { code: '96366', display: 'IV hydration additional hour' },
        ],
        procedureDetails: HYDRATION_TEXT,
        infusionStartTime: '14:00',
        infusionStopTime: '15:20',
      })
    );
    const contradiction = result.findings.find((f) => f.level === 'contradiction' && f.cptCode === '96366');
    expect(contradiction?.message).toContain('20 minutes beyond the first hour');
    expect(contradiction?.message).toContain('support no 96366 units');
    expect(result.supportedCodes).toEqual(['96365']);
  });

  it('96372 selected while the note documents IV administration ⇒ [C]', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96372', display: 'IM injection' }],
        procedureDetails: 'Zofran 4 mg IV push via left antecubital line.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'documents intravenous administration', '96372')).toBe(true);
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

  it('96374 selected while the note documents an infusion ⇒ [C] pointing at 96365', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96374', display: 'IV push' }],
        procedureDetails: 'NS 1000 mL infusion over one hour.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96365', '96374')).toBe(true);
  });

  it('96365 selected while the note documents only an IV push ⇒ [C] pointing at 96374', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96365', display: 'IV hydration initial' }],
        procedureDetails: 'Zofran 4 mg slow IV push.',
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'reported with 96374', '96365')).toBe(true);
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
    expect(result.supportedCodes).toEqual(['96372']);
    expect(result.payerNotes).toEqual([INJECTION_J_CODE_PAYER_NOTE]);
  });

  it('hydration with fluid type and volume missing ⇒ one combined [R] naming both', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96365', display: 'IV hydration initial' }],
        procedureDetails: 'IV hydration infusion. Start Time: 14:00. Stop Time: 15:00.',
      })
    );
    expect(hasFinding(result.findings, 'required', 'not documented: fluid type, volume', '96365')).toBe(true);
  });

  it('tolerance missing ⇒ entry-level [B]; the Patient response field satisfies it', () => {
    const missing = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [{ code: '96365', display: 'IV hydration initial' }],
        procedureDetails: `${HYDRATION_TEXT} Start Time: 14:00. Stop Time: 15:00.`,
      })
    );
    expect(hasFinding(missing.findings, 'bestPractice', 'Patient tolerance is not documented')).toBe(true);

    const viaField = injectionInfusionFamily.defendCodes(
      input({
        patientResponse: 'Tolerated well',
        cptCodes: [{ code: '96365', display: 'IV hydration initial' }],
        procedureDetails: `${HYDRATION_TEXT} Start Time: 14:00. Stop Time: 15:00.`,
      })
    );
    expect(hasFinding(viaField.findings, 'bestPractice', 'Patient tolerance is not documented')).toBe(false);
  });

  it('out-of-family codes are listed not assessed, never guessed', () => {
    const result = injectionInfusionFamily.defendCodes(
      input({
        cptCodes: [
          { code: '96361', display: 'Hydration, each additional hour (96360 family)' },
          { code: '99213', display: 'Office visit' },
        ],
        procedureDetails: HYDRATION_TEXT,
      })
    );
    expect(result.notAssessedCodes).toEqual(['96361', '99213']);
    expect(result.findings).toHaveLength(0);
  });
});
