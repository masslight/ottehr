import { Schedule } from 'fhir/r4b';
import { SCHEDULE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import { describe, expect, it } from 'vitest';
import { openHoursOnDay } from '../src/shared/adhoc-datasets/encounters/helpers';
import { DEFAULT_SCHEDULE_JSON } from './helpers/testScheduleUtils';

describe('openHoursOnDay', () => {
  const overrides = Object.fromEntries(
    ['01/05/2026', '01/06/2026', '01/09/2026', '01/14/2026'].map((day, i) => [
      day,
      { open: 9 + i, close: 17, openingBuffer: 0, closingBuffer: 0, hours: [] },
    ])
  );
  const schedule: Schedule = {
    resourceType: 'Schedule',
    id: 'sch-1',
    actor: [],
    extension: [
      {
        url: SCHEDULE_EXTENSION_URL,
        valueString: JSON.stringify({ ...DEFAULT_SCHEDULE_JSON, scheduleOverrides: overrides }),
      },
    ],
  };

  it('answers per clinic and local day as an uncached read would, in whole-, half- and quarter-hour zones', () => {
    for (const timezone of ['America/New_York', 'Asia/Kolkata', 'Asia/Kathmandu', 'Pacific/Chatham']) {
      for (let i = 0; i < 600; i++) {
        const start = new Date(Date.UTC(2026, 0, 1) + i * 97 * 60_000).toISOString();
        expect(openHoursOnDay(schedule, start, timezone)).toBe(openHoursOnDay({ ...schedule }, start, timezone));
      }
    }
  });

  it('is null without a schedule and for an unreadable time', () => {
    expect(openHoursOnDay({ resourceType: 'Schedule', actor: [] }, '2026-01-05T15:00:00Z', 'America/New_York')).toBe(
      null
    );
    expect(openHoursOnDay(schedule, 'not a time', 'America/New_York')).toBe(null);
  });
});
