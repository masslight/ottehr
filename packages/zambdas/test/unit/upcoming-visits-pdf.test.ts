import { Appointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { FOLLOWUP_SUBTYPE_SYSTEM, FOLLOWUP_SYSTEMS } from 'utils';
import { describe, expect, test } from 'vitest';
import { selectUpcomingFollowUps, UpcomingFollowUp } from '../../src/shared/pdf/get-upcoming-follow-ups';
import { composeUpcomingVisits } from '../../src/shared/pdf/sections/upcomingVisits';

describe('composeUpcomingVisits', () => {
  test('formats each follow-up as "date time  TZ, location - reason"', () => {
    const followUps: UpcomingFollowUp[] = [
      {
        startIso: '2026-06-07T15:30:00.000Z', // 11:30 AM EDT
        timezone: 'America/New_York',
        locationName: 'New York Urgent Care Clinic',
        reason: 'Suture / Staple Removal',
      },
      {
        startIso: '2026-06-12T13:30:00.000Z', // 09:30 AM EDT
        timezone: 'America/New_York',
        locationName: 'New York Urgent Care Clinic',
        reason: 'Test Results Review (Lab/Imaging)',
      },
    ];

    const { rows } = composeUpcomingVisits({ upcomingFollowUps: followUps });

    expect(rows).toEqual([
      '06/07/2026 11:30 AM  EDT, New York Urgent Care Clinic - Suture / Staple Removal',
      '06/12/2026 09:30 AM  EDT, New York Urgent Care Clinic - Test Results Review (Lab/Imaging)',
    ]);
  });

  test('returns no rows when there are no upcoming follow-ups (empty state)', () => {
    expect(composeUpcomingVisits({ upcomingFollowUps: [] }).rows).toEqual([]);
  });

  test('omits the date segment when the follow-up has no resolvable datetime', () => {
    const { rows } = composeUpcomingVisits({
      upcomingFollowUps: [
        { startIso: '', timezone: 'America/New_York', locationName: 'Los Angeles', reason: 'Result - Lab' },
      ],
    });

    expect(rows).toEqual(['Los Angeles - Result - Lab']);
  });

  test('omits the location/reason segment gracefully when missing', () => {
    const { rows } = composeUpcomingVisits({
      upcomingFollowUps: [
        {
          startIso: '2026-06-07T15:30:00.000Z',
          timezone: 'America/New_York',
          locationName: '',
          reason: '',
        },
      ],
    });

    expect(rows).toEqual(['06/07/2026 11:30 AM  EDT']);
  });
});

describe('selectUpcomingFollowUps', () => {
  const PARENT_ID = 'parent-encounter';
  const NOW = DateTime.fromISO('2026-06-12T09:00:00.000Z'); // generation time
  const T08 = '2026-06-12T08:00:00.000Z';
  const T10 = '2026-06-12T10:00:00.000Z';
  const T11 = '2026-06-12T11:00:00.000Z';
  const T12 = '2026-06-12T12:00:00.000Z';

  // A scheduled follow-up encounter plus the appointment that carries its start/reason.
  const scheduledFollowUp = (opts: {
    id: string;
    start?: string;
    status?: Encounter['status'];
    reason?: string;
  }): [Encounter, Appointment] => {
    const apptId = `appt-${opts.id}`;
    const encounter: Encounter = {
      resourceType: 'Encounter',
      id: opts.id,
      status: opts.status ?? 'planned',
      class: { code: 'AMB' },
      partOf: { reference: `Encounter/${PARENT_ID}` },
      type: [
        {
          coding: [
            { system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code },
            { system: FOLLOWUP_SUBTYPE_SYSTEM, code: 'scheduled' },
          ],
        },
      ],
      appointment: [{ reference: `Appointment/${apptId}` }],
    };
    const appointment: Appointment = {
      resourceType: 'Appointment',
      id: apptId,
      status: 'booked',
      participant: [],
      ...(opts.start ? { start: opts.start } : {}),
      description: opts.reason ?? 'Suture / Staple Removal',
    };
    return [encounter, appointment];
  };

  // Annotation follow-up: datetime on `period.start`, no scheduled subtype coding.
  const annotationFollowUp = (opts: { id: string; periodStart: string; status?: Encounter['status'] }): Encounter => ({
    resourceType: 'Encounter',
    id: opts.id,
    status: opts.status ?? 'in-progress',
    class: { code: 'AMB' },
    partOf: { reference: `Encounter/${PARENT_ID}` },
    type: [{ coding: [{ system: FOLLOWUP_SYSTEMS.type.url, code: FOLLOWUP_SYSTEMS.type.code }] }],
    period: { start: opts.periodStart },
    reasonCode: [{ text: 'Clinical Follow-up' }],
  });

  const select = (items: (Encounter | Appointment)[], excludeEncounterId?: string): UpcomingFollowUp[] =>
    selectUpcomingFollowUps(items, { fallbackTimezone: 'America/New_York', generatedAt: NOW, excludeEncounterId });

  test('drops a signed (finished) scheduled follow-up', () => {
    const result = select([
      ...scheduledFollowUp({ id: 'signed', start: T10, status: 'finished' }),
      ...scheduledFollowUp({ id: 'upcoming', start: T11, status: 'planned' }),
    ]);

    expect(result.map((r) => r.startIso)).toEqual([T11]);
  });

  test('drops cancelled / no-show scheduled follow-ups (encounter status "cancelled")', () => {
    const result = select([
      ...scheduledFollowUp({ id: 'cancelled', start: T10, status: 'cancelled' }),
      ...scheduledFollowUp({ id: 'upcoming', start: T11, status: 'planned' }),
    ]);

    expect(result.map((r) => r.startIso)).toEqual([T11]);
  });

  test('excludes annotation follow-ups (internal tracking tasks, not patient-facing return visits)', () => {
    const result = select([
      annotationFollowUp({ id: 'unresolved-annotation', periodStart: T11, status: 'in-progress' }),
      annotationFollowUp({ id: 'resolved-annotation', periodStart: T11, status: 'finished' }),
      ...scheduledFollowUp({ id: 'scheduled', start: T12, status: 'planned' }),
    ]);

    // Only the scheduled follow-up visit is listed; neither annotation follow-up appears.
    expect(result.map((r) => r.startIso)).toEqual([T12]);
  });

  test('excludes an earlier sibling relative to the current visit, keeps later ones', () => {
    // Document generated for the 11:00 follow-up: the 10:00 sibling must not appear, the 12:00 must.
    const result = select(
      [
        ...scheduledFollowUp({ id: '10am', start: T10 }),
        ...scheduledFollowUp({ id: '11am', start: T11 }),
        ...scheduledFollowUp({ id: '12pm', start: T12 }),
      ],
      '11am'
    );

    expect(result.map((r) => r.startIso)).toEqual([T12]);
  });

  test('keeps visits at/after generation time and drops past ones', () => {
    const result = select([
      ...scheduledFollowUp({ id: 'past', start: T08 }),
      ...scheduledFollowUp({ id: 'future', start: T10 }),
    ]);

    expect(result.map((r) => r.startIso)).toEqual([T10]);
  });

  test('never silently drops a follow-up with no resolvable datetime', () => {
    const result = select([...scheduledFollowUp({ id: 'no-start' })]);

    expect(result.map((r) => r.startIso)).toEqual(['']);
  });
});
