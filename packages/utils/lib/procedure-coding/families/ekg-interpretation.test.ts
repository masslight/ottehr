import { describe, expect, it } from 'vitest';
import { formatStructuredFacts } from '../format';
import { PROCEDURE_NAMES } from '../procedure-names';
import { calculateQtc, ekgQtc, ekgQtcMethod, withEkgQtc } from './ekg-interpretation';

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
    expect(withEkgQtc({ qt: 380, qtc: 416, qtcMethod: 'Bazett' }).qtc).toBeUndefined();
    const manual = { qt: 380, rate: 72, qtc: 430, qtcMethod: 'manual' };
    expect(withEkgQtc(manual)).toBe(manual);
  });

  it('prints the measurements with the QTc method and the interpretation lists in the note', () => {
    const text = formatStructuredFacts(
      { rate: 72, qt: 380, qtc: 416, qtcMethod: 'Bazett', conduction: ['normal'], stt: [] },
      PROCEDURE_NAMES.ekg[0]
    );
    expect(text).toContain('Rate (bpm): 72');
    expect(text).toContain('QTc (ms): 416\nQTc method: Bazett');
    expect(text).toContain('Intervals and conduction: normal');
    expect(text).not.toContain('ST / T');
  });
});
