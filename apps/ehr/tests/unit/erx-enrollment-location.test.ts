import { ListScheduleOwnersResponse, ScheduleListItem } from 'utils/lib/types/api/schedules';
import { describe, expect, test } from 'vitest';
import { pickEnrollmentLocationId } from '../../src/features/visits/shared/hooks/useEnrollSurescriptsPractitioner';

const schedule = (locationId: string, locationName: string, active = true): ScheduleListItem => ({
  resourceType: 'Schedule',
  id: `schedule-${locationId}`,
  timezone: 'America/New_York',
  locationId,
  locationName,
  active,
});

const providers = (practitionerId: string, schedules: ScheduleListItem[]): ListScheduleOwnersResponse => ({
  list: [{ owner: { resourceType: 'Practitioner', id: practitionerId, name: 'Dr Test' }, schedules }],
});

const activeLocations = {
  locations: [
    { id: 'loc-first', name: 'Zeta Clinic' },
    { id: 'loc-a', name: 'Alpha Clinic' },
    { id: 'loc-b', name: 'Beta Clinic' },
  ],
};

describe('pickEnrollmentLocationId', () => {
  test("picks the provider's active schedule location first by location name", () => {
    const list = providers('me', [schedule('loc-b', 'Beta Clinic'), schedule('loc-a', 'Alpha Clinic')]);
    expect(pickEnrollmentLocationId('me', list, activeLocations)).toBe('loc-a');
  });

  test('skips inactive schedules and schedules at inactive locations', () => {
    const list = providers('me', [
      schedule('loc-a', 'Alpha Clinic', false),
      schedule('loc-gone', 'Aardvark Clinic'),
      schedule('loc-b', 'Beta Clinic'),
    ]);
    expect(pickEnrollmentLocationId('me', list, activeLocations)).toBe('loc-b');
  });

  test("ignores another provider's schedules and falls back to the practice's first active location", () => {
    const list = providers('someone-else', [schedule('loc-a', 'Alpha Clinic')]);
    expect(pickEnrollmentLocationId('me', list, activeLocations)).toBe('loc-first');
  });

  test('returns undefined when the practice has no active location', () => {
    expect(pickEnrollmentLocationId('me', { list: [] }, { locations: [] })).toBeUndefined();
  });
});
