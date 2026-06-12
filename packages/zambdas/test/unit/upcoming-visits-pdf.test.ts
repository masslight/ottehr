import { describe, expect, test } from 'vitest';
import { UpcomingFollowUp } from '../../src/shared/pdf/get-upcoming-follow-ups';
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
