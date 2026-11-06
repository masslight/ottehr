import { Context } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { FRIENDLY_PATIENT_ID_SYSTEM_BASE } from 'utils/lib/fhir/constants';
import { PATIENT_SEARCH_TOO_BROAD_ERROR } from 'utils/lib/types/errors';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { performEffect, searchDeadline } from '../../src/ehr/search-patients';

const patient: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
  identifier: [{ system: FRIENDLY_PATIENT_ID_SYSTEM_BASE, value: '1234' }],
  name: [{ given: ['Example'], family: 'Patient' }],
  birthDate: '1990-01-01',
  gender: 'female',
  telecom: [
    { system: 'phone', value: '+15555555555' },
    { system: 'email', value: 'example@masslight.com' },
  ],
};

describe('search-patients performEffect', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

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
      patientFriendlyId: '1234',
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

  it('gives up with a narrow-your-search error when FHIR does not answer before the deadline', async () => {
    vi.useFakeTimers();
    const search = vi.fn().mockReturnValue(new Promise(() => undefined));
    const result = performEffect(
      { dateOfBirth: '2007-09-08', secrets: null },
      { fhir: { search } } as any,
      Date.now() + 1_000
    );
    const assertion = expect(result).rejects.toEqual(PATIENT_SEARCH_TOO_BROAD_ERROR);

    await vi.advanceTimersByTimeAsync(1_000);
    await assertion;
  });

  it('returns the results when FHIR answers before the deadline', async () => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => [patient], total: 1 });
    const result = await performEffect(
      { dateOfBirth: '1990-01-01', secrets: null },
      { fhir: { search } } as any,
      Date.now() + 60_000
    );

    expect(result.patients).toHaveLength(1);
  });
});

describe('search-patients searchDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const withRemaining = (ms: number): Context => ({ getRemainingTimeInMillis: () => ms }) as Context;

  it.each([
    ['without a Lambda context (local server)', undefined, 1_025_000],
    ['when the Lambda has more time left', withRemaining(60_000), 1_025_000],
    ['capped 5 s before a shorter Lambda timeout', withRemaining(20_000), 1_015_000],
  ])('gives the search 25 s %s', (_label, context, expected) => {
    vi.useFakeTimers({ now: 1_000_000 });

    expect(searchDeadline(context)).toBe(expected);
  });
});
