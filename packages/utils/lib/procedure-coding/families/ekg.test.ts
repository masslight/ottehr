import { describe, expect, it } from 'vitest';
import { detectProcedureFamily } from '../evaluate';
import { ProcedureFactsInput } from '../model.types';
import {
  citedText,
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
import { ekgFamily } from './ekg';

function input(overrides: Partial<ProcedureFactsInput>): ProcedureFactsInput {
  return { procedureType: 'EKG', ...overrides };
}

const FULL_INTERPRETATION_TEXT =
  'Rate 82, normal sinus rhythm, normal axis. PR 160, QRS 88, QTc 410 ms. ' +
  'No acute ST-T changes. Impression: normal EKG. Compared to prior tracing — no change.';

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
    expect(suggestionOf(result)?.code).toBe('93000');
    expect(suggestionOf(result)?.justification).toContain('full interpretation is documented');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });

  it('a 12-lead tracing with no interpretation elements ⇒ 93005', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '12-lead EKG obtained.' }));
    expect(suggestionOf(result)?.code).toBe('93005');
    expect(suggestionOf(result)?.justification).toContain('without an interpretation and report');
    expect(offeredCandidates(result.outcome)).toBeUndefined();
  });

  it('a partial interpretation ⇒ 93000 with each missing element asked for individually', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '12-lead EKG: rate 118, sinus tachycardia.' }));
    expect(suggestionOf(result)?.code).toBe('93000');
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
    expect(suggestionOf(result)?.code).toBe('93010');
    expect(suggestionOf(result)?.justification).toContain('interpretation & report of the existing tracing');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });

  it('a partial interpretation of a tracing performed elsewhere ⇒ 93010 with the per-element [R]s', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: 'Interpretation of tracing performed elsewhere: rate 96, sinus rhythm.' })
    );
    expect(suggestionOf(result)?.code).toBe('93010');
    const required = result.findings.filter((f) => f.level === 'required');
    expect(required).toHaveLength(4);
    expect(required.every((f) => findingCode(f) === '93010')).toBe(true);
  });

  // The engine has no signal for who owned the tracing, so the justification must show the
  // assumption ("the note does not indicate …") rather than assert the premise as a fact.
  it('no external-tracing signal ⇒ 93000, justified by what the note does and does not say', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: FULL_INTERPRETATION_TEXT }));
    expect(suggestionOf(result)?.code).toBe('93000');
    expect(suggestionOf(result)?.justification).toContain(
      'the note does not indicate the tracing was obtained elsewhere'
    );
    expect(suggestionOf(result)?.justification).not.toContain('the practice performs the tracing');
  });

  it('the same premise is shown on the partial-interpretation 93000, not asserted', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '12-lead EKG: rate 118, sinus tachycardia.' }));
    expect(suggestionOf(result)?.code).toBe('93000');
    expect(suggestionOf(result)?.justification).toContain(
      'the note does not indicate the tracing was obtained elsewhere'
    );
    expect(suggestionOf(result)?.justification).not.toContain('in-office tracing');
  });

  it('a negative assessment still counts as documentation ("no acute ST-T changes")', () => {
    const result = ekgFamily.suggestCode(
      input({
        procedureDetails: 'Rate 74, NSR, normal axis, intervals normal, no acute ST-T changes. Impression: normal.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('93000');
    expect(result.findings.filter((f) => f.level === 'required')).toHaveLength(0);
  });
});

describe('ekg: the "at least 12 leads" clause every code carries', () => {
  it('a 3-lead rhythm strip ⇒ not assessed naming 93040-93042, not a 93000 suggestion', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: '3-lead rhythm strip: rate 88, sinus rhythm, no ST-T changes. Impression: normal.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    expect(isNotAssessed(result)).toBe(true);
    expect(notAssessedReason(result)).toContain('93040-93042');
    expect(result.findings[0]?.message).toContain('at least 12 leads');
    expect(citedText(result.findings[0])).toBeDefined();
  });

  it.each([['telemetry strip'], ['monitor strip']])('a %s is treated the same way', (phrase) => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: `${phrase} reviewed: rate 90, sinus rhythm.` }));
    expect(suggestionOf(result)).toBeUndefined();
    expect(notAssessedReason(result)).toContain('93040-93042');
  });

  it.each([['93000'], ['93005'], ['93010']])('a selected %s is contradicted by a limited-lead tracing', (code) => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code, display: 'EKG' }],
        procedureDetails: `3-lead rhythm strip: rate 88, sinus rhythm. ${FULL_INTERPRETATION_TEXT}`,
      })
    );
    expect(hasFinding(result.findings, 'contradiction', '93040-93042', code)).toBe(true);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  // A note that simply does not state the lead count keeps today's behaviour: the routine in-office
  // EKG is 12-lead, and the model does not start demanding the count.
  it('an unstated lead count changes nothing', () => {
    const result = ekgFamily.suggestCode(
      input({
        procedureDetails: 'Rate 74, NSR, normal axis, intervals normal, no acute ST-T changes. Impression: normal.',
      })
    );
    expect(suggestionOf(result)?.code).toBe('93000');
    expect(isNotAssessed(result)).toBe(false);
  });

  it('an explicit 12-lead tracing is never read as limited', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: `12-lead EKG. ${FULL_INTERPRETATION_TEXT}` }));
    expect(suggestionOf(result)?.code).toBe('93000');
  });
});

