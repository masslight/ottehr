import { Condition } from 'fhir/r4b';
import { ACCIDENT_STATE_EXTENSION, ACCIDENT_TYPE_SYSTEM } from 'utils/lib/fhir/constants';
import { describe, expect, test } from 'vitest';
import { createAccidentCondition, makeAccidentDTOFromFhirResources } from '../../src/shared/chart-data';

const accidentCondition = (overrides: Partial<Condition>): Condition => ({
  resourceType: 'Condition',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  meta: { tag: [{ code: 'accident' }] },
  ...overrides,
});

describe('makeAccidentDTOFromFhirResources', () => {
  test('reads type, date and state off the accident Condition', () => {
    const dto = makeAccidentDTOFromFhirResources([
      accidentCondition({
        id: 'accident-1',
        onsetDateTime: '2000-12-12',
        code: { coding: [{ system: ACCIDENT_TYPE_SYSTEM, code: 'EM' }] },
        extension: [{ url: ACCIDENT_STATE_EXTENSION, valueString: 'AR' }],
      }),
    ]);

    expect(dto).toEqual({ resourceId: 'accident-1', type: ['EM'], date: '2000-12-12', state: 'AR' });
  });

  test('uses the most recently written Condition when an encounter has duplicates', () => {
    const dto = makeAccidentDTOFromFhirResources([
      accidentCondition({
        id: 'accident-old',
        meta: { tag: [{ code: 'accident' }], lastUpdated: '2026-09-22T10:00:00.000Z' },
        code: { coding: [{ system: ACCIDENT_TYPE_SYSTEM, code: 'EM' }] },
      }),
      accidentCondition({
        id: 'accident-new',
        meta: { tag: [{ code: 'accident' }], lastUpdated: '2026-09-22T10:05:00.000Z' },
        onsetDateTime: '2000-12-12',
        code: { coding: [{ system: ACCIDENT_TYPE_SYSTEM, code: 'EM' }] },
        extension: [{ url: ACCIDENT_STATE_EXTENSION, valueString: 'AR' }],
      }),
    ]);

    expect(dto).toEqual({ resourceId: 'accident-new', type: ['EM'], date: '2000-12-12', state: 'AR' });
  });

  test('returns undefined when the encounter has no accident Condition', () => {
    expect(makeAccidentDTOFromFhirResources([])).toBeUndefined();
  });
});

describe('createAccidentCondition', () => {
  test('updates the existing Condition when a resource id is known', () => {
    const request = createAccidentCondition(
      { resourceId: 'accident-1', type: ['AA'], date: '2000-12-12', state: 'AR' },
      'enc-1',
      'pat-1'
    );

    expect(request.method).toBe('PUT');
    expect(request.url).toBe('/Condition/accident-1');
  });

  test('creates a Condition when no resource id is known', () => {
    const request = createAccidentCondition({ type: ['AA'], date: '2000-12-12' }, 'enc-1', 'pat-1');

    expect(request.method).toBe('POST');
  });
});
