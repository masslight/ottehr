import { Location, PractitionerRole } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { describe, expect, it } from 'vitest';
import { buildSimpleScheduleExt } from '../../../../test/helpers/testScheduleUtils';
import { computeWalkinAvailability } from './helpers';

const timezone = 'America/New_York';
const timeNow = DateTime.fromISO('2026-10-28T12:00:00', { zone: timezone });
const scheduleExtension = buildSimpleScheduleExt();

const location = (status?: Location['status']): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  ...(status ? { status } : {}),
});

describe('computeWalkinAvailability', () => {
  it('reports a deactivated Location as closed even within open hours', () => {
    const result = computeWalkinAvailability({
      scheduleExtension,
      timezone,
      timeNow,
      scheduleOwner: location('inactive'),
    });
    expect(result.walkinOpen).toBe(false);
    expect(result.officeOpen).toBe(false);
    expect(result.prebookStillOpenForToday).toBe(false);
  });

  it.each([['active' as const], [undefined]])('keeps a Location with status %s open within open hours', (status) => {
    const result = computeWalkinAvailability({ scheduleExtension, timezone, timeNow, scheduleOwner: location(status) });
    expect(result.walkinOpen).toBe(true);
    expect(result.officeOpen).toBe(true);
    expect(result.prebookStillOpenForToday).toBe(true);
  });

  it('does not judge non-Location owners by Location status', () => {
    const owner: PractitionerRole = { resourceType: 'PractitionerRole', id: 'pr-1', active: true };
    const result = computeWalkinAvailability({ scheduleExtension, timezone, timeNow, scheduleOwner: owner });
    expect(result.walkinOpen).toBe(true);
    expect(result.officeOpen).toBe(true);
  });

  it('still reports closed outside open hours for an active Location', () => {
    const result = computeWalkinAvailability({
      scheduleExtension: buildSimpleScheduleExt({ open: 8, close: 10 }),
      timezone,
      timeNow,
      scheduleOwner: location('active'),
    });
    expect(result.walkinOpen).toBe(false);
    expect(result.officeOpen).toBe(false);
  });
});
