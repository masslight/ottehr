/**
 * @vitest-environment node
 */

import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { CheckDuplicatePatientsInputSchema, performEffect } from '../../src/ehr/check-duplicate-patients';
import { filterDuplicatePatients } from '../../src/ehr/check-duplicate-patients/helpers';

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

const pagedOystehr = (all: Patient[]): { oystehr: any; search: ReturnType<typeof vi.fn> } => {
  const search = vi.fn().mockImplementation(async ({ params }: { params: { name: string; value: string }[] }) => {
    const get = (name: string): number => Number(params.find((p) => p.name === name)?.value ?? 0);
    const page = all.slice(get('_offset'), get('_offset') + get('_count'));
    return {
      total: all.length,
      entry: page.map((resource) => ({ search: { mode: 'match' }, resource })),
      unbundle: () => page,
    };
  });
  return { oystehr: { fhir: { search } }, search };
};

describe('check-duplicate-patients performEffect', () => {
  const input = { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '2015-04-12', secrets: null } as any;

  it('finds an exact duplicate that sits beyond the first page of prefix matches', async () => {
    const prefixMatches = Array.from({ length: 1001 }, (_, i) => patient(`janet-${i}`, 'Janet', 'Doe'));
    const { oystehr, search } = pagedOystehr([...prefixMatches, patient('exact', 'Jane', 'Doe')]);

    const { candidates } = await performEffect(input, oystehr);

    expect(candidates.map((c) => c.patientId)).toEqual(['exact']);
    expect(search.mock.calls.length).toBeGreaterThan(1);
  });

  it('returns no candidates when nobody matches exactly', async () => {
    const { oystehr } = pagedOystehr([patient('1', 'Janet', 'Doe')]);
    expect((await performEffect(input, oystehr)).candidates).toEqual([]);
  });

  it('reports a failed account lookup per candidate instead of failing the check', async () => {
    const search = vi
      .fn()
      .mockResolvedValueOnce({
        total: 1,
        entry: [{ search: { mode: 'match' }, resource: patient('1', 'Jane', 'Doe') }],
        unbundle: () => [patient('1', 'Jane', 'Doe')],
      })
      .mockRejectedValueOnce(new Error('boom'));
    const { candidates } = await performEffect({ ...input, includeAccountPhone: true }, { fhir: { search } } as any);
    expect(candidates).toEqual([expect.objectContaining({ patientId: '1', phone: { status: 'error' } })]);
  });
});

describe('CheckDuplicatePatientsInputSchema', () => {
  const valid = { firstName: 'Jane', lastName: 'Doe', dateOfBirth: '2001-02-03' };

  it('accepts a full date of birth', () => {
    expect(CheckDuplicatePatientsInputSchema.safeParse(valid).success).toBe(true);
  });

  it.each(['2001', '2001-02', '2001-02-03T10:00:00Z', 'not-a-date'])(
    'rejects a partial or malformed date %s',
    (dob) => {
      expect(CheckDuplicatePatientsInputSchema.safeParse({ ...valid, dateOfBirth: dob }).success).toBe(false);
    }
  );
});
