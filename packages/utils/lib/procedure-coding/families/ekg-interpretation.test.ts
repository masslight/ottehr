import { describe, expect, it } from 'vitest';
import { assembleSentence, isSentenceBlank } from '../../helpers/suggested-sentences';
import { formatStructuredFacts } from '../format';
import { PROCEDURE_NAMES } from '../procedure-names';
import {
  calculateQtc,
  ekgMeasurementLine,
  ekgQtc,
  ekgQtcMethod,
  ekgReminders,
  EkgSuggestion,
  ekgSuggestionPicks,
  isEkgInterpretationApplied,
  suggestEkgInterpretations,
  withEkgQtc,
} from './ekg-interpretation';
import {
  EKG_AXES,
  EKG_CONDUCTION,
  EKG_IMPRESSIONS,
  EKG_NORMAL_READ,
  EKG_OTHER_FINDINGS,
  EKG_RHYTHMS,
  EKG_ST_T,
  EKG_TEMPLATES,
} from './ekg-templates';

describe('QTc', () => {
  it('calculates Bazett by default and Fridericia on request, rounded to the millisecond', () => {
    expect(calculateQtc(380, 72, 'Bazett')).toBe(416);
    expect(calculateQtc(380, 72, 'Fridericia')).toBe(404);
    expect(ekgQtc({ qt: 380, rate: 72 })).toBe(416);
    expect(ekgQtcMethod({ qt: 380, rate: 72 })).toBe('Bazett');
    expect(ekgQtc({ qt: 380, rate: 72, qtcMethod: 'Fridericia' })).toBe(404);
    expect(ekgQtc({ qt: 380 })).toBeUndefined();
  });

  it('shows the typed value, whatever the QT and rate, once the method is manual', () => {
    expect(ekgQtc({ qt: 380, rate: 72, qtc: 430, qtcMethod: 'manual' })).toBe(430);
    expect(ekgQtc({ qtcMethod: 'manual' })).toBeUndefined();
  });

  it('keeps the stored value and method in step with QT and rate so the note needs no arithmetic', () => {
    expect(withEkgQtc({ qt: 380, rate: 72 })).toMatchObject({ qtc: 416, qtcMethod: 'Bazett' });
    expect(withEkgQtc({ qt: 380, rate: 72, qtcMethod: 'Fridericia' })).toMatchObject({ qtc: 404 });
    // No QTc, no method: a method alone would only be noise in the note.
    expect(withEkgQtc({ qt: 380, qtc: 416, qtcMethod: 'Bazett' })).toEqual({
      qt: 380,
      qtc: undefined,
      qtcMethod: undefined,
    });
    expect(withEkgQtc({ qtcMethod: 'manual' }).qtcMethod).toBeUndefined();
    expect(withEkgQtc({ qt: 380, rate: 72, qtc: 430, qtcMethod: 'manual' })).toMatchObject({
      qtc: 430,
      qtcMethod: 'manual',
    });
  });

  it('reads the measurements as one line in the note, between the billing answers and the interpretation', () => {
    expect(
      ekgMeasurementLine({ rate: 72, pr: 160, qrs: 88, qt: 380, qtc: 416, qtcMethod: 'Bazett', axisDegrees: 45 })
    ).toBe('Rate 72 bpm, PR 160 ms, QRS 88 ms, QT/QTc 380/416 ms (Bazett), axis +45°.');
    expect(ekgMeasurementLine({ rate: 72, qt: 380, qtcMethod: 'Fridericia', axisDegrees: -30 })).toBe(
      'Rate 72 bpm, QT/QTc 380/404 ms (Fridericia), axis -30°.'
    );
    expect(ekgMeasurementLine({ qtc: 430, qtcMethod: 'manual' })).toBe('QTc 430 ms (manual).');
    expect(ekgMeasurementLine({ qt: 380, qtcMethod: 'Bazett' })).toBe('QT 380 ms.');
    expect(ekgMeasurementLine({ rhythm: 'sinus rhythm' })).toBeUndefined();

    const text = formatStructuredFacts(
      {
        component: 'tracing and report',
        rate: 72,
        qt: 380,
        qtc: 416,
        qtcMethod: 'Bazett',
        conduction: ['normal'],
        stt: [],
      },
      PROCEDURE_NAMES.ekg[0]
    );
    expect(text).toBe(
      'Component furnished: tracing and report\nRate 72 bpm, QT/QTc 380/416 ms (Bazett).\nIntervals and conduction: normal'
    );
    expect(formatStructuredFacts({ component: 'tracing only' }, PROCEDURE_NAMES.ekg[0])).toBe(
      'Component furnished: tracing only'
    );
  });
});

