import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { buildTrackingBoardPath } from './tracking-board';

describe('buildTrackingBoardPath', () => {
  it('produces the exact URL the Complete Encounters report renders for an in-person visit', () => {
    // Byte-identical to what the pre-extraction apps/ehr trackingBoardLink.ts produced.
    expect(
      buildTrackingBoardPath({
        // 10:30 UTC keeps the calendar day stable across the local zones tests may run in.
        appointmentStart: '2026-06-15T10:30:00.000Z',
        locationId: 'abc-123',
        visitStatus: 'completed',
      })
    ).toBe(
      '/visits?location=abc-123&visitType=in-person-walk-in%2Cin-person-pre-booked%2Cin-person-post-telemed&dateFrom=2026-06-15&dateTo=2026-06-15&tab=completed'
    );
  });

  it('buckets statuses into the right tab', () => {
    const href = (visitStatus?: Parameters<typeof buildTrackingBoardPath>[0]['visitStatus']): string =>
      buildTrackingBoardPath({ appointmentStart: '2026-06-15T14:30:00Z', locationId: 'loc', visitStatus });
    expect(href('pending')).toContain('tab=prebooked');
    expect(href('discharged')).toContain('tab=completed');
    expect(href('awaiting supervisor approval')).toContain('tab=completed');
    expect(href('cancelled')).toContain('tab=cancelled');
    expect(href('no show')).toContain('tab=cancelled');
    expect(href('provider')).toContain('tab=in-office');
    expect(href(undefined)).toContain('tab=in-office');
  });

  it('falls back to today when the start is missing or invalid', () => {
    const today = DateTime.now().toFormat('yyyy-MM-dd');
    expect(buildTrackingBoardPath({ locationId: 'loc' })).toContain(`dateFrom=${today}`);
    expect(buildTrackingBoardPath({ appointmentStart: 'not-a-date', locationId: 'loc' })).toContain(`dateTo=${today}`);
  });
});
