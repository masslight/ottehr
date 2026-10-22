import { DateTime } from 'luxon';
import { rangeFromControls } from 'src/features/report-builder/page/AdHocDateRangePicker';
import { describe, expect, it } from 'vitest';

const today = DateTime.now().setZone('America/New_York').startOf('day');
const iso = (d: DateTime): string => d.toISO() ?? '';

describe('rangeFromControls', () => {
  it('resolves the longer relative ranges', () => {
    expect(rangeFromControls('last-90-days', '', '', '')).toEqual({
      start: iso(today.minus({ days: 89 })),
      end: iso(today.endOf('day')),
    });
    expect(rangeFromControls('last-365-days', '', '', '')).toEqual({
      start: iso(today.minus({ days: 364 })),
      end: iso(today.endOf('day')),
    });
  });

  it('resolves whole months and years', () => {
    expect(rangeFromControls('this-month', '', '', '')).toEqual({
      start: iso(today.startOf('month')),
      end: iso(today.endOf('month')),
    });
    const lastMonth = today.minus({ months: 1 });
    expect(rangeFromControls('last-month', '', '', '')).toEqual({
      start: iso(lastMonth.startOf('month')),
      end: iso(lastMonth.endOf('month')),
    });
    expect(rangeFromControls('this-year', '', '', '')).toEqual({
      start: iso(today.startOf('year')),
      end: iso(today.endOf('year')),
    });
    const lastYear = today.minus({ years: 1 });
    expect(rangeFromControls('last-year', '', '', '')).toEqual({
      start: iso(lastYear.startOf('year')),
      end: iso(lastYear.endOf('year')),
    });
  });
});
