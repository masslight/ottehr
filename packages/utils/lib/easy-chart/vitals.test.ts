// Each case here is a failure that actually happened, or the documented threshold that prevents one.

import { describe, expect, it } from 'vitest';
import {
  canonicalizeVitalUnit,
  countVitalReadings,
  isImplausibleHeight,
  MIN_PLAUSIBLE_HEIGHT_CM,
  MIN_PLAUSIBLE_HEIGHT_IN,
  parseVitalDisplay,
  recoverVitalReading,
} from './vitals';

describe('canonicalizeVitalUnit', () => {
  it('converts every length unit a provider might write into cm or in', () => {
    expect(canonicalizeVitalUnit('vital-height', 1730, 'mm')).toEqual({ value: 173, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-height', 173, 'cm')).toEqual({ value: 173, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-height', 1.73, 'm')).toEqual({ value: 173, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-height', 1.73, 'meters')).toEqual({ value: 173, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-height', 68, 'in')).toEqual({ value: 68, unit: 'in' });
    expect(canonicalizeVitalUnit('vital-height', 68, '"')).toEqual({ value: 68, unit: 'in' });
    expect(canonicalizeVitalUnit('vital-height', 5, 'ft')).toEqual({ value: 60, unit: 'in' });
  });

  it('converts every mass unit a provider might write into kg or lb', () => {
    expect(canonicalizeVitalUnit('vital-weight', 22.4, 'kg')).toEqual({ value: 22.4, unit: 'kg' });
    expect(canonicalizeVitalUnit('vital-weight', 500, 'g')).toEqual({ value: 0.5, unit: 'kg' });
    expect(canonicalizeVitalUnit('vital-weight', 130, 'lb')).toEqual({ value: 130, unit: 'lb' });
    expect(canonicalizeVitalUnit('vital-weight', 130, 'pounds')).toEqual({ value: 130, unit: 'lb' });
    expect(canonicalizeVitalUnit('vital-weight', 8, 'oz')).toEqual({ value: 0.5, unit: 'lb' });
  });

  // 5 st → 70 lb must not surface as 69.99999999999999.
  it('rounds to 2dp so a conversion never surfaces as float noise', () => {
    expect(canonicalizeVitalUnit('vital-weight', 5, 'stones')).toEqual({ value: 70, unit: 'lb' });
  });

  // There is NO word boundary between a digit and a letter, so `\blb\b` fails on `130lb`. The rules
  // use a `(?<![a-z])` lookbehind instead.
  it('matches a unit that abuts its number', () => {
    expect(canonicalizeVitalUnit('vital-weight', 130, 'lb')).toBeDefined();
    expect(parseVitalDisplay('vital-weight', '130lb')).toEqual({ status: 'ok', value: 130, unit: 'lb' });
    expect(parseVitalDisplay('vital-height', '1.73m')).toEqual({ status: 'ok', value: 173, unit: 'cm' });
  });

  // "grams" must not yield the "ms" of metres.
  it('does not match a unit inside a longer word', () => {
    expect(canonicalizeVitalUnit('vital-height', 500, 'grams')).toBeUndefined();
    expect(canonicalizeVitalUnit('vital-weight', 500, 'grams')).toEqual({ value: 0.5, unit: 'kg' });
  });

  // Silently reading `1.73 stones` as kg charts a number nobody stated.
  it('returns undefined for an unrecognised unit rather than defaulting', () => {
    expect(canonicalizeVitalUnit('vital-height', 5, 'furlongs')).toBeUndefined();
    expect(canonicalizeVitalUnit('vital-weight', 5, 'bananas')).toBeUndefined();
  });
});

