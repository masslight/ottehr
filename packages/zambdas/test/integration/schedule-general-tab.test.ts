import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Extension, Location, Practitioner, Schedule } from 'fhir/r4b';
import {
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  M2MClientMockType,
  PUBLIC_EXTENSION_BASE_URL,
  RoleType,
  ROOM_EXTENSION_URL,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  ScheduleDTO,
  SLUG_SYSTEM,
  TIMEZONE_EXTENSION_URL,
} from 'utils';
import { assert } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import {
  cleanupTestScheduleResources,
  DEFAULT_SCHEDULE_JSON,
  persistSchedule,
  tagForProcessId,
} from '../helpers/testScheduleUtils';

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

const findExtensions = (resource: { extension?: Extension[] }, url: string): Extension[] =>
  (resource.extension ?? []).filter((ext) => ext.url === url);

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

describe('schedule zambdas — general tab fields', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/schedule-general-tab.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;

    // The Stripe/Advapacs zambda paths require the caller to have CustomerSupport role.
    // setupIntegrationTest provisions the test M2M with Provider only — grant CustomerSupport here
    // so this test file can exercise the payment-field paths. (Idempotent across reruns.)
    const m2mList = (await oystehrAdmin.m2m.listV2({ name: 'integration/schedule-general-tab.test.ts' })).data;
    if (m2mList.length > 0) {
      const testM2M = await oystehrAdmin.m2m.get({ id: m2mList[0].id });
      const existingRoleIds = (testM2M.roles ?? []).map((role) => role.id);
      const allRoles = await oystehrAdmin.role.list();
      const customerSupportRole = allRoles.find((role) => role.name === RoleType.CustomerSupport);
      if (customerSupportRole && !existingRoleIds.includes(customerSupportRole.id)) {
        await oystehrAdmin.m2m.update({
          id: testM2M.id,
          roles: [...existingRoleIds, customerSupportRole.id],
        });
      }
    }
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

  const callUpdateSchedule = async (
    payload: Record<string, unknown>
  ): Promise<{ output: Schedule; statusCode: number }> => {
    const response = await oystehrTestUserM2M.zambda.execute(payload as any);
    return {
      output: response.output as Schedule,
      statusCode: (response as any).statusCode ?? 200,
    };
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

  describe('update-schedule — writes Location extensions', () => {
    it('adds the virtual coding when isVirtual=true and the Location had none', async () => {
      const slug = `gentab-isvirt-add-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        isVirtual: true,
      });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts).toHaveLength(1);
      expect(formExts[0]?.valueCoding?.code).toBe('vi');
    });

    it('removes the virtual coding when isVirtual=false and Location currently has it', async () => {
      const slug = `gentab-isvirt-remove-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug, [VIRTUAL_CODING]));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        isVirtual: false,
      });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts.filter((e) => e.valueCoding?.code === 'vi')).toHaveLength(0);
    });

    it('preserves a facility-group (si) coding when only the virtual (vi) coding is being removed', async () => {
      const slug = `gentab-keep-si-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(
        makePhysicalLocation(slug, [FACILITY_GROUP_CODING, VIRTUAL_CODING])
      );

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        isVirtual: false,
      });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts).toHaveLength(1);
      expect(formExts[0]?.valueCoding?.code).toBe('si');
    });

    it('writes a non-empty stripe account id and clears it when an empty string is sent', async () => {
      const slug = `gentab-stripe-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      // Add
      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        stripeAccountId: 'acct_xyz_123',
      });
      let refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString).toBe('acct_xyz_123');

      // Clear (CustomerSupport flow when field is emptied)
      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        stripeAccountId: '',
      });
      refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)).toBeUndefined();
    });

    it('writes a non-empty advapacs location id and clears it when an empty string is sent', async () => {
      const slug = `gentab-advapacs-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        advapacsLocationId: 'advapacs_xyz',
      });
      let refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)?.valueString).toBe(
        'advapacs_xyz'
      );

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        advapacsLocationId: '',
      });
      refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)).toBeUndefined();
    });

    it('treats whitespace-only stripe/advapacs values as empty (extension is not written)', async () => {
      const slug = `gentab-whitespace-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        stripeAccountId: '   ',
        advapacsLocationId: '\t\n',
      });

      const refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)).toBeUndefined();
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)).toBeUndefined();
      // Make sure we never wrote a value-less or empty-string extension.
      (refreshed.extension ?? []).forEach((ext) => {
        if (ext.url === SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL) {
          expect(ext.valueString).not.toBe('');
        }
      });
    });

    it('writes rooms as one extension per room, replacing existing rooms on each update', async () => {
      const slug = `gentab-rooms-replace-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(
        makePhysicalLocation(slug, [
          { url: ROOM_EXTENSION_URL, valueString: 'old-1' },
          { url: ROOM_EXTENSION_URL, valueString: 'old-2' },
        ])
      );

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        rooms: ['new-1', 'new-2', 'new-3'],
      });

      const refreshed = await readLocation(location.id!);
      const rooms = findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString);
      expect(rooms).toEqual(['new-1', 'new-2', 'new-3']);
    });

    it('clears all room extensions when rooms=[]', async () => {
      const slug = `gentab-rooms-empty-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(
        makePhysicalLocation(slug, [
          { url: ROOM_EXTENSION_URL, valueString: 'a' },
          { url: ROOM_EXTENSION_URL, valueString: 'b' },
        ])
      );

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        rooms: [],
      });

      const refreshed = await readLocation(location.id!);
      expect(findExtensions(refreshed, ROOM_EXTENSION_URL)).toHaveLength(0);
    });

    it('skips blank/whitespace-only room names (no empty extensions are written)', async () => {
      const slug = `gentab-rooms-blank-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        rooms: ['Room 1', '', '   ', '\t', 'Room 2'],
      });

      const refreshed = await readLocation(location.id!);
      const rooms = findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString);
      expect(rooms).toEqual(['Room 1', 'Room 2']);
      rooms.forEach((value) => expect(value && value.trim()).not.toBe(''));
    });

    it('preserves existing stripe/advapacs when their params are not sent (Administrator save flow)', async () => {
      const slug = `gentab-admin-noop-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(
        makePhysicalLocation(slug, [
          { url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: 'acct_keep_me' },
          { url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL, valueString: 'advapacs_keep_me' },
          { url: ROOM_EXTENSION_URL, valueString: 'Room A' },
        ])
      );

      // Administrator-style save: only sends fields they can edit (timezone/slug + rooms + isVirtual).
      // The frontend never sends stripeAccountId/advapacsLocationId in this flow.
      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        timezone: 'America/New_York',
        isVirtual: false,
        rooms: ['Room A', 'Room B'],
      });

      const refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString).toBe('acct_keep_me');
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)?.valueString).toBe(
        'advapacs_keep_me'
      );
      expect(findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString)).toEqual(['Room A', 'Room B']);
    });

    it('updates the Schedule resource (timezone) even when only Location-specific fields change', async () => {
      const slug = `gentab-tz-passthrough-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
        slug,
        rooms: ['only-room'],
      });

      const refreshedSchedule = await oystehrAdmin.fhir.get<Schedule>({
        resourceType: 'Schedule',
        id: schedule.id!,
      });
      const tz = findExtension(refreshedSchedule, TIMEZONE_EXTENSION_URL)?.valueString;
      expect(tz).toBe('America/Chicago');
    });

    it('does not touch Location-specific extensions when the schedule owner is a Practitioner', async () => {
      // Create a Practitioner owner with no extensions, then a Schedule pointing at it.
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ family: 'Test', given: ['GenTab'] }],
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
        timezone: 'America/Chicago',
        // these should be no-ops for a Practitioner owner
        isVirtual: true,
        stripeAccountId: 'acct_should_not_be_written',
        advapacsLocationId: 'advapacs_should_not_be_written',
        rooms: ['x', 'y'],
      });

      const refreshed = await oystehrAdmin.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitioner.id!,
      });

      // Practitioner must NOT have gained any of the Location-only extensions.
      expect(findExtension(refreshed, LOCATION_FORM_EXTENSION_URL)).toBeUndefined();
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)).toBeUndefined();
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)).toBeUndefined();
      expect(findExtensions(refreshed, ROOM_EXTENSION_URL)).toHaveLength(0);

      // But timezone (which applies to all owners) should have been written.
      expect(findExtension(refreshed, TIMEZONE_EXTENSION_URL)?.valueString).toBe('America/Chicago');
    });

    it('never writes empty-string valueString for any owner extension', async () => {
      // This is a "belt and suspenders" check covering several edge cases at once.
      const slug = `gentab-no-empty-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        stripeAccountId: '',
        advapacsLocationId: '',
        rooms: ['', '  ', '\n'],
        isVirtual: false,
      });

      const refreshed = await readLocation(location.id!);
      (refreshed.extension ?? []).forEach((ext) => {
        if (typeof ext.valueString === 'string') {
          expect(ext.valueString.trim()).not.toBe('');
        }
      });
    });

    it('round-trips through get-schedule after an update', async () => {
      const slug = `gentab-roundtrip-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        slug,
        isVirtual: true,
        stripeAccountId: 'acct_roundtrip',
        advapacsLocationId: 'advapacs_roundtrip',
        rooms: ['R1', 'R2'],
      });

      const dto = await callGetSchedule(schedule.id!);
      expect(dto.owner.slug).toBe(slug);
      expect(dto.owner.isVirtual).toBe(true);
      expect(dto.owner.stripeAccountId).toBe('acct_roundtrip');
      expect(dto.owner.advapacsLocationId).toBe('advapacs_roundtrip');
      expect(dto.owner.rooms).toEqual(['R1', 'R2']);
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

  describe('update-schedule — name (Location.name)', () => {
    it('renames a Location through update-schedule', async () => {
      const slug = `gentab-name-rename-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      expect(location.name).toBeDefined();

      const newName = `Renamed Location ${randomUUID()}`;
      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        name: newName,
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe(newName);
    });

    it('round-trips name through ehr-get-schedule', async () => {
      const slug = `gentab-name-roundtrip-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      const newName = `Round-trip Location ${randomUUID()}`;
      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        name: newName,
      });

      const dto = await callGetSchedule(schedule.id!);
      expect(dto.owner.name).toBe(newName);
    });

    it('preserves owner timezone/slug when only "name" is updated (no silent wipes)', async () => {
      const slug = `gentab-name-preserves-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      const originalTimezoneExt = (location.extension ?? []).find((ext) => ext.url === TIMEZONE_EXTENSION_URL);
      const originalSlugIdentifier = (location.identifier ?? []).find((id) => id.system === SLUG_SYSTEM);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        name: 'Renamed but timezone & slug must survive',
      });

      const refreshed = await readLocation(location.id!);
      const refreshedTimezoneExt = (refreshed.extension ?? []).find((ext) => ext.url === TIMEZONE_EXTENSION_URL);
      const refreshedSlugIdentifier = (refreshed.identifier ?? []).find((id) => id.system === SLUG_SYSTEM);
      expect(refreshedTimezoneExt?.valueString).toBe(originalTimezoneExt?.valueString);
      expect(refreshedSlugIdentifier?.value).toBe(originalSlugIdentifier?.value);
    });

    it('trims whitespace around the new name before saving', async () => {
      const slug = `gentab-name-trim-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        name: '   Padded Name   ',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe('Padded Name');
    });

    it('does not touch name when the field is not sent', async () => {
      const slug = `gentab-name-untouched-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      const originalName = location.name;

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe(originalName);
    });

    it('does not write Practitioner.name (HumanName[]) when name is sent for a Practitioner schedule', async () => {
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ family: 'NameUntouched', given: ['Original'] }],
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
        name: 'String name that must not be applied to a HumanName[]',
      });

      const refreshed = await oystehrAdmin.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitioner.id!,
      });
      // HumanName[] should be preserved as-is.
      expect(refreshed.name).toEqual([{ family: 'NameUntouched', given: ['Original'] }]);
    });

    it('does not bump the Practitioner version when only "name" is sent (no other updates)', async () => {
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ family: 'NoBump', given: ['Should'] }],
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

      const beforeVersion = (
        await oystehrAdmin.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitioner.id! })
      ).meta?.versionId;

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: scheduleResource.id!,
        // ONLY name — nothing else. For a non-Location owner this should be a no-op
        // (name editing isn't supported for Practitioners and we shouldn't bump the version).
        name: 'A name that must be ignored',
      });

      const afterVersion = (
        await oystehrAdmin.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitioner.id! })
      ).meta?.versionId;
      expect(afterVersion).toBe(beforeVersion);
    });
  });

  describe('update-schedule — description (Location.description)', () => {
    it('adds a description on a Location that had none', async () => {
      const slug = `gentab-desc-add-${randomUUID()}`;
      const baseLocation = makePhysicalLocation(slug);
      delete baseLocation.description;
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);
      expect(location.description).toBeUndefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        description: 'Walk-in clinic, north entrance',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe('Walk-in clinic, north entrance');
    });

    it('replaces an existing description', async () => {
      const slug = `gentab-desc-replace-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        description: 'Updated description text',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe('Updated description text');
    });

    it('clears the description when sent as an empty string', async () => {
      const slug = `gentab-desc-clear-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      expect(location.description).toBeDefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        description: '',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBeUndefined();
    });

    it('clears the description when sent as null', async () => {
      const slug = `gentab-desc-null-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        description: null,
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBeUndefined();
    });

    it('does not touch description when the field is not sent', async () => {
      const slug = `gentab-desc-untouched-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      const originalDescription = location.description;

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe(originalDescription);
    });
  });

  describe('update-schedule — address (Location.address)', () => {
    it('writes a fully-populated address with auto-filled use/type', async () => {
      const slug = `gentab-addr-full-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: {
          line: ['813 Washington Ave'],
          city: 'Iowa Falls',
          state: 'IA',
          postalCode: '50126',
        },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toEqual({
        use: 'work',
        type: 'physical',
        line: ['813 Washington Ave'],
        city: 'Iowa Falls',
        state: 'IA',
        postalCode: '50126',
      });
    });

    it('removes the address field entirely when all sub-fields are empty', async () => {
      const slug = `gentab-addr-empty-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      expect(location.address).toBeDefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: { line: [''], city: '', state: '', postalCode: '' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toBeUndefined();
    });

    it('removes the address field when sent as null', async () => {
      const slug = `gentab-addr-null-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: null,
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toBeUndefined();
    });

    it('keeps a partial address (e.g. only state) and drops empty sub-fields', async () => {
      const slug = `gentab-addr-partial-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: { line: [''], city: '   ', state: 'NJ', postalCode: '' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address?.state).toBe('NJ');
      expect(refreshed.address?.line).toBeUndefined();
      expect(refreshed.address?.city).toBeUndefined();
      expect(refreshed.address?.postalCode).toBeUndefined();
      expect(refreshed.address?.use).toBe('work');
      expect(refreshed.address?.type).toBe('physical');
    });

    it('trims whitespace around address sub-fields', async () => {
      const slug = `gentab-addr-trim-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: {
          line: ['  100 Main St  '],
          city: '  Townsville ',
          state: ' NY ',
          postalCode: ' 10001 ',
        },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address?.line).toEqual(['100 Main St']);
      expect(refreshed.address?.city).toBe('Townsville');
      expect(refreshed.address?.state).toBe('NY');
      expect(refreshed.address?.postalCode).toBe('10001');
    });

    it('does not touch address when the field is not sent', async () => {
      const slug = `gentab-addr-untouched-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      const originalAddress = location.address;

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toEqual(originalAddress);
    });

    it('round-trips address through ehr-get-schedule', async () => {
      const slug = `gentab-addr-roundtrip-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        address: {
          line: ['42 Galaxy Way'],
          city: 'Earth',
          state: 'CA',
          postalCode: '94000',
        },
      });

      const dto = await callGetSchedule(schedule.id!);
      expect(dto.owner.address).toEqual({
        use: 'work',
        type: 'physical',
        line: ['42 Galaxy Way'],
        city: 'Earth',
        state: 'CA',
        postalCode: '94000',
      });
    });
  });

  describe('update-schedule — telecom (Location.telecom)', () => {
    it('writes phone, url, and fax entries with use=work', async () => {
      const slug = `gentab-telecom-full-${randomUUID()}`;
      const baseLocation = makePhysicalLocation(slug);
      delete baseLocation.telecom;
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);
      expect(location.telecom).toBeUndefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '1234567890', url: 'https://example.com', fax: '6412060429' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toEqual([
        { system: 'phone', use: 'work', value: '1234567890' },
        { system: 'url', use: 'work', value: 'https://example.com' },
        { system: 'fax', use: 'work', value: '6412060429' },
      ]);
    });

    it('replaces phone/url/fax entries on subsequent update without duplicating them', async () => {
      const slug = `gentab-telecom-replace-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        telecom: [
          { system: 'phone', use: 'work', value: 'OLD-PHONE' },
          { system: 'url', use: 'work', value: 'https://old.example.com' },
        ],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: 'NEW-PHONE', url: 'https://new.example.com', fax: 'NEW-FAX' },
      });

      const refreshed = await readLocation(location.id!);
      const phoneEntries = (refreshed.telecom ?? []).filter((cp) => cp.system === 'phone');
      const urlEntries = (refreshed.telecom ?? []).filter((cp) => cp.system === 'url');
      const faxEntries = (refreshed.telecom ?? []).filter((cp) => cp.system === 'fax');
      expect(phoneEntries).toEqual([{ system: 'phone', use: 'work', value: 'NEW-PHONE' }]);
      expect(urlEntries).toEqual([{ system: 'url', use: 'work', value: 'https://new.example.com' }]);
      expect(faxEntries).toEqual([{ system: 'fax', use: 'work', value: 'NEW-FAX' }]);
    });

    it('clears one entry while keeping the others when a single sub-field is empty', async () => {
      const slug = `gentab-telecom-clear-one-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '5551234567', url: '', fax: '4441112222' },
      });

      const refreshed = await readLocation(location.id!);
      expect((refreshed.telecom ?? []).map((cp) => cp.system).sort()).toEqual(['fax', 'phone']);
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'url')).toBeUndefined();
    });

    it('removes telecom entirely when all three sub-fields are empty', async () => {
      const slug = `gentab-telecom-all-empty-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        telecom: [
          { system: 'phone', use: 'work', value: '5551234567' },
          { system: 'url', use: 'work', value: 'https://example.com' },
          { system: 'fax', use: 'work', value: '5559876543' },
        ],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);
      expect(location.telecom).toBeDefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '', url: '', fax: '' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('removes telecom entirely when sent as null', async () => {
      const slug = `gentab-telecom-null-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: null,
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('trims whitespace around telecom values', async () => {
      const slug = `gentab-telecom-trim-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '  555-0123  ', url: ' https://trim.example.com ', fax: '\t777-9999\n' },
      });

      const refreshed = await readLocation(location.id!);
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'phone')?.value).toBe('555-0123');
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'url')?.value).toBe('https://trim.example.com');
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'fax')?.value).toBe('777-9999');
    });

    it('treats whitespace-only sub-fields as empty (no empty entries are written)', async () => {
      const slug = `gentab-telecom-ws-only-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '   ', url: '\t\n', fax: '' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('preserves non-phone/url/fax telecom entries (e.g., sms)', async () => {
      const slug = `gentab-telecom-preserve-others-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        telecom: [
          { system: 'phone', use: 'work', value: 'PHONE-OLD' },
          { system: 'sms', use: 'work', value: '+15551239876' },
          { system: 'email', use: 'work', value: 'office@example.com' },
        ],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: 'PHONE-NEW', url: 'https://x.test', fax: '' },
      });

      const refreshed = await readLocation(location.id!);
      const bySystem = Object.fromEntries((refreshed.telecom ?? []).map((cp) => [cp.system, cp.value]));
      expect(bySystem.phone).toBe('PHONE-NEW');
      expect(bySystem.url).toBe('https://x.test');
      expect(bySystem.fax).toBeUndefined();
      // Non-managed systems must survive.
      expect(bySystem.sms).toBe('+15551239876');
      expect(bySystem.email).toBe('office@example.com');
    });

    it('does not touch telecom when the field is not sent', async () => {
      const slug = `gentab-telecom-untouched-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        telecom: [
          { system: 'phone', use: 'work', value: '5550001111' },
          { system: 'fax', use: 'work', value: '5552223333' },
        ],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);
      const originalTelecom = location.telecom;
      expect(originalTelecom).toBeDefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toEqual(originalTelecom);
    });

    it('round-trips telecom through ehr-get-schedule', async () => {
      const slug = `gentab-telecom-roundtrip-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        telecom: { phone: '999-0000', url: 'https://rt.example', fax: '888-1111' },
      });

      const dto = await callGetSchedule(schedule.id!);
      const bySystem = Object.fromEntries((dto.owner.telecom ?? []).map((cp) => [cp.system, cp.value]));
      expect(bySystem.phone).toBe('999-0000');
      expect(bySystem.url).toBe('https://rt.example');
      expect(bySystem.fax).toBe('888-1111');
    });
  });

  describe('update-schedule — reviewLink (Location review-link extension)', () => {
    const findReviewExt = (loc: Location): Extension | undefined =>
      (loc.extension ?? []).find((ext) => ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL);

    it('writes the review-link extension as valueUrl', async () => {
      const slug = `gentab-review-add-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));
      expect(findReviewExt(location)).toBeUndefined();

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: 'https://g.page/r/sample-google-review',
      });

      const refreshed = await readLocation(location.id!);
      const ext = findReviewExt(refreshed);
      expect(ext).toBeDefined();
      expect(ext?.valueUrl).toBe('https://g.page/r/sample-google-review');
    });

    it('replaces an existing review-link without duplicating the extension', async () => {
      const slug = `gentab-review-replace-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://old.example/review' }],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: 'https://g.page/r/new-google-review',
      });

      const refreshed = await readLocation(location.id!);
      const matching = (refreshed.extension ?? []).filter((e) => e.url === LOCATION_REVIEW_LINK_EXTENSION_URL);
      expect(matching).toHaveLength(1);
      expect(matching[0]?.valueUrl).toBe('https://g.page/r/new-google-review');
    });

    it('removes the review-link extension when sent as an empty string', async () => {
      const slug = `gentab-review-clear-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://existing.example/review' }],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: '',
      });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('removes the review-link extension when sent as null', async () => {
      const slug = `gentab-review-null-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://existing.example/review' }],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: null,
      });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('trims whitespace before persisting', async () => {
      const slug = `gentab-review-trim-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: '   https://g.page/r/trimmed-review   ',
      });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)?.valueUrl).toBe('https://g.page/r/trimmed-review');
    });

    it('treats whitespace-only values as empty (no extension written)', async () => {
      const slug = `gentab-review-whitespace-${randomUUID()}`;
      const { schedule, location } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: '   \t\n',
      });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('does not touch the review-link when the field is not sent', async () => {
      const slug = `gentab-review-untouched-${randomUUID()}`;
      const baseLocation: Location = {
        ...makePhysicalLocation(slug),
        extension: [{ url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://keep.example/review' }],
      };
      const { schedule, location } = await persistLocationAndSchedule(baseLocation);

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        timezone: 'America/Chicago',
      });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)?.valueUrl).toBe('https://keep.example/review');
    });

    it('round-trips through ehr-get-schedule as owner.reviewLink', async () => {
      const slug = `gentab-review-roundtrip-${randomUUID()}`;
      const { schedule } = await persistLocationAndSchedule(makePhysicalLocation(slug));

      await callUpdateSchedule({
        id: 'update-schedule',
        scheduleId: schedule.id!,
        reviewLink: 'https://g.page/r/round-trip-review',
      });

      const dto = await callGetSchedule(schedule.id!);
      expect(dto.owner.reviewLink).toBe('https://g.page/r/round-trip-review');
    });

    it('is ignored for non-Location owners (Practitioner schedule)', async () => {
      const practitioner = await oystehrAdmin.fhir.create<Practitioner>({
        resourceType: 'Practitioner',
        name: [{ family: 'NoReviewLink', given: ['Ignore'] }],
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
        timezone: 'America/Chicago',
        reviewLink: 'https://should-not-be-written.example',
      });

      const refreshed = await oystehrAdmin.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitioner.id!,
      });
      const stray = (refreshed.extension ?? []).find((e) => e.url === LOCATION_REVIEW_LINK_EXTENSION_URL);
      expect(stray).toBeUndefined();
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

    const expectInvalidInputError = async (payload: Record<string, unknown>): Promise<void> => {
      await expect(
        oystehrTestUserM2M.zambda.execute({
          id: 'update-schedule',
          scheduleId: validScheduleId,
          slug: validSlug,
          ...payload,
        } as any)
      ).rejects.toThrow();
    };

    it('rejects non-boolean isVirtual', async () => {
      await expectInvalidInputError({ isVirtual: 'true' });
    });

    it('rejects non-string stripeAccountId', async () => {
      await expectInvalidInputError({ stripeAccountId: 123 });
    });

    it('rejects non-string advapacsLocationId', async () => {
      await expectInvalidInputError({ advapacsLocationId: { not: 'a string' } });
    });

    it('rejects rooms that is not an array', async () => {
      await expectInvalidInputError({ rooms: 'A,B,C' });
    });

    it('rejects rooms containing non-string entries', async () => {
      await expectInvalidInputError({ rooms: ['ok', 7] });
    });

    it('rejects non-string name', async () => {
      await expectInvalidInputError({ name: 42 });
    });

    it('rejects non-string description', async () => {
      await expectInvalidInputError({ description: { not: 'a string' } });
    });

    it('rejects non-object address', async () => {
      await expectInvalidInputError({ address: 'not an object' });
    });

    it('rejects address.line containing non-string entries', async () => {
      await expectInvalidInputError({ address: { line: [1, 2] } });
    });

    it('rejects non-string address.state', async () => {
      await expectInvalidInputError({ address: { state: 7 } });
    });

    it('rejects an empty-string timezone (would otherwise silently wipe the existing value)', async () => {
      // Override the default `slug: validSlug` since the helper merges it in; just supply timezone here.
      await expect(
        oystehrTestUserM2M.zambda.execute({
          id: 'update-schedule',
          scheduleId: validScheduleId,
          timezone: '',
        } as any)
      ).rejects.toThrow();
    });

    it('rejects a non-string slug (null/number)', async () => {
      await expectInvalidInputError({ slug: 42 });
      await expectInvalidInputError({ slug: null });
    });

    it('rejects a non-string reviewLink', async () => {
      await expectInvalidInputError({ reviewLink: 7 });
      await expectInvalidInputError({ reviewLink: { not: 'a string' } });
    });
  });
});
