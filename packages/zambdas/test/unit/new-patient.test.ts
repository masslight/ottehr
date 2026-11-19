import Oystehr from '@oystehr/sdk';
import { Appointment, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { resolveNewPatients } from '../../src/shared/new-patient';

const visit = (
  id: string,
  start: string,
  status: Appointment['status'] = 'fulfilled'
): { appointment: Appointment; encounterId: string } => ({
  appointment: { resourceType: 'Appointment', id, status, start, participant: [] },
  encounterId: `enc-${id}`,
});

const staffAnswer = (visitId: string, value: string): Observation => ({
  resourceType: 'Observation',
  id: `obs-${visitId}`,
  status: 'final',
  code: { text: 'seen-in-last-three-years' },
  encounter: { reference: `Encounter/enc-${visitId}` },
  valueString: value,
  meta: {
    tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/additional-questions-field`, code: 'seen-in-last-three-years' }],
  },
});

const fakeOystehr = (observations: Observation[]): { oystehr: Oystehr; searchedEncounters: string[] } => {
  const searchedEncounters: string[] = [];
  const oystehr = {
    fhir: {
      search: async ({ params }: { params: { name: string; value: string }[] }) => {
        const encounters = params.find((p) => p.name === 'encounter')?.value.split(',') ?? [];
        searchedEncounters.push(...encounters);
        return { unbundle: () => observations.filter((o) => encounters.includes(o.encounter?.reference ?? '')) };
      },
    },
  } as unknown as Oystehr;
  return { oystehr, searchedEncounters };
};

describe('resolveNewPatients', () => {
  it('a prior visit makes the patient existing without reading any answers', async () => {
    const { oystehr, searchedEncounters } = fakeOystehr([staffAnswer('a', 'no')]);
    const result = await resolveNewPatients(
      oystehr,
      new Map([['p', { hasPriorVisit: true, visits: [visit('a', '2026-07-01T10:00:00Z')] }]])
    );
    expect(result.get('p')).toBe(false);
    expect(searchedEncounters).toEqual([]);
  });

  it('without a prior visit the staff answer on the first visit decides', async () => {
    const { oystehr } = fakeOystehr([staffAnswer('a', 'yes'), staffAnswer('b', 'no')]);
    const result = await resolveNewPatients(
      oystehr,
      new Map([
        ['returning', { hasPriorVisit: false, visits: [visit('a', '2026-07-01T10:00:00Z')] }],
        ['fresh', { hasPriorVisit: false, visits: [visit('b', '2026-07-01T11:00:00Z')] }],
        ['unanswered', { hasPriorVisit: false, visits: [visit('c', '2026-07-01T12:00:00Z')] }],
      ])
    );
    expect(Object.fromEntries(result)).toEqual({ returning: false, fresh: true, unanswered: true });
  });

  it('ignores answers given after the first visit that took place: they already reflect that visit', async () => {
    const { oystehr, searchedEncounters } = fakeOystehr([staffAnswer('later', 'yes')]);
    const result = await resolveNewPatients(
      oystehr,
      new Map([
        [
          'p',
          {
            hasPriorVisit: false,
            visits: [visit('later', '2026-07-20T10:00:00Z'), visit('first', '2026-07-01T10:00:00Z')],
          },
        ],
      ])
    );
    expect(result.get('p')).toBe(true);
    expect(searchedEncounters).toEqual(['Encounter/enc-first']);
  });

  it('reads past a visit that did not take place', async () => {
    const { oystehr } = fakeOystehr([staffAnswer('seen', 'yes')]);
    const result = await resolveNewPatients(
      oystehr,
      new Map([
        [
          'p',
          {
            hasPriorVisit: false,
            visits: [visit('booked', '2026-07-01T10:00:00Z', 'booked'), visit('seen', '2026-07-02T10:00:00Z')],
          },
        ],
      ])
    );
    expect(result.get('p')).toBe(false);
  });
});
