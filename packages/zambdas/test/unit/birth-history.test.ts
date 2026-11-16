import Oystehr from '@oystehr/sdk';
import { Observation } from 'fhir/r4b';
import {
  formatBirthHistoryNoteLines,
  formatBirthHistorySummary,
  formatGestationalAge,
} from 'utils/lib/helpers/vitals/birth-history.helper';
import {
  BIRTH_HISTORY_CODE,
  BIRTH_HISTORY_META_SYSTEM,
  BirthHistory,
  BirthHistorySchema,
} from 'utils/lib/types/api/birth-history.types';
import { describe, expect, test, vi } from 'vitest';
import {
  fetchBirthHistoryObservation,
  makeBirthHistoryDTO,
  makeBirthHistoryObservation,
  saveBirthHistoryObservation,
} from '../../src/shared/birth-history';
import { fillMeta } from '../../src/shared/helpers';

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

describe('saving a birth history', () => {
  const fhir = (): {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  } => ({
    create: vi.fn(async (o: Observation) => ({ ...o, id: 'obs-new' })),
    update: vi.fn(async (o: Observation) => o),
    delete: vi.fn(async () => undefined),
  });
  const existing: Observation = { ...makeBirthHistoryObservation('p1', full), id: 'obs-1' };

  test('every field emptied over a saved one deletes it, so the patient reads as never having one', async () => {
    const calls = fhir();
    const saved = await saveBirthHistoryObservation({ fhir: calls } as unknown as Oystehr, 'p1', {}, existing);
    expect(saved).toBeUndefined();
    expect(calls.delete).toHaveBeenCalledWith({ resourceType: 'Observation', id: 'obs-1' });
    expect(calls.update).not.toHaveBeenCalled();
    expect(calls.create).not.toHaveBeenCalled();
  });

  test('an empty one with nothing saved saves nothing; a value updates the saved one or creates it', async () => {
    const calls = fhir();
    const oystehr = { fhir: calls } as unknown as Oystehr;
    expect(await saveBirthHistoryObservation(oystehr, 'p1', {})).toBeUndefined();
    expect(calls.create).not.toHaveBeenCalled();
    expect((await saveBirthHistoryObservation(oystehr, 'p1', { gestationalAgeWeeks: 38 }, existing))?.id).toBe('obs-1');
    expect((await saveBirthHistoryObservation(oystehr, 'p1', { gestationalAgeWeeks: 38 }))?.id).toBe('obs-new');
    expect(calls.delete).not.toHaveBeenCalled();
  });
});

describe('an older per-visit birth history Observation', () => {
  // develop's save-chart-data wrote one Observation per field and visit (makeBirthHistoryObservationResource), tagged
  // getMetaWFieldName('birth-history') = fillMeta('birth-history', 'birth-history'): the patient-level record's tag.
  const legacy: Observation = {
    resourceType: 'Observation',
    id: 'legacy-1',
    meta: { ...fillMeta('birth-history', 'birth-history'), lastUpdated: '2026-11-01T00:00:00.000Z' },
    subject: { reference: 'Patient/p1' },
    encounter: { reference: 'Encounter/e1' },
    status: 'final',
    code: { coding: [{ system: 'http://loinc.org', code: '76516-4', display: 'Gestational age--at birth' }] },
    valueQuantity: { value: 38, system: 'http://unitsofmeasure.org', code: 'wk' },
  };
  const patientLevel: Observation = {
    ...makeBirthHistoryObservation('p1', full),
    id: 'obs-1',
    meta: { ...makeBirthHistoryObservation('p1', full).meta, lastUpdated: '2026-10-01T00:00:00.000Z' },
  };
  // A FHIR server holding `stored`: it applies the search's tag, status, encounter:missing, sort and count.
  const server = (
    stored: Observation[]
  ): { oystehr: Oystehr; deleted: ReturnType<typeof vi.fn>; updated: ReturnType<typeof vi.fn> } => {
    const deleted = vi.fn(async () => undefined);
    const updated = vi.fn(async (o: Observation) => o);
    const search = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
      const param = (name: string): string | undefined => params.find((p) => p.name === name)?.value;
      const [system, code] = (param('_tag') ?? '').split('|');
      const found = stored
        .filter((o) => o.meta?.tag?.some((t) => t.system === system && t.code === code))
        .filter((o) => !(param('status:not') ?? '').split(',').includes(o.status))
        .filter((o) => param('encounter:missing') !== 'true' || !o.encounter)
        .sort((a, b) => (b.meta?.lastUpdated ?? '').localeCompare(a.meta?.lastUpdated ?? ''))
        .slice(0, Number(param('_count') ?? stored.length));
      return { unbundle: () => found };
    });
    return { oystehr: { fhir: { search, delete: deleted, update: updated } } as unknown as Oystehr, deleted, updated };
  };

  test('carries the patient-level record’s tag', () => {
    expect(legacy.meta?.tag).toEqual([{ system: BIRTH_HISTORY_META_SYSTEM, code: BIRTH_HISTORY_CODE }]);
  });

  test('is never read as the patient’s birth history, alone or newer than the patient-level one', async () => {
    expect(await fetchBirthHistoryObservation(server([legacy]).oystehr, 'p1')).toBeUndefined();
    expect((await fetchBirthHistoryObservation(server([legacy, patientLevel]).oystehr, 'p1'))?.id).toBe('obs-1');
  });

  test('is never overwritten by a save nor deleted by a clear', async () => {
    const { oystehr, deleted, updated } = server([legacy]);
    const existing = await fetchBirthHistoryObservation(oystehr, 'p1');
    await saveBirthHistoryObservation(oystehr, 'p1', {}, existing);
    expect(deleted).not.toHaveBeenCalled();
    const cleared = server([legacy, patientLevel]);
    await saveBirthHistoryObservation(
      cleared.oystehr,
      'p1',
      { gestationalAgeWeeks: 39 },
      await fetchBirthHistoryObservation(cleared.oystehr, 'p1')
    );
    expect(cleared.updated.mock.calls.map(([o]) => o.id)).toEqual(['obs-1']);
    expect(updated).not.toHaveBeenCalled();
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
    expect(formatBirthHistorySummary({ gestationalAgeWeeks: 40, birthWeightKg: 3.5 })).toBe('40 wk · 3.5 kg');
    expect(formatBirthHistorySummary({})).toBe('');
    expect(formatGestationalAge(undefined, 3)).toBeUndefined();
    expect(formatGestationalAge(39, 0)).toBe('39 wk');
  });
});
