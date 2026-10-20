import { describe, expect, it } from 'vitest';
import { MAX_APPOINTMENT_SEARCH_RANGE_DAYS } from '../types/constants';
import { getAppointmentSearchDateRangeError } from './appointment-search';

describe('getAppointmentSearchDateRangeError', () => {
  it('accepts a same-day range and a forward range up to the maximum', () => {
    expect(getAppointmentSearchDateRangeError('2026-09-02', '2026-09-02')).toBeUndefined();
    expect(getAppointmentSearchDateRangeError('2026-09-02', '2026-09-09')).toBeUndefined();
    expect(getAppointmentSearchDateRangeError('2026-01-01', '2026-04-01')).toBeUndefined(); // exactly 90 days
  });

  it('names the reason a range is rejected', () => {
    expect(getAppointmentSearchDateRangeError('not-a-date', '2026-09-02')).toBe(
      '"searchDateFrom" must be a valid date'
    );
    expect(getAppointmentSearchDateRangeError('2026-09-02', '')).toBe('"searchDateTo" must be a valid date');
    expect(getAppointmentSearchDateRangeError('2026-09-03', '2026-09-02')).toBe(
      '"searchDateFrom" must be on or before "searchDateTo"'
    );
    expect(getAppointmentSearchDateRangeError('2026-01-01', '2026-04-02')).toBe(
      `The date range must not exceed ${MAX_APPOINTMENT_SEARCH_RANGE_DAYS} days`
    );
  });
});