describe('parseVitalDisplay', () => {
  it('reads compound imperial forms before the single-unit pattern (a bare `5 ft` must not win)', () => {
    expect(parseVitalDisplay('vital-height', `5'8"`)).toEqual({ status: 'ok', value: 68, unit: 'in' });
    expect(parseVitalDisplay('vital-height', '5 ft 8 in')).toEqual({ status: 'ok', value: 68, unit: 'in' });
    expect(parseVitalDisplay('vital-height', '5 feet 8 inches')).toEqual({ status: 'ok', value: 68, unit: 'in' });
    expect(parseVitalDisplay('vital-weight', '9 lb 4 oz')).toEqual({ status: 'ok', value: 9.25, unit: 'lb' });
  });

  it('still reads a bare feet value', () => {
    expect(parseVitalDisplay('vital-height', '5 ft')).toEqual({ status: 'ok', value: 60, unit: 'in' });
  });

  it('splits a blood pressure into both numbers', () => {
    expect(parseVitalDisplay('vital-blood-pressure', '122/78')).toEqual({
      status: 'ok-bp',
      systolic: 122,
      diastolic: 78,
    });
    expect(parseVitalDisplay('vital-blood-pressure', '122 over 78')).toEqual({
      status: 'ok-bp',
      systolic: 122,
      diastolic: 78,
    });
  });

  it('reads temperature with either scale', () => {
    expect(parseVitalDisplay('vital-temperature', '100.4 F')).toEqual({ status: 'ok', value: 100.4, unit: 'F' });
    expect(parseVitalDisplay('vital-temperature', '38 C')).toEqual({ status: 'ok', value: 38, unit: 'C' });
    expect(parseVitalDisplay('vital-temperature', '100.4 degrees Fahrenheit')).toEqual({
      status: 'ok',
      value: 100.4,
      unit: 'F',
    });
  });

  it('flags a unitless temperature it had to read from the magnitude', () => {
    const parsed = parseVitalDisplay('vital-temperature', '98.9');
    expect(parsed.status).toBe('ok');
    if (parsed.status !== 'ok') throw new Error('unreachable');
    expect(parsed.unit).toBe('F');
    expect(parsed.caution).toMatch(/no unit was stated/);
  });

  it('reads the fixed-unit vitals from a bare number', () => {
    expect(parseVitalDisplay('vital-heartbeat', '76')).toEqual({ status: 'ok', value: 76 });
    expect(parseVitalDisplay('vital-respiration-rate', '16')).toEqual({ status: 'ok', value: 16 });
    expect(parseVitalDisplay('vital-oxygen-sat', '98%')).toEqual({ status: 'ok', value: 98 });
    expect(parseVitalDisplay('vital-oxygen-sat', '95 percent on room air')).toEqual({ status: 'ok', value: 95 });
  });

  // Never guess in a medical record: a bare height or weight is genuinely ambiguous, so ask.
  it('asks rather than defaulting when a height or weight has no unit', () => {
    expect(parseVitalDisplay('vital-height', '68')).toMatchObject({ status: 'missing-unit', value: 68 });
    expect(parseVitalDisplay('vital-weight', '130')).toMatchObject({ status: 'missing-unit', value: 130 });
  });

  it('reports an unrecognised unit instead of falling back to the default', () => {
    expect(parseVitalDisplay('vital-height', '5 furlongs')).toMatchObject({
      status: 'unrecognized-unit',
      writtenUnit: 'furlongs',
    });
  });

  it('reports an empty display rather than charting nothing silently', () => {
    expect(parseVitalDisplay('vital-height', '')).toMatchObject({ status: 'no-value' });
  });

  // `5.8 inches` is decimal feet written as inches — 15 cm. Charting it is wrong; silently reading it
  // as 5'8" charts a number the provider never wrote. Do NEITHER: drop, flag, and ask.
  it('refuses an implausible height instead of charting or reinterpreting it', () => {
    const parsed = parseVitalDisplay('vital-height', '5.8 inches');
    expect(parsed.status).toBe('implausible');
    if (parsed.status !== 'implausible') throw new Error('unreachable');
    expect(parsed.value).toBe(5.8);
    expect(parsed.reason).toMatch(/live-birth/);
  });

  it('lets a paediatric height through', () => {
    expect(parseVitalDisplay('vital-height', '34 in')).toEqual({ status: 'ok', value: 34, unit: 'in' });
    expect(parseVitalDisplay('vital-height', '86 cm')).toEqual({ status: 'ok', value: 86, unit: 'cm' });
  });

  it('refuses a physiologically impossible temperature or rate', () => {
    expect(parseVitalDisplay('vital-temperature', '212 F')).toMatchObject({ status: 'implausible' });
    expect(parseVitalDisplay('vital-heartbeat', '900')).toMatchObject({ status: 'implausible' });
  });
});

