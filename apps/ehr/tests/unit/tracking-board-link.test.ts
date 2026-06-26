import { DateTime } from 'luxon';
import { visitStatusArray, VisitStatusLabel } from 'utils';
import { describe, expect, test } from 'vitest';
import { buildTrackingBoardPath } from '../../src/pages/reports/trackingBoardLink';

const getParams = (path: string): URLSearchParams => new URLSearchParams(path.split('?')[1] ?? '');

// Mirrors how get-appointments buckets each status into a tracking-board tab.
const EXPECTED_TAB_BY_STATUS: Record<VisitStatusLabel, string> = {
  pending: 'prebooked',
  arrived: 'in-office',
  ready: 'in-office',
  intake: 'in-office',
  'ready for provider': 'in-office',
  provider: 'in-office',
  discharged: 'completed',
  completed: 'completed',
  'awaiting supervisor approval': 'completed',
  cancelled: 'cancelled',
  'no show': 'cancelled',
  unknown: 'in-office',
};

describe('buildTrackingBoardPath', () => {
  test.each(visitStatusArray.map((status) => [status, EXPECTED_TAB_BY_STATUS[status]] as const))(
    'routes "%s" to the "%s" tab',
    (visitStatus, expectedTab) => {
      const params = getParams(
        buildTrackingBoardPath({ appointmentStart: '2026-06-05T12:00:00.000Z', locationId: 'loc-1', visitStatus })
      );
      expect(params.get('tab')).toBe(expectedTab);
    }
  );

  test('defaults to the in-office tab when visitStatus is undefined', () => {
    const params = getParams(
      buildTrackingBoardPath({ appointmentStart: '2026-06-05T12:00:00.000Z', locationId: 'loc-1' })
    );
    expect(params.get('tab')).toBe('in-office');
  });

  test('builds a single-day range (dateFrom === dateTo) from the appointment date', () => {
    const appointmentStart = '2026-06-05T12:00:00.000Z';
    const expectedDate = DateTime.fromISO(appointmentStart).toFormat('yyyy-MM-dd');
    const params = getParams(buildTrackingBoardPath({ appointmentStart, locationId: 'loc-1' }));

    expect(params.get('dateFrom')).toBe(expectedDate);
    expect(params.get('dateTo')).toBe(expectedDate);
  });

  test('falls back to today (valid ISO, never "Invalid DateTime") for an unparseable appointmentStart', () => {
    const params = getParams(buildTrackingBoardPath({ appointmentStart: 'not-a-date', locationId: 'loc-1' }));
    const today = DateTime.now().toFormat('yyyy-MM-dd');

    expect(params.get('dateFrom')).toBe(today);
    expect(params.get('dateTo')).toBe(today);
    expect(params.get('dateFrom')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test('falls back to today when appointmentStart is omitted', () => {
    const params = getParams(buildTrackingBoardPath({ locationId: 'loc-1' }));
    const today = DateTime.now().toFormat('yyyy-MM-dd');

    expect(params.get('dateFrom')).toBe(today);
    expect(params.get('dateTo')).toBe(today);
  });

  test('includes the location and in-person visit types', () => {
    const params = getParams(
      buildTrackingBoardPath({ appointmentStart: '2026-06-05T12:00:00.000Z', locationId: 'loc-1' })
    );

    expect(params.get('location')).toBe('loc-1');
    expect(params.get('visitType')).toBe('in-person-walk-in,in-person-pre-booked,in-person-post-telemed');
  });
});
