import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { Finding, ProcedureFactsInput } from '../model.types';
import { ekgFamily } from './ekg';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'EKG', ...overrides };
}

const FULL_INTERPRETATION_TEXT =
  'Rate 82, normal sinus rhythm, normal axis. PR 160, QRS 88, QTc 410 ms. ' +
  'No acute ST-T changes. Impression: normal EKG. Compared to prior tracing — no change.';

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

describe('ekg detection', () => {
  it('detects the product procedure type display and code slug', () => {
    expect(detectProcedureFamily({ procedureType: 'EKG' })?.id).toBe('ekg');
    expect(detectProcedureFamily({ procedureType: 'ekg' })?.id).toBe('ekg');
  });

  it('detects from a selected EKG code alone', () => {
    expect(detectProcedureFamily({ cptCodes: [{ code: '93000', display: 'EKG complete' }] })?.id).toBe('ekg');
    expect(detectProcedureFamily({ cptCodes: [{ code: '93010', display: 'Interpretation and report' }] })?.id).toBe(
      'ekg'
    );
  });

  it('does not claim other procedure types, and they do not claim EKG entries', () => {
    expect(ekgFamily.detect({ procedureType: 'X-Ray' })).toBe(false);
    expect(ekgFamily.detect({ procedureType: 'Ear Lavage / Cerumen Removal' })).toBe(false);
    expect(detectProcedureFamily({ procedureType: 'EKG' })?.id).toBe('ekg');
  });
});

describe('ekg forward: interpretation elements determine the component', () => {
  it('a full interpretation documented ⇒ 93000 (the office owns the tracing)', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: FULL_INTERPRETATION_TEXT }));
    expect(result.suggestion?.code).toBe('93000');
    expect(result.suggestion?.justification).toContain('full interpretation is documented');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });

  it('no interpretation elements ⇒ [D] ask rather than a 93005 suggestion', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '12-lead EKG obtained.' }));
    expect(result.suggestion).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('No interpretation elements are documented');
    expect(ask?.message).toContain('93005 the tracing only');
    expect(result.openCandidates?.map((c) => c.code)).toEqual(['93000', '93005', '93010']);
  });

  it('a partial interpretation ⇒ 93000 with each missing element asked for individually', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '12-lead EKG: rate 118, sinus tachycardia.' }));
    expect(result.suggestion?.code).toBe('93000');
    const required = result.findings.filter((f) => f.level === 'required');
    expect(required).toHaveLength(4);
    expect(hasFinding(required, 'required', "interpretation's axis is not documented", '93000')).toBe(true);
    expect(hasFinding(required, 'required', "interpretation's intervals (PR/QRS/QTc) is not documented", '93000')).toBe(
      true
    );
    expect(hasFinding(required, 'required', "interpretation's ST-T assessment is not documented", '93000')).toBe(true);
    expect(hasFinding(required, 'required', "interpretation's impression is not documented", '93000')).toBe(true);
  });

  it('an over-read of an externally-obtained tracing ⇒ 93010, not the in-office 93000', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: `Over-read of EKG obtained at urgent care. ${FULL_INTERPRETATION_TEXT}` })
    );
    expect(result.suggestion?.code).toBe('93010');
    expect(result.suggestion?.justification).toContain('interpretation & report of the existing tracing');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });

  it('a partial interpretation of a tracing performed elsewhere ⇒ 93010 with the per-element [R]s', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: 'Interpretation of tracing performed elsewhere: rate 96, sinus rhythm.' })
    );
    expect(result.suggestion?.code).toBe('93010');
    const required = result.findings.filter((f) => f.level === 'required');
    expect(required).toHaveLength(4);
    expect(required.every((f) => f.cptCode === '93010')).toBe(true);
  });

  it('no external-tracing signal ⇒ the in-office 93000 default is unchanged', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: FULL_INTERPRETATION_TEXT }));
    expect(result.suggestion?.code).toBe('93000');
    expect(result.suggestion?.justification).toContain('the practice performs the tracing in the office');
  });

  it('a negative assessment still counts as documentation ("no acute ST-T changes")', () => {
    const result = ekgFamily.suggestCode(
      input({
        procedureDetails: 'Rate 74, NSR, normal axis, intervals normal, no acute ST-T changes. Impression: normal.',
      })
    );
    expect(result.suggestion?.code).toBe('93000');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });
});

