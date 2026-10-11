import { describe, expect, test } from 'vitest';
import { getAppointmentSearchWindow } from '../src/ehr/get-appointments/helpers';

// Regression coverage: tracking-board date filters are calendar days in the *queried resource's*
// timezone. Before the window was zoned to the resource, the client's (browser) timezone was used;
// a UTC browser asking for "2026-08-13" at an America/New_York clinic produced a UTC-day window
// that excluded appointments booked 8pm-midnight local — which is 00:00-04:00Z on the next UTC
// day. CI browsers run in UTC, so the EHR e2e board tests failed every night between roughly
// 00:00 and 05:00 UTC and passed all day.
describe('getAppointmentSearchWindow', () => {
  test('builds the window for the local day in the given timezone', () => {
    const { startDay, endDay } = getAppointmentSearchWindow({
      searchDateFrom: '2026-08-13',
      searchDateTo: '2026-08-13',
      timezone: 'America/New_York',
    });
    expect(startDay).toBe('2026-08-13T04:00:00.000Z');
    expect(endDay).toBe('2026-08-14T03:59:59.999Z');
  });

  test('late-evening local appointment falls inside its local day window (the night-window regression)', () => {
    // 10:15pm Aug 13 at an America/New_York clinic = 02:15Z Aug 14. All values are UTC ISO strings
    // of equal precision, so lexicographic comparison is instant comparison.
    const appointmentStart = '2026-08-14T02:15:00.000Z';

    const clinicDay = getAppointmentSearchWindow({
      searchDateFrom: '2026-08-13',
      searchDateTo: '2026-08-13',
      timezone: 'America/New_York',
    });
    expect(appointmentStart >= clinicDay.startDay! && appointmentStart <= clinicDay.endDay!).toBe(true);

    // The old behavior — the same date interpreted in the browser's UTC — excluded it.
    const utcDay = getAppointmentSearchWindow({
      searchDateFrom: '2026-08-13',
      searchDateTo: '2026-08-13',
      timezone: 'UTC',
    });
    expect(appointmentStart >= utcDay.startDay! && appointmentStart <= utcDay.endDay!).toBe(false);
  });

  test('multi-day range spans from the first day start to the last day end', () => {
    const { startDay, endDay } = getAppointmentSearchWindow({
      searchDateFrom: '2026-08-12',
      searchDateTo: '2026-08-13',
      timezone: 'America/New_York',
    });
    expect(startDay).toBe('2026-08-12T04:00:00.000Z');
    expect(endDay).toBe('2026-08-14T03:59:59.999Z');
  });
});
