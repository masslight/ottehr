import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/search-patients';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  name: [{ given: ['Example'], family: 'Patient' }],
  birthDate: '1990-01-01',
  gender: 'female',
  telecom: [
    { system: 'phone', value: '+15555555555' },
    { system: 'email', value: 'example@masslight.com' },
  ],
};

describe('search-patients performEffect', () => {
  it('builds FHIR search params for each provided filter', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
    await performEffect(
      {
        name: 'Example Patient',
        dateOfBirth: '1990-01-01',
        phone: '+15555555555',
        email: 'example@masslight.com',
        secrets: null,
      },
      { fhir: { search } } as any
    );

    const params = search.mock.calls[0][0].params;
    expect(search.mock.calls[0][0].resourceType).toBe('Patient');
    expect(params).toContainEqual({ name: 'name', value: 'Example Patient' });
    expect(params).toContainEqual({ name: 'birthdate', value: '1990-01-01' });
    expect(params).toContainEqual({ name: 'phone', value: '+15555555555' });
    expect(params).toContainEqual({ name: 'email', value: 'example@masslight.com' });
  });

  it('omits filter params that were not provided', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
    await performEffect({ name: 'Example Patient', secrets: null }, { fhir: { search } } as any);

    const params = search.mock.calls[0][0].params;
    expect(params.some((p: any) => p.name === 'birthdate')).toBe(false);
    expect(params.some((p: any) => p.name === 'phone')).toBe(false);
    expect(params.some((p: any) => p.name === 'email')).toBe(false);
  });

  it('defaults offset to 0 and applies the fixed page size', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
    const result = await performEffect({ secrets: null }, { fhir: { search } } as any);

    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: '_offset', value: 0 });
    expect(result.offset).toBe(0);
  });

  it('forwards a supplied offset', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [], total: 0 });
    const result = await performEffect({ offset: 45, secrets: null }, { fhir: { search } } as any);

    const params = search.mock.calls[0][0].params;
    expect(params).toContainEqual({ name: '_offset', value: 45 });
    expect(result.offset).toBe(45);
  });

  it('maps FHIR Patient resources to the result shape', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [patient], total: 1 });
    const result = await performEffect({ name: 'Example Patient', secrets: null }, { fhir: { search } } as any);

    expect(result.total).toBe(1);
    expect(result.patients).toHaveLength(1);
    expect(result.patients[0]).toMatchObject({
      id: 'patient-1',
      firstName: 'Example',
      lastName: 'Patient',
      dateOfBirth: '1990-01-01',
      gender: 'female',
      phone: '+15555555555',
      email: 'example@masslight.com',
    });
  });

  it('defaults total to 0 when the bundle does not report one', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [] });
    const result = await performEffect({ name: 'Example Patient', secrets: null }, { fhir: { search } } as any);

    expect(result.total).toBe(0);
    expect(result.patients).toEqual([]);
  });
});