describe('ekg inverse: per-element [R]s for the interpretation codes', () => {
  it.each([['93000'], ['93010']])('%s with missing elements ⇒ one [R] per missing element', (code) => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code, display: 'EKG' }],
        procedureDetails: 'Rate 82, normal sinus rhythm.',
      })
    );
    const required = result.findings.filter((f) => f.level === 'required' && f.cptCode === code);
    expect(required).toHaveLength(4);
    expect(result.supportedCodes).toHaveLength(0);
  });

  it('a fully interpreted 93000 is supported with no [D]/[R]/[C] findings', () => {
    const result = ekgFamily.defendCodes(
      input({
        diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
        cptCodes: [{ code: '93000', display: 'EKG complete' }],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(result.supportedCodes).toEqual(['93000']);
    expect(
      result.findings.filter((f) => f.level === 'determines' || f.level === 'required' || f.level === 'contradiction')
    ).toHaveLength(0);
  });

  it('93005 needs no interpretation elements to be supported', () => {
    const result = ekgFamily.defendCodes(
      input({
        diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
        cptCodes: [{ code: '93005', display: 'EKG tracing only' }],
        procedureDetails: '12-lead EKG obtained. Compared to prior — no change.',
      })
    );
    expect(result.supportedCodes).toEqual(['93005']);
  });
});

describe('ekg inverse: the 93005-with-interpretation mismatch hint', () => {
  it('93005 selected while a full interpretation is documented ⇒ the [C]-lite hint (still supported)', () => {
    const result = ekgFamily.defendCodes(
      input({
        diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
        cptCodes: [{ code: '93005', display: 'EKG tracing only' }],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    const hint = result.findings.find((f) => f.level === 'bestPractice' && f.cptCode === '93005');
    expect(hint?.message).toContain('93005 bills the tracing only');
    expect(hint?.message).toContain('93000 covers the tracing plus the interpretation & report');
    expect(result.supportedCodes).toEqual(['93005']);
  });

  it('no hint when the interpretation is incomplete', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code: '93005', display: 'EKG tracing only' }],
        procedureDetails: 'Rate 82, normal sinus rhythm.',
      })
    );
    expect(hasFinding(result.findings, 'bestPractice', '93005 bills the tracing only')).toBe(false);
  });
});

describe('ekg inverse: component double-billing', () => {
  it('93000 + 93005 ⇒ [C] on the tracing component', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [
          { code: '93000', display: 'EKG complete' },
          { code: '93005', display: 'EKG tracing only' },
        ],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'double-bills that component', '93005')).toBe(true);
    expect(result.supportedCodes).toEqual(['93000']);
  });

  it('93000 + 93010 ⇒ [C] on the interpretation component', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [
          { code: '93000', display: 'EKG complete' },
          { code: '93010', display: 'Interpretation and report only' },
        ],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', 'double-bills that component', '93010')).toBe(true);
  });
});

describe('ekg inverse: entry-level best practices and scope honesty', () => {
  it('indication and comparison missing ⇒ [B] findings; structured diagnoses satisfy the indication', () => {
    const missing = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code: '93000', display: 'EKG complete' }],
        procedureDetails:
          'Rate 82, NSR, normal axis. PR 160, QRS 88, QTc 410 ms. No ST-T changes. Impression: normal EKG.',
      })
    );
    expect(hasFinding(missing.findings, 'bestPractice', 'indication for the EKG is not documented')).toBe(true);
    expect(hasFinding(missing.findings, 'bestPractice', 'Comparison to a prior tracing is not documented')).toBe(true);

    const withDx = ekgFamily.defendCodes(
      input({
        diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
        cptCodes: [{ code: '93000', display: 'EKG complete' }],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(hasFinding(withDx.findings, 'bestPractice', 'indication for the EKG is not documented')).toBe(false);
    expect(hasFinding(withDx.findings, 'bestPractice', 'Comparison to a prior tracing is not documented')).toBe(false);
  });

  it('rhythm-strip codes are outside scope ⇒ not assessed, never guessed', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [
          { code: '93000', display: 'EKG complete' },
          { code: '93040', display: 'Rhythm ECG, 1-3 leads' },
        ],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(result.notAssessedCodes).toEqual(['93040']);
    expect(result.supportedCodes).toEqual(['93000']);
  });
});
