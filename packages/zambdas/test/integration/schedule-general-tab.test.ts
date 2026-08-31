import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Extension, Location, Practitioner, Schedule } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  PUBLIC_EXTENSION_BASE_URL,
  ROOM_EXTENSION_URL,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils/lib/fhir/constants';
import { ScheduleDTO } from 'utils/lib/utils/scheduleUtils';
import { assert } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import {
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  persistSchedule,
  tagForProcessId,
} from '../helpers/testScheduleUtils';

// update-schedule owns the *schedule-level* owner fields only: timezone (mirrored onto the
// owner) and slug (the owner's SLUG_SYSTEM identifier). The intrinsic Location fields
// (service modes, payment ids, rooms, name, description, address, telecom, reviewLink) moved
// to the update-location zambda — see update-location.test.ts. get-schedule still *reads* the
// Location fields, so the read coverage stays here.

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;
const FACILITY_GROUP_CODING: Extension = {
  url: LOCATION_FORM_EXTENSION_URL,
  valueCoding: {
    system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
    code: 'si',
    display: 'Site',
  },
};
const VIRTUAL_CODING: Extension = {
  url: LOCATION_FORM_EXTENSION_URL,
  valueCoding: {
    system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
    code: 'vi',
    display: 'Virtual',
  },
};

const findExtension = (resource: { extension?: Extension[] }, url: string): Extension | undefined =>
  (resource.extension ?? []).find((ext) => ext.url === url);

const makePhysicalLocation = (slug: string, extraExtensions: Extension[] = []): Location => ({
  resourceType: 'Location',
  status: 'active',
  name: `Schedule General Tab Test ${slug}`,
  description: 'Integration test location for schedule general tab',
  identifier: [{ system: SLUG_SYSTEM, value: slug }],
  address: {
    use: 'work',
    type: 'physical',
    line: ['1 Test Way'],
    city: 'Test City',
    state: 'NY',
    postalCode: '10001',
  },
  extension: extraExtensions,
});

