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
});
