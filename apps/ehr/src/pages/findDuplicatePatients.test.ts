/**
 * @vitest-environment node
 */

import { Patient } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { filterDuplicatePatients } from './findDuplicatePatients';

const patient = (id: string, given: string, family: string, active?: boolean): Patient => ({
  resourceType: 'Patient',
  id,
  active,
  name: [{ use: 'official', given: [given], family }],
});

describe('filterDuplicatePatients', () => {
  it('matches names ignoring case and whitespace', () => {
    const result = filterDuplicatePatients([patient('1', 'Jane', 'Doe')], ' jane ', 'DOE');
    expect(result.map((p) => p.id)).toEqual(['1']);
  });

  it('drops prefix-only matches', () => {
    expect(
      filterDuplicatePatients([patient('1', 'Janet', 'Doe'), patient('2', 'Jane', 'Doetts')], 'Jane', 'Doe')
    ).toEqual([]);
  });

  it('ignores inactive patients', () => {
    expect(filterDuplicatePatients([patient('1', 'Jane', 'Doe', false)], 'Jane', 'Doe')).toEqual([]);
  });

  it('returns nothing without a name', () => {
    expect(filterDuplicatePatients([patient('1', 'Jane', 'Doe')], '', 'Doe')).toEqual([]);
  });
});
