import type { Appointment, Observation } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { runFetchPlan } from '../instance/zambdaClient';
import { pickPatient, visitsPerPatient, visitsWithVitals } from './pickPatient';

vi.mock('../instance/zambdaClient', () => ({ runFetchPlan: vi.fn() }));
const fetchMock = vi.mocked(runFetchPlan);

const obs = (patient: string | undefined, encounter: string | undefined): Observation =>
  ({
    resourceType: 'Observation',
    status: 'final',
    code: {},
    subject: patient ? { reference: patient } : undefined,
    encounter: encounter ? { reference: encounter } : undefined,
  }) as Observation;

describe('visitsWithVitals', () => {
  it('counts distinct visits per patient, ignoring readings without a patient or visit', () => {
    const counts = visitsWithVitals([
      obs('Patient/a', 'Encounter/1'),
      obs('Patient/a', 'Encounter/1'),
      obs('Patient/a', 'Encounter/2'),
      obs('Patient/b', 'Encounter/3'),
      obs('Patient/c', undefined),
      obs(undefined, 'Encounter/4'),
      obs('Group/x', 'Encounter/5'),
    ]);
    expect(Object.fromEntries(counts)).toEqual({ a: 2, b: 1 });
  });
});

const appt = (patient: string): Appointment =>
  ({
    resourceType: 'Appointment',
    status: 'fulfilled',
    participant: [{ actor: { reference: 'Location/l' } }, { actor: { reference: patient } }],
  }) as Appointment;

describe('visitsPerPatient', () => {
  it('counts visits per patient, most first', () => {
    expect(visitsPerPatient([appt('Patient/a'), appt('Patient/b'), appt('Patient/b')])).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });
});

describe('pickPatient', () => {
  type Output = Awaited<ReturnType<typeof runFetchPlan>>;
  const answer = (id: string, resources: unknown[], error?: string): Output =>
    ({ resources: { [id]: resources }, stats: [{ id, error }], totalMs: 0, totalBytes: 0 }) as unknown as Output;
  const visits = (...patients: string[]): Output =>
    answer(
      'visits',
      patients.map((p) => appt(`Patient/${p}`))
    );
  const vitals = (patient: string, encounters: string[]): Output =>
    answer(
      'vitals',
      encounters.map((e) => obs(`Patient/${patient}`, `Encounter/${e}`))
    );
  beforeEach(() => fetchMock.mockReset());

  it('checks the leaders by visits and picks the first with enough visits with vitals', async () => {
    fetchMock
      .mockResolvedValueOnce(visits('a', 'a', 'a', 'a', 'b', 'b', 'b', 'c'))
      .mockResolvedValueOnce(vitals('a', ['1', '1', '2'])) // 4 visits, vitals at 2: not enough
      .mockResolvedValueOnce(vitals('b', ['5', '6', '7']));
    expect(await pickPatient(2)).toEqual({ patientId: 'b', visits: 3, period: 'last 90 days' });
    expect(fetchMock.mock.calls[2][2]).toEqual({ patientId: 'b' });
    expect(fetchMock).toHaveBeenCalledTimes(3); // c has too few visits to be checked
  });

  it('widens to a year only when nobody qualifies in 90 days', async () => {
    fetchMock
      .mockResolvedValueOnce(visits('a'))
      .mockResolvedValueOnce(visits('a', 'a', 'a'))
      .mockResolvedValueOnce(vitals('a', ['1', '2', '3']));
    expect(await pickPatient(2)).toEqual({ patientId: 'a', visits: 3, period: 'last 365 days' });
  });

  it('stops with the error when a search fails, instead of widening to a year', async () => {
    fetchMock.mockResolvedValueOnce(answer('visits', [], 'job answered status 400'));
    await expect(pickPatient(2)).rejects.toThrow('job answered status 400');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