describe('templates data', () => {
  it('names a defined blank or typed number in every token, and fills only interpretation fields', () => {
    const NUMBERS = ['rate', 'pr', 'qrs', 'qtc'];
    for (const template of EKG_TEMPLATES) {
      for (const [, name] of template.text.matchAll(/\{(\w+)\}/g))
        expect(NUMBERS.includes(name) || name in (template.blanks ?? {}), `${template.id}: {${name}}`).toBe(true);
      for (const blank of Object.values(template.blanks ?? {})) {
        for (const initial of Object.values(blank.initial ?? {})) expect(blank.options).toContain(initial);
        for (const word of Object.keys(blank.fieldValue ?? {})) expect(blank.options).toContain(word);
      }
      for (const key of Object.keys(template.fills)) expect(EKG_NORMAL_READ).toHaveProperty(key);
    }
    expect(EKG_TEMPLATES.filter((template) => template.forChildren)).toHaveLength(1);
  });

  it("fills every field with one of the field's own options", () => {
    const lists: Record<string, string[]> = {
      rhythm: EKG_RHYTHMS,
      axis: EKG_AXES,
      conduction: EKG_CONDUCTION,
      stt: EKG_ST_T,
      otherFindings: EKG_OTHER_FINDINGS,
      impression: EKG_IMPRESSIONS,
    };
    for (const suggestion of suggestEkgInterpretations({ rate: 40, pr: 240, qrs: 140, qt: 500, qtc: 480 }, false)) {
      for (const [key, value] of Object.entries(ekgSuggestionPicks(suggestion, [])))
        for (const option of Array.isArray(value) ? value : [value])
          expect(lists[key], `${suggestion.id}: ${key}`).toContain(option);
    }
  });
});

