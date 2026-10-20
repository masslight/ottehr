import { ClaimItem, Encounter, EncounterStatusHistory } from 'fhir/r4b';
import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { deriveClaimBillablePeriod, deriveClaimBillablePeriodFromEncounter } from '../../../src/billing/shared';

const item = (overrides: Partial<ClaimItem>): ClaimItem => ({
  sequence: 1,
  productOrService: { coding: [{ code: '99213' }] },
  ...overrides,
});

describe('deriveClaimBillablePeriod', () => {
  it('returns undefined when there are no items', () => {
    expect(deriveClaimBillablePeriod([])).toBeUndefined();
    expect(deriveClaimBillablePeriod(undefined)).toBeUndefined();
  });

  it('uses the single item date for both ends when there is one item with a plain servicedDate', () => {
    expect(deriveClaimBillablePeriod([item({ servicedDate: '2026-01-15' })])).toEqual({
      start: '2026-01-15',
      end: '2026-01-15',
    });
  });

  it('uses servicedPeriod start/end for a single item spanning multiple days', () => {
    expect(deriveClaimBillablePeriod([item({ servicedPeriod: { start: '2026-01-01', end: '2026-01-05' } })])).toEqual({
      start: '2026-01-01',
      end: '2026-01-05',
    });
  });

  it('picks the earliest start and latest end across a mix of servicedDate and servicedPeriod items', () => {
    const items = [
      item({ sequence: 1, servicedDate: '2026-01-10' }),
      item({ sequence: 2, servicedPeriod: { start: '2026-01-05', end: '2026-01-08' } }),
      item({ sequence: 3, servicedDate: '2026-01-20' }),
    ];
    expect(deriveClaimBillablePeriod(items)).toEqual({ start: '2026-01-05', end: '2026-01-20' });
  });

  it('leaves end undefined when no item has an end date', () => {
    const items = [
      item({ sequence: 1, servicedPeriod: { start: '2026-01-01' } }),
      item({ sequence: 2, servicedPeriod: { start: '2026-01-02' } }),
    ];
    expect(deriveClaimBillablePeriod(items)).toEqual({ start: '2026-01-01', end: undefined });
  });
});

const visitStatusHistoryEntry = (
  ottehrStatus: string,
  period: EncounterStatusHistory['period'],
  fhirStatus: EncounterStatusHistory['status'] = 'in-progress'
): EncounterStatusHistory => ({
  status: fhirStatus,
  period,
  extension: [{ url: FHIR_EXTENSION.EncounterStatusHistory.ottehrVisitStatus.url, valueCode: ottehrStatus }],
});

const encounter = (statusHistory: EncounterStatusHistory[]): Encounter => ({
  resourceType: 'Encounter',
  status: 'finished',
  class: { code: 'AMB' },
  statusHistory,
});

describe('deriveClaimBillablePeriodFromEncounter', () => {
  it('returns undefined when the encounter never reached arrived, intake, or provider', () => {
    const enc = encounter([visitStatusHistoryEntry('pending', { start: '2026-01-01T08:00:00.000Z' })]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toBeUndefined();
  });

  it('uses arrived as the start and discharged as the end when both are present', () => {
    const enc = encounter([
      visitStatusHistoryEntry('pending', { start: '2026-01-01T07:00:00.000Z', end: '2026-01-01T08:00:00.000Z' }),
      visitStatusHistoryEntry('arrived', { start: '2026-01-01T08:00:00.000Z', end: '2026-01-01T09:00:00.000Z' }),
      visitStatusHistoryEntry('provider', { start: '2026-01-01T09:00:00.000Z', end: '2026-01-01T10:00:00.000Z' }),
      visitStatusHistoryEntry('discharged', { start: '2026-01-01T10:00:00.000Z' }),
    ]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toEqual({
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T10:00:00.000Z',
    });
  });

  it('falls back to intake for the start when arrived was never recorded', () => {
    const enc = encounter([
      visitStatusHistoryEntry('intake', { start: '2026-01-01T08:30:00.000Z', end: '2026-01-01T09:00:00.000Z' }),
      visitStatusHistoryEntry('discharged', { start: '2026-01-01T10:00:00.000Z' }),
    ]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toEqual({
      start: '2026-01-01T08:30:00.000Z',
      end: '2026-01-01T10:00:00.000Z',
    });
  });

  it('falls back to provider for the start when neither arrived nor intake was recorded', () => {
    const enc = encounter([
      visitStatusHistoryEntry('provider', { start: '2026-01-01T09:00:00.000Z' }),
      visitStatusHistoryEntry('discharged', { start: '2026-01-01T10:00:00.000Z' }),
    ]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toEqual({
      start: '2026-01-01T09:00:00.000Z',
      end: '2026-01-01T10:00:00.000Z',
    });
  });

  it('leaves end undefined when the encounter has not been discharged', () => {
    const enc = encounter([visitStatusHistoryEntry('arrived', { start: '2026-01-01T08:00:00.000Z' })]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toEqual({
      start: '2026-01-01T08:00:00.000Z',
      end: undefined,
    });
  });

  it('uses the most recent occurrence of each status when the visit moved backward and forward', () => {
    const enc = encounter([
      visitStatusHistoryEntry('arrived', { start: '2026-01-01T08:00:00.000Z', end: '2026-01-01T09:00:00.000Z' }),
      visitStatusHistoryEntry('provider', { start: '2026-01-01T09:00:00.000Z', end: '2026-01-01T09:30:00.000Z' }),
      // Visit was moved back to arrived after already seeing the provider.
      visitStatusHistoryEntry('arrived', { start: '2026-01-01T09:30:00.000Z', end: '2026-01-01T10:00:00.000Z' }),
      visitStatusHistoryEntry('discharged', { start: '2026-01-01T11:00:00.000Z' }),
    ]);
    expect(deriveClaimBillablePeriodFromEncounter(enc)).toEqual({
      start: '2026-01-01T09:30:00.000Z',
      end: '2026-01-01T11:00:00.000Z',
    });
  });
});