describe('ekg: an interpretation has to be a reading of a tracing, not a pasted HPI', () => {
  it('HPI text alone asks instead of suggesting 93000', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: 'Chest pain. History of a-fib on apixaban. HR 92.' })
    );
    expect(suggestionOf(result)).toBeUndefined();
    const ask = result.findings.find((f) => f.level === 'determines');
    expect(ask?.message).toContain('does not document an EKG tracing or a reading of one');
    expect(offeredCandidates(result.outcome)?.map((c) => c.code)).toEqual(['93000', '93005', '93010']);
    expect(offeredSummary(result.outcome)).toBeDefined();
  });

  it("a history-bound rhythm is not counted as the interpretation's rhythm", () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code: '93000', display: 'EKG complete' }],
        procedureDetails: 'Chest pain. History of a-fib on apixaban. 12-lead EKG: rate 92.',
      })
    );
    expect(hasFinding(result.findings, 'required', "interpretation's rhythm is not documented", '93000')).toBe(true);
  });

  it('a bare interpretation without the letters EKG still suggests 93000 (the type is the evidence)', () => {
    const result = ekgFamily.suggestCode(
      input({ procedureDetails: 'Rate 74, NSR, normal axis, intervals normal, no acute ST-T changes.' })
    );
    expect(suggestionOf(result)?.code).toBe('93000');
  });
});

describe('ekg: the axis abbreviation does not collide with the coronary artery', () => {
  it('"Known LAD stenosis" does not document the interpretation\'s axis', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code: '93010', display: 'Interpretation and report only' }],
        procedureDetails: 'Known LAD stenosis. 12-lead EKG: rate 78, NSR, PR 160, no ST-T changes. Impression: normal.',
      })
    );
    expect(hasFinding(result.findings, 'required', "interpretation's axis is not documented", '93010')).toBe(true);
  });

  it('the spelled-out axis findings still count', () => {
    const result = ekgFamily.defendCodes(
      input({
        cptCodes: [{ code: '93010', display: 'Interpretation and report only' }],
        procedureDetails:
          '12-lead EKG: rate 78, NSR, left axis deviation, PR 160, no ST-T changes. Impression: abnormal EKG.',
      })
    );
    expect(hasFinding(result.findings, 'required', "interpretation's axis is not documented", '93010')).toBe(false);
  });
});

describe('ekg: openCandidates always carry a summary (the UI only renders the summary)', () => {
  it('an entry with no tracing or interpretation names the open codes in one line', () => {
    const result = ekgFamily.suggestCode(input({ procedureDetails: '' }));
    expect(offeredCandidates(result.outcome)).toBeDefined();
    expect(offeredSummary(result.outcome)).toContain('93000');
    expect(offeredSummary(result.outcome)).toContain('93005');
    expect(offeredSummary(result.outcome)).toContain('93010');
  });

  it('a tracing-only note suggests and supports 93005 consistently', () => {
    const tracingOnly = { procedureDetails: '12-lead EKG obtained. Compared to prior — no change.' };
    expect(suggestionOf(ekgFamily.suggestCode(input(tracingOnly)))?.code).toBe('93005');
    expect(
      supportedCodes(
        ekgFamily.defendCodes(
          input({
            ...tracingOnly,
            diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
            cptCodes: [{ code: '93005', display: 'EKG tracing only' }],
          })
        )
      )
    ).toEqual(['93005']);
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
    const required = result.findings.filter((f) => f.level === 'required' && findingCode(f) === code);
    expect(required).toHaveLength(4);
    expect(supportedCodes(result)).toHaveLength(0);
  });

  it('a fully interpreted 93000 is supported with no [D]/[R]/[C] findings', () => {
    const result = ekgFamily.defendCodes(
      input({
        diagnoses: [{ code: 'R07.9', display: 'Chest pain, unspecified' }],
        cptCodes: [{ code: '93000', display: 'EKG complete' }],
        procedureDetails: FULL_INTERPRETATION_TEXT,
      })
    );
    expect(supportedCodes(result)).toEqual(['93000']);
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
    expect(supportedCodes(result)).toEqual(['93005']);
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
    const hint = result.findings.find((f) => f.level === 'bestPractice' && findingCode(f) === '93005');
    expect(hint?.message).toContain('93005 bills the tracing only');
    expect(hint?.message).toContain('93000 covers the tracing plus the interpretation & report');
    expect(supportedCodes(result)).toEqual(['93005']);
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
    expect(supportedCodes(result)).toEqual(['93000']);
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
    expect(notAssessedCodes(result)).toEqual(['93040']);
    expect(supportedCodes(result)).toEqual(['93000']);
  });
});
