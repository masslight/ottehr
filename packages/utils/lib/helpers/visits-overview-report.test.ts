import { describe, expect, it } from 'vitest';
import { VisitsOverviewReportZambdaOutput } from '../types/api/visits-overview-report.types';
import { mergeVisitsOverviewReports } from './visits-overview-report';

const emptyReport = (start: string, end: string): VisitsOverviewReportZambdaOutput => ({
  message: 'No active appointments found for the specified date range',
  totalAppointments: 0,
  appointmentTypes: [
    { type: 'In-Person', count: 0, percentage: 0 },
    { type: 'Telemed', count: 0, percentage: 0 },
  ],
  dailyVisits: [],
  locationVisits: [],
  practitionerVisits: [],
  visitsByTypeCount: [],
  dateRange: { start, end },
});

const firstDay: VisitsOverviewReportZambdaOutput = {
  message: 'Found 3 appointments: 2 in-person, 1 telemed',
  totalAppointments: 3,
  appointmentTypes: [
    { type: 'In-Person', count: 2, percentage: 67 },
    { type: 'Telemed', count: 1, percentage: 33 },
  ],
  dailyVisits: [
    { date: '2026-10-11', inPerson: 1, telemed: 0, unknown: 0, total: 1 },
    { date: '2026-10-12', inPerson: 1, telemed: 1, unknown: 0, total: 2 },
  ],
  locationVisits: [{ locationName: 'Zeta Clinic', locationId: 'loc-z', inPerson: 2, telemed: 1, total: 3 }],
  practitionerVisits: [
    {
      practitionerId: 'pr-b',
      practitionerName: 'Unknown Provider',
      role: 'Attending Provider',
      inPerson: 2,
      telemed: 0,
      total: 2,
    },
  ],
  visitsByTypeCount: [
    {
      locationName: 'Zeta Clinic',
      locationId: 'loc-z',
      serviceCategory: 'Urgent Care',
      inPerson: 2,
      telemed: 1,
      total: 3,
    },
  ],
  dateRange: { start: '2026-10-11T00:00:00.000-05:00', end: '2026-10-11T23:59:59.999-05:00' },
};

const secondDay: VisitsOverviewReportZambdaOutput = {
  message: 'Found 2 appointments: 1 in-person, 1 telemed',
  totalAppointments: 2,
  appointmentTypes: [
    { type: 'In-Person', count: 1, percentage: 50 },
    { type: 'Telemed', count: 1, percentage: 50 },
  ],
  dailyVisits: [{ date: '2026-10-12', inPerson: 1, telemed: 1, unknown: 0, total: 2 }],
  locationVisits: [
    { locationName: 'Alpha Clinic', locationId: 'loc-a', inPerson: 1, telemed: 0, total: 1 },
    { locationName: 'Zeta Clinic', locationId: 'loc-z', inPerson: 0, telemed: 1, total: 1 },
  ],
  practitionerVisits: [
    {
      practitionerId: 'pr-a',
      practitionerName: 'Ann Lee',
      role: 'Intake Performer',
      inPerson: 1,
      telemed: 0,
      total: 1,
    },
    {
      practitionerId: 'pr-b',
      practitionerName: 'Bob Stone',
      role: 'Attending Provider',
      inPerson: 1,
      telemed: 1,
      total: 2,
    },
  ],
  visitsByTypeCount: [
    {
      locationName: 'Zeta Clinic',
      locationId: 'loc-z',
      serviceCategory: 'Urgent Care',
      inPerson: 0,
      telemed: 1,
      total: 1,
    },
    {
      locationName: 'Alpha Clinic',
      locationId: 'loc-a',
      serviceCategory: 'Workers Comp',
      inPerson: 1,
      telemed: 0,
      total: 1,
    },
  ],
  dateRange: { start: '2026-10-12T00:00:00.000-05:00', end: '2026-10-12T23:59:59.999-05:00' },
};

const fullRange = { start: '2026-10-11T00:00:00.000-05:00', end: '2026-10-12T23:59:59.999-05:00' };

describe('mergeVisitsOverviewReports', () => {
  it('sums counts across batches and recalculates the percentages from the totals', () => {
    const merged = mergeVisitsOverviewReports([firstDay, secondDay], fullRange);

    expect(merged.totalAppointments).toBe(5);
    expect(merged.appointmentTypes).toEqual([
      { type: 'In-Person', count: 3, percentage: 60 },
      { type: 'Telemed', count: 2, percentage: 40 },
    ]);
    expect(merged.message).toBe('Found 5 appointments: 3 in-person, 2 telemed');
    expect(merged.dateRange).toEqual(fullRange);
  });

  it('adds up a day reported by two batches and keeps the days in order', () => {
    const merged = mergeVisitsOverviewReports([secondDay, firstDay], fullRange);

    expect(merged.dailyVisits).toEqual([
      { date: '2026-10-11', inPerson: 1, telemed: 0, unknown: 0, total: 1 },
      { date: '2026-10-12', inPerson: 2, telemed: 2, unknown: 0, total: 4 },
    ]);
  });

  it('groups locations by name, sorted by name', () => {
    const merged = mergeVisitsOverviewReports([firstDay, secondDay], fullRange);

    expect(merged.locationVisits).toEqual([
      { locationName: 'Alpha Clinic', locationId: 'loc-a', inPerson: 1, telemed: 0, total: 1 },
      { locationName: 'Zeta Clinic', locationId: 'loc-z', inPerson: 2, telemed: 2, total: 4 },
    ]);
  });

  it('groups practitioners by id and role, sorted like the zambda, preferring a known name', () => {
    const merged = mergeVisitsOverviewReports([firstDay, secondDay], fullRange);

    expect(merged.practitionerVisits).toEqual([
      {
        practitionerId: 'pr-a',
        practitionerName: 'Ann Lee',
        role: 'Intake Performer',
        inPerson: 1,
        telemed: 0,
        total: 1,
      },
      {
        practitionerId: 'pr-b',
        practitionerName: 'Bob Stone',
        role: 'Attending Provider',
        inPerson: 3,
        telemed: 1,
        total: 4,
      },
    ]);
  });

  it('groups visits by location and service category', () => {
    const merged = mergeVisitsOverviewReports([firstDay, secondDay], fullRange);

    expect(merged.visitsByTypeCount).toEqual([
      {
        locationName: 'Zeta Clinic',
        locationId: 'loc-z',
        serviceCategory: 'Urgent Care',
        inPerson: 2,
        telemed: 2,
        total: 4,
      },
      {
        locationName: 'Alpha Clinic',
        locationId: 'loc-a',
        serviceCategory: 'Workers Comp',
        inPerson: 1,
        telemed: 0,
        total: 1,
      },
    ]);
  });

  it('does not change the inputs', () => {
    const before = JSON.stringify([firstDay, secondDay]);
    mergeVisitsOverviewReports([firstDay, secondDay], fullRange);
    mergeVisitsOverviewReports([firstDay, secondDay], fullRange);
    expect(JSON.stringify([firstDay, secondDay])).toBe(before);
  });

  it('returns the empty report when no batch has active appointments', () => {
    const merged = mergeVisitsOverviewReports(
      [
        emptyReport(fullRange.start, '2026-10-11T23:59:59.999-05:00'),
        emptyReport('2026-10-12T00:00:00.000-05:00', fullRange.end),
      ],
      fullRange
    );

    expect(merged).toEqual(emptyReport(fullRange.start, fullRange.end));
  });

  it('returns a single batch unchanged apart from the requested range', () => {
    expect(mergeVisitsOverviewReports([firstDay], firstDay.dateRange)).toEqual(firstDay);
  });
});