describe('isImplausibleHeight', () => {
  it('uses the documented thresholds', () => {
    expect(isImplausibleHeight(MIN_PLAUSIBLE_HEIGHT_IN, 'in')).toBe(false);
    expect(isImplausibleHeight(MIN_PLAUSIBLE_HEIGHT_IN - 0.1, 'in')).toBe(true);
    expect(isImplausibleHeight(MIN_PLAUSIBLE_HEIGHT_CM, 'cm')).toBe(false);
    expect(isImplausibleHeight(MIN_PLAUSIBLE_HEIGHT_CM - 0.1, 'cm')).toBe(true);
  });

  it('rejects zero, negative and non-finite values', () => {
    expect(isImplausibleHeight(0, 'cm')).toBe(true);
    expect(isImplausibleHeight(-5, 'cm')).toBe(true);
    expect(isImplausibleHeight(NaN, 'cm')).toBe(true);
  });
});

describe('recoverVitalReading', () => {
  // The first implementation had this fallback only for blood pressure, so `add height 5.8 inches`
  // answered "I need a value for that vital" while the number sat in the message.
  it('recovers a reading the model dropped, for every vital', () => {
    expect(recoverVitalReading('vital-height', 'add height 5.8 inches')).toBe('5.8 inches');
    expect(recoverVitalReading('vital-height', 'patient is 5\'8" tall')).toBe(`5'8"`);
    expect(recoverVitalReading('vital-weight', 'she weighs 80 kg')).toBe('80 kg');
    expect(recoverVitalReading('vital-weight', 'weighs 130lb')).toBe('130lb');
    expect(recoverVitalReading('vital-temperature', 'temp was one hundred, no — 100.4 F')).toBe('100.4 F');
    expect(recoverVitalReading('vital-heartbeat', 'heart rate 88')).toBe('88');
    expect(recoverVitalReading('vital-respiration-rate', 'RR 18')).toBe('18');
    expect(recoverVitalReading('vital-oxygen-sat', 'sat 96% on room air')).toBe('96%');
    expect(recoverVitalReading('vital-blood-pressure', 'BP was 122/78 on arrival')).toBe('122/78');
  });

  // Recovery is anchored on the unit keyword or the vital's own keyword, so a duration is never read
  // as a measurement.
  it('does not read a bare number out of unrelated prose', () => {
    expect(recoverVitalReading('vital-heartbeat', 'cough for 5 days')).toBeUndefined();
    expect(recoverVitalReading('vital-weight', 'cough for 5 days')).toBeUndefined();
    expect(recoverVitalReading('vital-height', 'sick for 3 days')).toBeUndefined();
    expect(recoverVitalReading('vital-respiration-rate', 'seen 2 times this month')).toBeUndefined();
  });
});

describe('countVitalReadings', () => {
  // The regression that motivates one endpoint returning 1..N actions: this message is 30 characters
  // and one sentence, so a length heuristic routed it to a single-action endpoint and one of the two
  // vitals was silently dropped.
  it('sees both readings in `patient is 5\'8", weighs 130lb`', () => {
    expect(countVitalReadings(`patient is 5'8", weighs 130lb`)).toBe(2);
  });
});