describe('suggested interpretations', () => {
  const ids = (numbers: Parameters<typeof suggestEkgInterpretations>[0], isChild = false): string[] =>
    suggestEkgInterpretations(numbers, isChild).map((suggestion) => suggestion.id);
  const text = (suggestion: EkgSuggestion): string => assembleSentence(suggestion.segments, []);

  it('offers nothing until rate and QT are entered, then the normal read first when the numbers are normal', () => {
    expect(ids({ rate: 72 })).toEqual([]);
    expect(ids({ qt: 380 })).toEqual([]);
    expect(ids({ rate: 72, pr: 160, qrs: 88, qt: 380, qtc: 416 })).toEqual(['normal', 'nonspecific-st-t']);
  });

  it('ranks the read that fits the abnormal number first, says why, and copies the number into the sentence', () => {
    const [block] = suggestEkgInterpretations({ rate: 64, pr: 236, qrs: 92, qt: 410, qtc: 423 }, false);
    expect(block.id).toBe('first-degree-block');
    expect(block.reason).toBe('PR 236 ms is over 200');
    expect(text(block)).toBe(
      'Sinus rhythm with first-degree AV block, PR 236 ms. Normal axis. No acute ST-T wave changes. Impression: borderline ECG.'
    );
    expect(ids({ rate: 118, pr: 140, qrs: 84, qt: 320, qtc: 449 })).toEqual(['rate', 'normal', 'nonspecific-st-t']);
    const [tachy] = suggestEkgInterpretations({ rate: 118, qt: 320 }, false);
    expect(text(tachy)).toContain('Sinus tachycardia, rate 118.');
    expect(tachy.reason).toBe('rate 118 is above 100');
    expect(ids({ rate: 52, qt: 430, qtc: 400 })[0]).toBe('rate');
    expect(ids({ rate: 88, pr: 172, qrs: 136, qt: 400, qtc: 484 })).toEqual(['wide-qrs', 'prolonged-qtc', 'normal']);
  });

  it('fills the interpretation fields from the row, with the chosen words mapped to the field choices', () => {
    const [block] = suggestEkgInterpretations({ rate: 64, pr: 236, qt: 410 }, false);
    expect(ekgSuggestionPicks(block, [])).toEqual({
      rhythm: 'sinus rhythm',
      axis: 'normal',
      conduction: ['first-degree AV block'],
      stt: ['no acute ST-T wave changes'],
      otherFindings: ['none'],
      impression: 'borderline ECG',
    });
    const [wide] = suggestEkgInterpretations({ rate: 88, qrs: 136, qt: 400 }, false);
    const picks = wide.segments.map((segment, i) =>
      isSentenceBlank(segment) && segment.title === 'Axis'
        ? 'Left axis deviation'
        : i === 1
        ? 'left bundle branch block'
        : undefined
    );
    expect(ekgSuggestionPicks(wide, picks)).toMatchObject({
      conduction: ['left bundle branch block'],
      axis: 'left axis deviation',
      stt: ['no acute ST-T wave changes'],
      impression: 'abnormal ECG',
    });
  });

  it('only suggests the normal read for a child, whatever the numbers', () => {
    expect(ids({ rate: 118, pr: 236, qrs: 136, qt: 480, qtc: 500 }, true)).toEqual(['normal']);
  });

  it('knows when the fields already hold a row, list order included', () => {
    const [normal] = suggestEkgInterpretations({ rate: 72, qt: 380 }, true);
    const read = ekgSuggestionPicks(normal, []);
    expect(isEkgInterpretationApplied({ ...read, comparison: 'no prior EKG available' }, read)).toBe(true);
    expect(isEkgInterpretationApplied({ ...read, impression: 'otherwise normal ECG' }, read)).toBe(false);
    expect(isEkgInterpretationApplied({ ...read, conduction: ['normal', 'prolonged QTc'] }, read)).toBe(false);
    expect(isEkgInterpretationApplied({}, read)).toBe(false);
  });
});

describe('reminders', () => {
  it('says nothing while the interpretation agrees with the numbers', () => {
    expect(ekgReminders({ rate: 64, pr: 236, qt: 410, conduction: ['first-degree AV block'] })).toEqual([]);
    expect(ekgReminders({ rate: 64, pr: 236, qt: 410 })).toEqual([]);
    expect(
      ekgReminders({ rate: 72, pr: 160, qrs: 88, qt: 380, conduction: ['normal'], impression: 'normal ECG' })
    ).toEqual([]);
  });

  it('names each contradiction with a one-click fix that resolves it', () => {
    const facts = {
      rate: 64,
      pr: 236,
      qrs: 136,
      qt: 480,
      qtc: 495,
      qtcMethod: 'manual',
      conduction: ['normal'],
      impression: 'normal ECG',
    };
    const reminders = ekgReminders(facts);
    expect(reminders.map((reminder) => reminder.message)).toEqual([
      'A PR of 236 ms meets the definition of first-degree AV block; Intervals says "normal".',
      'A QRS of 136 ms is wide, consistent with a bundle branch block or conduction delay; Intervals says "normal".',
      'A QTc of 495 ms is prolonged; Intervals says "normal".',
      'Impression is "normal ECG", but the findings above (first-degree AV block, wide QRS, prolonged QTc) make it borderline or abnormal.',
    ]);
    expect(reminders[0].fixes).toEqual([
      { label: 'Add first-degree AV block', apply: { conduction: ['first-degree AV block'] } },
    ]);
    expect(reminders[1].fixes.map((fix) => fix.label)).toEqual([
      'Add right bundle branch block',
      'Add left bundle branch block',
      'Add nonspecific conduction delay',
    ]);
    expect(reminders[3].fixes[0].apply).toEqual({ impression: 'abnormal ECG' });
    // Applying a fix clears its reminder; a single finding makes the impression borderline.
    const fixed = { ...facts, ...reminders[0].fixes[0].apply, qrs: 90, qtc: 430 };
    expect(ekgReminders(fixed).map((reminder) => reminder.fixes[0].apply)).toEqual([{ impression: 'borderline ECG' }]);
  });
});
