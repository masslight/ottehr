import { describe, expect, it } from 'vitest';
import { normalizeVitalIntent } from '../src/shared/easy-chart/vitals';

// The set-vital normalizer is the single source of truth for recovering numeric vitals from the
// model's loose `display` text — these cases lock in the unit-safety rules (a wrong temp unit or
// a pounds-as-kg weight is a charted clinical error, not a cosmetic one).
describe('normalizeVitalIntent', () => {
  const run = (i: Record<string, unknown>, context = ''): Record<string, unknown> => {
    normalizeVitalIntent(i, context);
    return i;
  };

  describe('temperature units', () => {
    it('does NOT treat a word merely ending in "c" as Celsius (the tympanic bug)', () => {
      expect(run({ field: 'vital-temperature', display: 'Temp 100.4 tympanic' })).toMatchObject({
        value: 100.4,
        unit: 'F',
      });
      expect(run({ field: 'vital-temperature', display: '102.2 F tympanic' })).toMatchObject({
        value: 102.2,
        unit: 'F',
      });
    });

    it('honors explicit Celsius markers', () => {
      expect(run({ field: 'vital-temperature', display: '38.5 C' })).toMatchObject({ value: 38.5, unit: 'C' });
      expect(run({ field: 'vital-temperature', display: 'Temp 38.5 celsius' })).toMatchObject({
        value: 38.5,
        unit: 'C',
      });
      expect(run({ field: 'vital-temperature', display: '100.4C' })).toMatchObject({ value: 100.4, unit: 'C' });
    });

    it('falls back to magnitude (human temps: <45 → C, else F)', () => {
      expect(run({ field: 'vital-temperature', display: 'temp 39' })).toMatchObject({ value: 39, unit: 'C' });
      expect(run({ field: 'vital-temperature', display: 'temp 101' })).toMatchObject({ value: 101, unit: 'F' });
    });
  });

  describe('weight units', () => {
    it('recovers lbs from display when the model omitted the unit', () => {
      expect(run({ field: 'vital-weight', display: '66 lbs' })).toMatchObject({ value: 66, unit: 'lb' });
      expect(run({ field: 'vital-weight', display: 'Weight 30 kg' })).toMatchObject({ value: 30, unit: 'kg' });
    });

    it('canonicalizes a spelled-out unit so the client conversion fires', () => {
      expect(run({ field: 'vital-weight', display: '66 pounds', unit: 'pounds' })).toMatchObject({
        value: 66,
        unit: 'lb',
      });
    });
  });

  describe('height units', () => {
    it('collapses feet+inches forms to total inches', () => {
      expect(run({ field: 'vital-height', display: `5'3"` })).toMatchObject({ value: 63, unit: 'in' });
      expect(run({ field: 'vital-height', display: '4 ft' })).toMatchObject({ value: 48, unit: 'in' });
    });

    it('recovers in/cm from display', () => {
      expect(run({ field: 'vital-height', display: '45 inches' })).toMatchObject({ value: 45, unit: 'in' });
      expect(run({ field: 'vital-height', display: '120 cm' })).toMatchObject({ value: 120, unit: 'cm' });
    });
  });

  describe('blood pressure', () => {
    it('recovers the pair from display', () => {
      expect(run({ field: 'vital-blood-pressure', display: 'BP 122/78' })).toMatchObject({
        systolic: 122,
        diastolic: 78,
      });
    });

    it('recovers the pair from surrounding context when display dropped it', () => {
      expect(run({ field: 'vital-blood-pressure', display: 'blood pressure' }, 'BP was 130 over 85')).toMatchObject({
        systolic: 130,
        diastolic: 85,
      });
    });
  });

  // Regression: "add height 5.8 inches" answered "I need a value for that vital, e.g. set temp to
  // 100.4 F". The model emitted set-vital with no display, and only blood pressure had a fallback to
  // the provider's own message — the other six vitals silently had nothing to parse.
  describe('recovering a reading from the message when the model gave no display', () => {
    it('reads a height in inches', () => {
      expect(run({ field: 'vital-height' }, 'add height 68 inches')).toMatchObject({ value: 68, unit: 'in' });
    });

    it('reads a height in cm', () => {
      expect(run({ field: 'vital-height' }, 'patient is 173 cm')).toMatchObject({ value: 173, unit: 'cm' });
    });

    it('reads a feet+inches height as total inches', () => {
      expect(run({ field: 'vital-height' }, `patient is 5'8" tall`)).toMatchObject({ value: 68, unit: 'in' });
      expect(run({ field: 'vital-height' }, 'height 5 ft 8 in')).toMatchObject({ value: 68, unit: 'in' });
    });

    it('reads a weight in pounds and in kg', () => {
      expect(run({ field: 'vital-weight' }, 'weights 130lb')).toMatchObject({ value: 130, unit: 'lb' });
      expect(run({ field: 'vital-weight' }, 'weighs 59 kg')).toMatchObject({ value: 59, unit: 'kg' });
    });

    // The unit the provider thinks in must not be a constraint. Everything below converts to a unit
    // the CLIENT provably handles: heights leave as cm or in, weights as kg or lb. That matters
    // because the client reads any other height unit as centimetres — "1.73 m" passed through
    // untouched would chart a 1.73 cm patient.
    it('accepts any length unit, converting to one the client handles', () => {
      expect(run({ field: 'vital-height' }, 'patient is 1.73 m')).toMatchObject({ value: 173, unit: 'cm' });
      expect(run({ field: 'vital-height' }, 'height 1730 mm')).toMatchObject({ value: 173, unit: 'cm' });
      expect(run({ field: 'vital-height' }, 'height 6 feet')).toMatchObject({ value: 72, unit: 'in' });
      expect(run({ field: 'vital-height', display: '2 m' })).toMatchObject({ value: 200, unit: 'cm' });
    });

    it('accepts any mass unit, converting to one the client handles', () => {
      expect(run({ field: 'vital-weight' }, 'weighs 5 stones')).toMatchObject({ value: 70, unit: 'lb' });
      expect(run({ field: 'vital-weight' }, 'birth weight 9 lb 4 oz')).toMatchObject({ value: 9.25, unit: 'lb' });
      expect(run({ field: 'vital-weight' }, 'weighs 3400 grams')).toMatchObject({ value: 3.4, unit: 'kg' });
      expect(run({ field: 'vital-weight', display: '120 oz' })).toMatchObject({ value: 7.5, unit: 'lb' });
    });

    it('reports an unrecognized unit instead of assuming the default', () => {
      // 'furlongs' is nonsense, but the point is general: an unknown unit must never be silently read
      // as cm (height) or kg (weight), because that charts a number nobody stated.
      const out = run({ field: 'vital-height', value: 12, unit: 'furlongs' });
      expect(out.value).toBeUndefined();
      expect(out.unrecognizedUnit).toBe('furlongs');
    });

    // The unit the provider thinks in must not be a constraint. Everything below converts to a unit
    // the CLIENT provably handles: heights leave as cm or in, weights as kg or lb. That matters
    // because the client reads any other height unit as centimetres — "1.73 m" passed through
    // untouched would chart a 1.73 cm patient.
    it('accepts any length unit, converting to one the client handles', () => {
      expect(run({ field: 'vital-height' }, 'patient is 1.73 m')).toMatchObject({ value: 173, unit: 'cm' });
      expect(run({ field: 'vital-height' }, 'height 1730 mm')).toMatchObject({ value: 173, unit: 'cm' });
      expect(run({ field: 'vital-height' }, 'height 6 feet')).toMatchObject({ value: 72, unit: 'in' });
      expect(run({ field: 'vital-height', display: '2 m' })).toMatchObject({ value: 200, unit: 'cm' });
    });

    it('accepts any mass unit, converting to one the client handles', () => {
      expect(run({ field: 'vital-weight' }, 'weighs 5 stones')).toMatchObject({ value: 70, unit: 'lb' });
      expect(run({ field: 'vital-weight' }, 'birth weight 9 lb 4 oz')).toMatchObject({ value: 9.25, unit: 'lb' });
      expect(run({ field: 'vital-weight' }, 'weighs 3400 grams')).toMatchObject({ value: 3.4, unit: 'kg' });
      expect(run({ field: 'vital-weight', display: '120 oz' })).toMatchObject({ value: 7.5, unit: 'lb' });
    });

    it('reports an unrecognized unit instead of assuming the default', () => {
      // 'furlongs' is nonsense, but the point is general: an unknown unit must never be silently read
      // as cm (height) or kg (weight), because that charts a number nobody stated.
      const out = run({ field: 'vital-height', value: 12, unit: 'furlongs' });
      expect(out.value).toBeUndefined();
      expect(out.unrecognizedUnit).toBe('furlongs');
    });

    it('reads the unitless vitals from their own keyword', () => {
      expect(run({ field: 'vital-heartbeat' }, 'heart rate 88')).toMatchObject({ value: 88 });
      expect(run({ field: 'vital-oxygen-sat' }, 'O2 sat 97%')).toMatchObject({ value: 97 });
      expect(run({ field: 'vital-respiration-rate' }, 'respiratory rate 18')).toMatchObject({ value: 18 });
      expect(run({ field: 'vital-temperature' }, 'temp of 100.4')).toMatchObject({ value: 100.4, unit: 'F' });
    });

    it('does not mistake an unrelated number for a reading', () => {
      // No unit keyword for the field → nothing recovered, and the caller reports that honestly
      // rather than charting "5 days" as a height.
      expect(run({ field: 'vital-height' }, 'cough for 5 days').value).toBeUndefined();
      expect(run({ field: 'vital-weight' }, 'seen 3 times this year').value).toBeUndefined();
    });
  });

  // "5.8 inches" is decimal feet written as inches. Charting it would put a 15 cm patient in the
  // record; silently reading it as 5'8" would chart a number the provider never wrote.
  describe('implausible height', () => {
    it('drops the value and flags it instead of charting it', () => {
      const out = run({ field: 'vital-height' }, 'add height 5.8 inches');
      expect(out.value).toBeUndefined();
      expect(out.implausible).toBe('5.8 in');
    });

    it('drops an impossible cm height too', () => {
      const out = run({ field: 'vital-height', display: '17 cm' });
      expect(out.value).toBeUndefined();
      expect(out.implausible).toBe('17 cm');
    });

    it('keeps a short but real paediatric height', () => {
      expect(run({ field: 'vital-height', display: '34 inches' })).toMatchObject({ value: 34, unit: 'in' });
      expect(run({ field: 'vital-height', display: '86 cm' })).toMatchObject({ value: 86, unit: 'cm' });
    });
  });
});
