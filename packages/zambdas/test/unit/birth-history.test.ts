import { Observation } from 'fhir/r4b';
import {
  formatBirthHistoryNoteLines,
  formatBirthHistorySummary,
  formatGestationalAge,
} from 'utils/lib/helpers/vitals/birth-history.helper';
import { BIRTH_HISTORY_META_SYSTEM, BirthHistory, BirthHistorySchema } from 'utils/lib/types/api/birth-history.types';
import { describe, expect, test } from 'vitest';
import { makeBirthHistoryDTO, makeBirthHistoryObservation } from '../../src/shared/birth-history';

const full: BirthHistory = {
  timeOfBirth: '03:42',
  gestationalAgeWeeks: 34,
  gestationalAgeDays: 5,
  birthWeightKg: 2.41,
  birthLengthCm: 46,
  birthHeadCircumferenceCm: 32,
};

describe('birth history storage (one patient-level Observation per patient)', () => {
  test('saves every field as a component on a patient-level, tagged Observation and reads it back', () => {
    const observation = makeBirthHistoryObservation('p1', full);
    expect(observation.subject).toEqual({ reference: 'Patient/p1' });
    expect(observation.encounter).toBeUndefined();
    expect(observation.meta?.tag).toEqual([{ system: BIRTH_HISTORY_META_SYSTEM, code: 'birth-history' }]);
    // Gestational age is one quantity in days; time of birth is a FHIR time.
    expect(observation.component?.map((c) => [c.code.coding?.[0]?.code, c.valueQuantity?.value, c.valueTime])).toEqual([
      ['time-of-birth', undefined, '03:42:00'],
      ['gestational-age', 243, undefined],
      ['birth-weight', 2.41, undefined],
      ['birth-length', 46, undefined],
      ['birth-head-circumference', 32, undefined],
    ]);
    expect(makeBirthHistoryDTO({ ...observation, id: 'obs-1' })).toEqual({ resourceId: 'obs-1', ...full });
  });

  test('a partial history keeps only its fields; a whole-week gestational age reads back with 0 days', () => {
    const partial: BirthHistory = { gestationalAgeWeeks: 38, birthWeightKg: 3.3 };
    const dto = makeBirthHistoryDTO(makeBirthHistoryObservation('p1', partial));
    expect(dto).toEqual({ resourceId: undefined, gestationalAgeWeeks: 38, gestationalAgeDays: 0, birthWeightKg: 3.3 });
  });

  test('a save over an existing record keeps its id, so the patient never gets a second record', () => {
    const existing: Observation = { resourceType: 'Observation', id: 'obs-1', status: 'final', code: {} };
    expect(makeBirthHistoryObservation('p1', full, existing).id).toBe('obs-1');
    expect(makeBirthHistoryObservation('p1', full).id).toBeUndefined();
  });

  test('the input schema takes 24-hour times and whole weeks/days, and days only with weeks', () => {
    expect(BirthHistorySchema.safeParse(full).success).toBe(true);
    expect(BirthHistorySchema.safeParse({}).success).toBe(true);
    expect(BirthHistorySchema.safeParse({ timeOfBirth: '3:42 AM' }).success).toBe(false);
    expect(BirthHistorySchema.safeParse({ gestationalAgeWeeks: 34.5 }).success).toBe(false);
    expect(BirthHistorySchema.safeParse({ gestationalAgeDays: 3 }).success).toBe(false);
    expect(BirthHistorySchema.safeParse({ gestationalAgeWeeks: 34, gestationalAgeDays: 7 }).success).toBe(false);
  });
});

describe('birth history display', () => {
  test('the collapsed card summary and the visit note lines (both units, like the vitals)', () => {
    expect(formatBirthHistorySummary(full)).toBe('34 wk 5 d · born 03:42 AM · 2.41 kg · 46.0 cm · HC 32.0 cm');
    expect(formatBirthHistoryNoteLines(full)).toEqual([
      'Time of birth: 03:42 AM',
      'Gestational age: 34 wk 5 d',
      'Birth weight: 2.41 kg ≈ 5.31 lbs',
      'Birth length: 46 cm ≈ 18.11 in',
      'Birth head circumference: 32 cm ≈ 12.6 in',
    ]);
  });

  test('missing fields leave no gaps', () => {
    expect(formatBirthHistorySummary({ gestationalAgeWeeks: 40, birthWeightKg: 3.5 })).toBe('40 wk · 3.50 kg');
    expect(formatBirthHistorySummary({})).toBe('');
    expect(formatGestationalAge(undefined, 3)).toBeUndefined();
    expect(formatGestationalAge(39, 0)).toBe('39 wk');
  });
});
