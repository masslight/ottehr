import { describe, expect, it } from 'vitest';
import {
  canonicalizeVitalUnit,
  isImplausibleHeight,
  MIN_PLAUSIBLE_HEIGHT_CM,
  MIN_PLAUSIBLE_HEIGHT_IN,
  parseVitalDisplay,
  recoverVitalReading,
  unitNotSaid,
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

  it('rounds to 2dp so a conversion never surfaces as float noise', () => {
    expect(canonicalizeVitalUnit('vital-weight', 5, 'stones')).toEqual({ value: 70, unit: 'lb' });
  });

  // `\blb\b` fails on `130lb` (no word boundary between a digit and a letter).
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

  // A bare height could be cm or inches, and a bare weight kg or pounds.
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

  // "5.8 inches" is decimal feet written as inches; reading it as 5'8" would chart a number nobody wrote.
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

describe('head circumference', () => {
  it('converts cm, mm and inches, and nothing larger', () => {
    expect(canonicalizeVitalUnit('vital-head-circumference', 438, 'mm')).toEqual({ value: 43.8, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-head-circumference', 43.8, 'cm')).toEqual({ value: 43.8, unit: 'cm' });
    expect(canonicalizeVitalUnit('vital-head-circumference', 17.2, 'inches')).toEqual({ value: 17.2, unit: 'in' });
    expect(canonicalizeVitalUnit('vital-head-circumference', 17.2, '"')).toEqual({ value: 17.2, unit: 'in' });
    expect(canonicalizeVitalUnit('vital-head-circumference', 0.44, 'm')).toBeUndefined();
    expect(canonicalizeVitalUnit('vital-head-circumference', 1, 'ft')).toBeUndefined();
  });

  it('charts a reading with its unit', () => {
    expect(parseVitalDisplay('vital-head-circumference', '43.8 cm')).toEqual({ status: 'ok', value: 43.8, unit: 'cm' });
    expect(parseVitalDisplay('vital-head-circumference', '438 mm')).toEqual({ status: 'ok', value: 43.8, unit: 'cm' });
    expect(parseVitalDisplay('vital-head-circumference', '17.24 in')).toEqual({
      status: 'ok',
      value: 17.24,
      unit: 'in',
    });
  });

  it('lets a newborn head circumference through, well under the live-birth length floor', () => {
    expect(parseVitalDisplay('vital-head-circumference', '33 cm')).toEqual({ status: 'ok', value: 33, unit: 'cm' });
  });

  it('asks rather than charting a reading with no unit', () => {
    expect(parseVitalDisplay('vital-head-circumference', '43.8')).toMatchObject({
      status: 'missing-unit',
      value: 43.8,
    });
  });

  it('asks about a unit it does not convert', () => {
    expect(parseVitalDisplay('vital-head-circumference', '0.44 m')).toMatchObject({
      status: 'unrecognized-unit',
      writtenUnit: 'm',
    });
  });

  it('asks about a reading no head could measure, almost always a mis-stated unit', () => {
    expect(parseVitalDisplay('vital-head-circumference', '0 cm')).toMatchObject({ status: 'implausible' });
    expect(parseVitalDisplay('vital-head-circumference', '45 in')).toMatchObject({ status: 'implausible' });
    expect(parseVitalDisplay('vital-head-circumference', '4.38 cm')).toMatchObject({ status: 'implausible' });
    expect(parseVitalDisplay('vital-head-circumference', '13 in')).toEqual({ status: 'ok', value: 13, unit: 'in' });
    expect(parseVitalDisplay('vital-head-circumference', '58 cm')).toEqual({ status: 'ok', value: 58, unit: 'cm' });
  });

  it('does not take a length that merely follows a head circumference keyword', () => {
    expect(recoverVitalReading('vital-head-circumference', 'OFC nl; length 68 cm')).toBeUndefined();
    expect(recoverVitalReading('vital-height', 'OFC nl; length 68 cm')).toBe('68 cm');
    expect(recoverVitalReading('vital-head-circumference', 'HC: 43.8 cm')).toBe('43.8 cm');
    expect(recoverVitalReading('vital-head-circumference', 'head circumference was 17.2 in')).toBe('17.2 in');
    expect(recoverVitalReading('vital-head-circumference', 'head circumference at 44.5 cm')).toBe('44.5 cm');
    expect(recoverVitalReading('vital-head-circumference', 'OFC approx. 44 cm')).toBe('44 cm');
    expect(recoverVitalReading('vital-height', 'head circumference at 45 cm')).toBeUndefined();
  });

  it('never recovers the other-unit value written next to a head circumference as a dropped height', () => {
    expect(recoverVitalReading('vital-height', 'OFC 52 cm ≈ 20.47 in')).toBeUndefined();
    expect(recoverVitalReading('vital-height', 'Head circumference 52 cm (20.47 in)')).toBeUndefined();
    expect(recoverVitalReading('vital-height', 'OFC 52 cm ≈ 20.47 in, length 88 cm')).toBe('88 cm');
    expect(recoverVitalReading('vital-height', 'HC 20.5 in / 52 cm. Length 34 in')).toBe('34 in');
  });

  it('never recovers a head circumference as a dropped height', () => {
    expect(recoverVitalReading('vital-height', 'OFC 52 cm, length 88 cm')).toBe('88 cm');
    expect(recoverVitalReading('vital-height', 'head circumference 45 cm')).toBeUndefined();
  });

  it('recovers a dropped reading named as head circumference, OFC or HC', () => {
    expect(recoverVitalReading('vital-head-circumference', 'head circumference today 43.8 cm')).toBe('43.8 cm');
    expect(recoverVitalReading('vital-head-circumference', 'OFC 438 mm, tracking well')).toBe('438 mm');
    expect(recoverVitalReading('vital-head-circumference', 'HC 17.2 in')).toBe('17.2 in');
  });

  it('does not take a length that is not named as a head circumference', () => {
    expect(recoverVitalReading('vital-head-circumference', 'length 68 cm, laceration 2 cm')).toBeUndefined();
    expect(recoverVitalReading('vital-head-circumference', 'apply HC 2.5% cream twice daily')).toBeUndefined();
    expect(recoverVitalReading('vital-head-circumference', 'head circumference 43.8')).toBeUndefined();
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

describe('unitNotSaid', () => {
  it('flags a unit the narrative never gave after the number', () => {
    expect(
      unitNotSaid('vital-head-circumference', '44 cm', ['Head circumference 44 today. Weight 8.9 kg.'])
    ).toMatchObject({ status: 'missing-unit', value: 44, reason: expect.stringMatching(/centimetres or inches/) });
    expect(unitNotSaid('vital-height', '68 cm', ['Height 68 today.'])).toMatchObject({ status: 'missing-unit' });
    expect(unitNotSaid('vital-weight', '20 lb', ['weight 20, OFC 44 cm'])).toMatchObject({ status: 'missing-unit' });
  });

  it('accepts a reading whose unit was said, however it was written', () => {
    expect(unitNotSaid('vital-head-circumference', '441 mm', ['OFC 441 mm today'])).toBeUndefined();
    expect(unitNotSaid('vital-head-circumference', '44 cm', ['HC 44-cm'])).toBeUndefined();
    expect(unitNotSaid('vital-height', `5'8"`, [`patient is 5'8", weighs 130lb`])).toBeUndefined();
    expect(unitNotSaid('vital-height', '1.73 m', ['patient is 1.73m'])).toBeUndefined();
    expect(unitNotSaid('vital-weight', '130lb', [`patient is 5'8", weighs 130lb`])).toBeUndefined();
    expect(unitNotSaid('vital-weight', '9 lb 4 oz', ['weighs 9 lb 4 oz'])).toBeUndefined();
    expect(unitNotSaid('vital-weight', '130 lb', ['Weight: 130 (lbs)'])).toBeUndefined();
  });

  it('judges each number on its own, not by another vital that shares it', () => {
    const narrative = 'weighs 44 lb, head circumference 44';
    expect(unitNotSaid('vital-weight', '44 lb', [narrative])).toBeUndefined();
    expect(unitNotSaid('vital-head-circumference', '44 cm', [narrative])).toMatchObject({ status: 'missing-unit' });
  });

  it('does not read a longer number as the reading', () => {
    expect(unitNotSaid('vital-head-circumference', '44 cm', ['HC 44.5 cm, 144 days old'])).toBeUndefined();
  });

  it('leaves the reading alone when its number is not in the narrative at all', () => {
    expect(unitNotSaid('vital-head-circumference', '44 cm', ['head circumference forty four'])).toBeUndefined();
    expect(unitNotSaid('vital-head-circumference', '44 cm', [undefined])).toBeUndefined();
  });

  it('takes the unit from any of the narratives', () => {
    expect(unitNotSaid('vital-head-circumference', '44 cm', ['HC 44', 'HC 44 cm'])).toBeUndefined();
  });

  it('does not judge vitals whose unit is fixed', () => {
    expect(unitNotSaid('vital-heartbeat', '88 bpm', ['pulse 88'])).toBeUndefined();
    expect(unitNotSaid('vital-temperature', '38.2 C', ['temp 38.2'])).toBeUndefined();
  });
});