describe('schedule zambdas — timezone & slug (general tab)', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/schedule-general-tab.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;
  }, 120_000);

  afterAll(async () => {
    if (oystehrAdmin && processId) {
      await cleanupTestScheduleResources(processId, oystehrAdmin);
    }
  });

  const persistLocationAndSchedule = async (
    location: Location
  ): Promise<{ schedule: Schedule; location: Location }> => {
    const { schedule, owner } = await persistSchedule(
      { scheduleExtension: DEFAULT_SCHEDULE_JSON, processId, scheduleOwner: location },
      oystehrAdmin
    );
    assert(schedule.id);
    assert(owner && owner.resourceType === 'Location');
    return { schedule, location: owner as Location };
  };

  const callGetSchedule = async (scheduleId: string): Promise<ScheduleDTO> => {
    const response = await oystehrTestUserM2M.zambda.execute({
      id: 'ehr-get-schedule',
      scheduleId,
    });
    return response.output as ScheduleDTO;
  };

  const callUpdateSchedule = async (payload: Record<string, unknown>): Promise<{ output: Schedule }> => {
    const response = await oystehrTestUserM2M.zambda.execute(payload as any);
    return { output: response.output as Schedule };
  };

  const readLocation = async (id: string): Promise<Location> =>
    oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id });

  describe('ehr-get-schedule — reads new owner fields', () => {
    it('returns all new fields when Location has every extension populated', async () => {
      const slug = `gentab-get-full-${randomUUID()}`;
      const baseLocation = makePhysicalLocation(slug, [
        VIRTUAL_CODING,
        { url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: 'acct_test_full' },
        { url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL, valueString: 'advapacs_test_full' },
        { url: ROOM_EXTENSION_URL, valueString: 'A' },
        { url: ROOM_EXTENSION_URL, valueString: 'B' },
        { url: ROOM_EXTENSION_URL, valueString: 'C' },
      ]);
      const { schedule } = await persistLocationAndSchedule(baseLocation);

      const dto = await callGetSchedule(schedule.id!);

      expect(dto.owner.type).toBe('Location');
      expect(dto.owner.isVirtual).toBe(true);
      expect(dto.owner.stripeAccountId).toBe('acct_test_full');
      expect(dto.owner.advapacsLocationId).toBe('advapacs_test_full');
      expect(dto.owner.rooms).toEqual(['A', 'B', 'C']);
    });

    it('returns isVirtual=false and no payment fields when Location is a plain physical location', async () => {
      const slug = `gentab-get-plain-${randomUUID()}`;
      const baseLocation = makePhysicalLocation(slug);
      const { schedule } = await persistLocationAndSchedule(baseLocation);

      const dto = await callGetSchedule(schedule.id!);

      expect(dto.owner.isVirtual).toBe(false);
      expect(dto.owner.stripeAccountId).toBeUndefined();
      expect(dto.owner.advapacsLocationId).toBeUndefined();
      // rooms is either [] or undefined depending on whether extension array existed; both mean "no rooms"
      expect(dto.owner.rooms ?? []).toEqual([]);
    });

    it('returns isVirtual=false for a facility-group (si) Location', async () => {
      const slug = `gentab-get-facility-${randomUUID()}`;
      const baseLocation = makePhysicalLocation(slug, [FACILITY_GROUP_CODING]);
      const { schedule } = await persistLocationAndSchedule(baseLocation);

      const dto = await callGetSchedule(schedule.id!);

      expect(dto.owner.isVirtual).toBe(false);
    });
  });

  describe('update-schedule — timezone', () => {
    it('writes the timezone onto the Schedule resource', async () => {
      const slug = `gentab-tz-schedule-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
        slug,
      });

      const refreshedSchedule = await oystehrAdmin.fhir.get<Schedule>({
        resourceType: 'Schedule',
        id: schedule.id!,
      });
      const tz = findExtension(refreshedSchedule, TIMEZONE_EXTENSION_URL)?.valueString;
      expect(tz).toBe('America/Chicago');
    });

    it('mirrors the timezone onto a Location owner', async () => {
      const slug = `gentab-tz-owner-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
        slug,
      });

      const refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, TIMEZONE_EXTENSION_URL)?.valueString).toBe('America/Chicago');
    });
  });

  describe('update-schedule — slug (Location.identifier with SLUG_SYSTEM)', () => {
    const findSlugIdentifiers = (loc: Location): { system?: string; value?: string }[] =>
      (loc.identifier ?? []).filter((id) => id.system === SLUG_SYSTEM);

    it('replaces the existing slug identifier (no duplicates left behind)', async () => {
      const originalSlug = `gentab-slug-replace-old-${randomUUID()}`;
      const newSlug = `gentab-slug-replace-new-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(originalSlug));

      // Sanity-check the starting state.
      expect(findSlugIdentifiers(location)).toEqual([{ system: SLUG_SYSTEM, value: originalSlug }]);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug: newSlug,
      });

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(newSlug);
    });

    it('adds a slug identifier when the Location had none', async () => {
      const newSlug = `gentab-slug-fresh-${randomUUID()}`;
      // Start from a Location with no identifiers at all.
      const baseLocation: Location = {
        ...makePhysicalLocation('placeholder-unused'),
        identifier: undefined,
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);
      expect(findSlugIdentifiers(location)).toEqual([]);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug: newSlug,
      });

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(newSlug);
    });

    it('preserves non-slug identifiers (other identifier systems are untouched)', async () => {
      const slug = `gentab-slug-preserve-others-${randomUUID()}`;
      const otherSystem = 'https://identifiers.fhir.oystehr.com/lab-account-number';
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        identifier: [
          { system: SLUG_SYSTEM, value: slug },
          { system: otherSystem, value: 'LAB-12345' },
        ],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug: `${slug}-updated`,
      });

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(`${slug}-updated`);

      const otherIdentifier = (refreshed.identifier ?? []).find((id) => id.system === otherSystem);
      expect(otherIdentifier?.value).toBe('LAB-12345');
    });

    it('clears the slug identifier when slug is sent as an empty string', async () => {
      const slug = `gentab-slug-clear-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug: '',
        timezone: 'America/New_York', // ensure the owner-update block still runs
      });

      const refreshed = await readLocation(location.id!);
      expect(findSlugIdentifiers(refreshed)).toEqual([]);
    });

    it('stays stable across repeated updates with the same slug (no duplicates accumulate)', async () => {
      const slug = `gentab-slug-stable-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      for (let i = 0; i < 3; i++) {
        await callUpdateSchedule({
          id: 'update-schedule',
          scheduleId: schedule.id!,
          slug,
          timezone: 'America/New_York',
        });
      }

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(slug);
    });

    it('round-trips slug via ehr-get-schedule', async () => {
      const original = `gentab-slug-roundtrip-${randomUUID()}`;
      const updated = `${original}-v2`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(original));

      const beforeDto = await callGetSchedule(schedule.id!);
      expect(beforeDto.owner.slug).toBe(original);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug: updated,
      });

      const afterDto = await callGetSchedule(schedule.id!);
      expect(afterDto.owner.slug).toBe(updated);
    });

    it('saves slug on a Practitioner schedule owner too (slug is not Location-only)', async () => {
      const slug = `gentab-slug-practitioner-${randomUUID()}`;
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ family: 'SlugTest', given: ['Pract'] }],
        meta: {
          tag: [
            {
              system: 'OTTEHR_AUTOMATED_TEST',
              code: tagForProcessId(processId),
              display: 'integration test practitioner',
            },
          ],
        },
      });
      assert(practitioner.id);

      const scheduleResource = await oystehrAdmin.fhir.create<Schedule>({
        resourceType: 'Schedule',
        active: true,
        actor: [{ reference: `Practitioner/${practitioner.id}` }],
        extension: [
          {
            url: 'https://fhir.zapehr.com/r4/StructureDefinitions/schedule',
            valueString: JSON.stringify(DEFAULT_SCHEDULE_JSON),
          },
          { url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' },
        ],
        meta: {
          tag: [
            {
              system: 'OTTEHR_AUTOMATED_TEST',
              code: tagForProcessId(processId),
              display: 'integration test schedule',
            },
          ],
        },
      });
      assert(scheduleResource.id);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: scheduleResource.id!,
        slug,
      });

      const refreshed = await oystehrAdmin.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitioner.id!,
      });
      const slugIdentifiers = (refreshed.identifier ?? []).filter((id) => id.system === SLUG_SYSTEM);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(slug);
    });
  });

  describe('update-schedule — validation', () => {
    let validScheduleId: string;
    let validSlug: string;

    beforeAll(async () => {
      validSlug = `gentab-validation-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(validSlug));
      validScheduleId = schedule.id!;
    });

    it('rejects an empty-string timezone (would otherwise silently wipe the existing value)', async () => {
      await expect(
        oystehrTestUserM2M.zambda.execute({
          id: 'update-schedule',
          scheduleId: validScheduleId,
          timezone: '',
        } as any)
      ).rejects.toThrow();
    });

    it('rejects a non-string slug (null/number)', async () => {
      await expect(
        oystehrTestUserM2M.zambda.execute({
          id: 'update-schedule',
          scheduleId: validScheduleId,
          slug: 42,
        } as any)
      ).rejects.toThrow();
      await expect(
        oystehrTestUserM2M.zambda.execute({
          id: 'update-schedule',
          scheduleId: validScheduleId,
          slug: null,
        } as any)
      ).rejects.toThrow();
    });
  });
});
