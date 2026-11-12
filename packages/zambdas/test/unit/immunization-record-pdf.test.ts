import { ImmunizationForecast, ImmunizationGroupForecast } from 'utils/lib/immunization-forecast/types';
import { GetPatientImmunizationsResponse, PatientImmunizationRecord } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it } from 'vitest';
import {
  composeImmunizationRecordGroups,
  composeOtherDoses,
  doseLine,
} from '../../src/shared/pdf/immunization-record-pdf';

const TZ = 'America/New_York';

const record = (overrides: Partial<PatientImmunizationRecord> & { id: string }): PatientImmunizationRecord => ({
  vaccineName: 'Vaccine',
  outside: false,
  dateUnknown: !overrides.dateGiven,
  ...overrides,
});

const group = (overrides: Partial<ImmunizationGroupForecast>): ImmunizationGroupForecast => ({
  group: 'hepb',
  label: 'Hep B',
  status: 'uptodate',
  seriesStatus: 'Not Complete',
  seriesNames: [],
  targetDoses: 3,
  targetText: '3',
  doses: [],
  next: null,
  notNeeded: [],
  notes: [],
  ...overrides,
});

const forecastOf = (groups: ImmunizationGroupForecast[], unmappedIds: string[] = []): ImmunizationForecast => ({
  asOf: '2026-11-10',
  dataVersion: '2026-11',
  groups,
  unmappedDoses: unmappedIds.map((id) => ({ id, cvx: '999', date: null, source: 'outside' })),
});

describe('immunization record PDF — dose lines', () => {
  it('writes a dose given here on the practice day, with its dose number', () => {
    const line = doseLine(
      { doseNumber: 2, status: 'valid' },
      record({ id: 'd', vaccineName: 'Engerix-B', dateGiven: '2026-08-11T02:30:00.000Z' }),
      TZ
    );
    expect(line).toBe('08/10/2026 — Engerix-B, dose 2');
  });

  it('labels an outside dose with where and from what source, and an undated one "Date unknown"', () => {
    expect(
      doseLine(
        { doseNumber: 1, status: 'valid' },
        record({
          id: 'o',
          vaccineName: 'Hep B',
          outside: true,
          dateGiven: '2026-07-08',
          place: 'Mercy Hospital',
          source: 'written-record',
        }),
        TZ
      )
    ).toBe('07/08/2026 — Hep B, dose 1 · Outside: Mercy Hospital, from a written record');

    expect(
      doseLine(
        { doseNumber: null, status: 'not-counted', reason: 'Date unknown' },
        record({ id: 'u', vaccineName: 'DTaP', outside: true, source: 'unspecified' }),
        TZ
      )
    ).toBe('Date unknown — DTaP · Outside: from source unspecified · Date unknown');
  });

  it('says why an invalid dose did not count', () => {
    expect(
      doseLine(
        { doseNumber: null, status: 'invalid', reason: 'Too young' },
        record({ id: 'i', vaccineName: 'MMR', dateGiven: '2026-09-01T12:00:00.000Z' }),
        TZ
      )
    ).toBe('09/01/2026 — MMR · invalid: Too young');
  });
});

describe('immunization record PDF — groups', () => {
  const records: GetPatientImmunizationsResponse = {
    immunizations: [
      record({ id: 'h2', vaccineName: 'Engerix-B', cvx: '08', dateGiven: '2026-08-10T14:00:00.000Z' }),
      record({
        id: 'h1',
        vaccineName: 'Hep B',
        cvx: '08',
        outside: true,
        dateGiven: '2026-07-08',
        place: 'Mercy Hospital',
      }),
      record({ id: 'travel', vaccineName: 'Typhoid', cvx: '999', outside: true, dateGiven: '2026-10-01' }),
      record({ id: 'no-cvx', vaccineName: 'Mystery shot', dateGiven: '2026-09-15T14:00:00.000Z' }),
    ],
    marks: [],
  };

  it('lists each group with its doses in date order, the active mark and the next dose dates', () => {
    const forecast = forecastOf(
      [
        group({
          doses: [
            { id: 'h2', date: '2026-08-10', cvx: '08', doseNumber: 2, status: 'valid', counted: true },
            { id: 'h1', date: '2026-07-08', cvx: '08', doseNumber: 1, status: 'valid', counted: true },
          ],
          next: {
            n: 3,
            earliest: '2026-11-18',
            recommended: '2026-12-23',
            pastDue: '2027-02-08',
            latest: null,
            cvx: ['08'],
          },
          notes: ['Dose 3 at 6–18 months'],
        }),
        group({
          group: 'rota',
          label: 'Rotavirus',
          status: 'declined',
          targetText: '3',
          mark: { type: 'declined', date: '2026-11-10', by: 'J. Nurse', note: 'Parents declined' },
        }),
        group({
          group: 'flu',
          label: 'Influenza',
          status: 'notyet',
          targetDoses: null,
          targetText: 'Every season',
          next: { n: 1, earliest: '2027-01-08', recommended: '2027-01-08', pastDue: null, latest: null, cvx: ['140'] },
        }),
      ],
      ['travel']
    );

    expect(composeImmunizationRecordGroups(forecast, records, TZ)).toEqual([
      {
        title: 'Hep B — Up to date',
        target: 'Target: 3',
        doses: [
          '07/08/2026 — Hep B, dose 1 · Outside: Mercy Hospital, from source unspecified',
          '08/10/2026 — Engerix-B, dose 2',
        ],
        mark: undefined,
        next: 'Next: dose 3 — earliest 11/18/2026, recommended 12/23/2026, past due 02/08/2027',
        notes: ['Dose 3 at 6–18 months'],
      },
      {
        title: 'Rotavirus — Declined',
        target: 'Target: 3',
        doses: [],
        mark: 'Declined 11/10/2026 · recorded by J. Nurse — Parents declined',
        next: undefined,
        notes: [],
      },
      {
        title: 'Influenza — Not yet due',
        target: 'Target: Every season',
        doses: [],
        mark: undefined,
        next: 'Next: dose 1 — earliest 01/08/2027, recommended 01/08/2027',
        notes: [],
      },
    ]);
  });

  it('puts doses without a CVX and doses the forecast cannot place under "Other vaccines"', () => {
    expect(composeOtherDoses(forecastOf([], ['travel']), records, TZ)).toEqual([
      '09/15/2026 — Mystery shot',
      '10/01/2026 — Typhoid · Outside: from source unspecified',
    ]);
  });
});
