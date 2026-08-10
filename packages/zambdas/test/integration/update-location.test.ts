import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { ContactPoint, Extension, Location } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  LOCATION_REVIEW_LINK_EXTENSION_URL,
  PUBLIC_EXTENSION_BASE_URL,
  ROOM_EXTENSION_URL,
  SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL,
  SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL,
  SLUG_SYSTEM,
} from 'utils/lib/fhir/constants';
import { LOCATION_IN_PERSON_CODE } from 'utils/lib/fhir/location';
import { RoleType } from 'utils/lib/types/api/user.types';
import { LOCATION_SUPPORT_PHONE_EXTENSION_URL } from 'utils/lib/utils/support-dialog';
import { assert } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';
import { tagForProcessId } from '../helpers/testScheduleUtils';

// These cases were migrated from schedule-general-tab.test.ts when the Location-field
// writing moved off update-schedule (which was coupled to a Schedule owner) onto the
// pure, Schedule-independent update-location zambda. Both call the same applyLocationFields
// helper, so the semantics carry over unchanged — the only intentional difference is that
// update-location's address sanitizer stamps country: 'US'.

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
const IN_PERSON_CODING: Extension = {
  url: LOCATION_FORM_EXTENSION_URL,
  valueCoding: {
    system: 'http://terminology.hl7.org/CodeSystem/location-physical-type',
    code: LOCATION_IN_PERSON_CODE,
    display: 'In Person',
  },
};

const findExtensions = (resource: { extension?: Extension[] }, url: string): Extension[] =>
  (resource.extension ?? []).filter((ext) => ext.url === url);

const findExtension = (resource: { extension?: Extension[] }, url: string): Extension | undefined =>
  (resource.extension ?? []).find((ext) => ext.url === url);

describe('update-location zambda — intrinsic Location fields', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/update-location.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;

    // The Stripe/Advapacs paths require the caller to have CustomerSupport role.
    // setupIntegrationTest provisions the test M2M with Provider only — grant CustomerSupport here
    // so this test file can exercise the payment-field paths. (Idempotent across reruns.)
    const m2mList = (await oystehrAdmin.m2m.listV2({ name: 'integration/update-location.test.ts' })).data;
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
    // update-location needs no Schedule, so these Locations are standalone and won't be
    // swept up by the Schedule-actor cleanup — delete anything tagged for this process.
    if (!oystehrAdmin || !processId) return;
    const locations = (
      await oystehrAdmin.fhir.search<Location>({
        resourceType: 'Location',
        params: [{ name: '_tag', value: tagForProcessId(processId) }],
      })
    ).unbundle();
    const requests = locations.filter((l) => l.id).map((l) => ({ method: 'DELETE' as const, url: `Location/${l.id}` }));
    if (requests.length > 0) {
      try {
        await oystehrAdmin.fhir.batch({ requests });
      } catch (error) {
        console.error('Error cleaning up test locations', error);
        console.log(`ProcessId ${processId} may need manual cleanup`);
      }
    }
  });

  const makePhysicalLocation = (
    slug: string,
    extraExtensions: Extension[] = [],
    overrides: Partial<Location> = {}
  ): Location => ({
    resourceType: 'Location',
    status: 'active',
    name: `Update Location Test ${slug}`,
    description: 'Integration test location for update-location',
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
    meta: {
      tag: [
        {
          system: 'OTTEHR_AUTOMATED_TEST',
          code: tagForProcessId(processId),
          display: 'integration test location',
        },
      ],
    },
    ...overrides,
  });

  const persistLocation = async (location: Location): Promise<Location> => {
    const created = await oystehrAdmin.fhir.create<Location>(location);
    assert(created.id);
    return created;
  };

  const callUpdateLocation = async (locationId: string, fields: Record<string, unknown>): Promise<Location> => {
    const response = await oystehrTestUserM2M.zambda.execute({
      id: 'update-location',
      locationId,
      ...fields,
    } as any);
    return response.output as Location;
  };

  const readLocation = async (id: string): Promise<Location> =>
    oystehrAdmin.fhir.get<Location>({ resourceType: 'Location', id });

  describe('service-mode codings (isVirtual / isInPerson)', () => {
    it('adds the virtual coding when isVirtual=true and the Location had none', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-isvirt-add-${randomUUID()}`));

      await callUpdateLocation(location.id!, { isVirtual: true });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts).toHaveLength(1);
      expect(formExts[0]?.valueCoding?.code).toBe('vi');
    });

    it('removes the virtual coding when isVirtual=false and Location currently has it', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-isvirt-remove-${randomUUID()}`, [VIRTUAL_CODING])
      );

      await callUpdateLocation(location.id!, { isVirtual: false });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts.filter((e) => e.valueCoding?.code === 'vi')).toHaveLength(0);
    });

    it('preserves a facility-group (si) coding when only the virtual (vi) coding is being removed', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-keep-si-${randomUUID()}`, [FACILITY_GROUP_CODING, VIRTUAL_CODING])
      );

      await callUpdateLocation(location.id!, { isVirtual: false });

      const refreshed = await readLocation(location.id!);
      const formExts = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL);
      expect(formExts).toHaveLength(1);
      expect(formExts[0]?.valueCoding?.code).toBe('si');
    });

    it('adds the in-person coding when isInPerson=true and removes it when false, independent of the virtual coding', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-inperson-${randomUUID()}`, [VIRTUAL_CODING]));

      // Turn on in-person; the virtual coding must survive (different code on the same URL).
      await callUpdateLocation(location.id!, { isInPerson: true });
      let refreshed = await readLocation(location.id!);
      let codes = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL)
        .map((e) => e.valueCoding?.code)
        .sort();
      expect(codes).toEqual([LOCATION_IN_PERSON_CODE, 'vi'].sort());

      // Turn off in-person; virtual still survives.
      await callUpdateLocation(location.id!, { isInPerson: false });
      refreshed = await readLocation(location.id!);
      codes = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL).map((e) => e.valueCoding?.code);
      expect(codes).toEqual(['vi']);
    });

    it('does not touch service-mode codings when neither flag is sent', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-mode-untouched-${randomUUID()}`, [IN_PERSON_CODING])
      );

      await callUpdateLocation(location.id!, { description: 'unrelated change' });

      const refreshed = await readLocation(location.id!);
      const codes = findExtensions(refreshed, LOCATION_FORM_EXTENSION_URL).map((e) => e.valueCoding?.code);
      expect(codes).toEqual([LOCATION_IN_PERSON_CODE]);
    });
  });

  describe('payment fields (stripe / advapacs)', () => {
    it('writes a non-empty stripe account id and clears it when an empty string is sent', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-stripe-${randomUUID()}`));

      await callUpdateLocation(location.id!, { stripeAccountId: 'acct_xyz_123' });
      let refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString).toBe('acct_xyz_123');

      await callUpdateLocation(location.id!, { stripeAccountId: '' });
      refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)).toBeUndefined();
    });

    it('writes a non-empty advapacs location id and clears it when an empty string is sent', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-advapacs-${randomUUID()}`));

      await callUpdateLocation(location.id!, { advapacsLocationId: 'advapacs_xyz' });
      let refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)?.valueString).toBe(
        'advapacs_xyz'
      );

      await callUpdateLocation(location.id!, { advapacsLocationId: '' });
      refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)).toBeUndefined();
    });

    it('treats whitespace-only stripe/advapacs values as empty (extension is not written)', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-whitespace-${randomUUID()}`));

      await callUpdateLocation(location.id!, { stripeAccountId: '   ', advapacsLocationId: '\t\n' });

      const refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)).toBeUndefined();
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)).toBeUndefined();
    });

    it('preserves existing stripe/advapacs when their params are not sent', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-payment-noop-${randomUUID()}`, [
          { url: SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL, valueString: 'acct_keep_me' },
          { url: SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL, valueString: 'advapacs_keep_me' },
          { url: ROOM_EXTENSION_URL, valueString: 'Room A' },
        ])
      );

      // A save that only touches rooms/isVirtual must not disturb the payment fields.
      await callUpdateLocation(location.id!, { isVirtual: false, rooms: ['Room A', 'Room B'] });

      const refreshed = await readLocation(location.id!);
      expect(findExtension(refreshed, SCHEDULE_OWNER_STRIPE_ACCOUNT_EXTENSION_URL)?.valueString).toBe('acct_keep_me');
      expect(findExtension(refreshed, SCHEDULE_OWNER_ADVAPACS_LOCATION_EXTENSION_URL)?.valueString).toBe(
        'advapacs_keep_me'
      );
      expect(findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString)).toEqual(['Room A', 'Room B']);
    });
  });

  describe('rooms', () => {
    it('writes rooms as one extension per room, replacing existing rooms on each update', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-rooms-replace-${randomUUID()}`, [
          { url: ROOM_EXTENSION_URL, valueString: 'old-1' },
          { url: ROOM_EXTENSION_URL, valueString: 'old-2' },
        ])
      );

      await callUpdateLocation(location.id!, { rooms: ['new-1', 'new-2', 'new-3'] });

      const refreshed = await readLocation(location.id!);
      const rooms = findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString);
      expect(rooms).toEqual(['new-1', 'new-2', 'new-3']);
    });

    it('clears all room extensions when rooms=[]', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-rooms-empty-${randomUUID()}`, [
          { url: ROOM_EXTENSION_URL, valueString: 'a' },
          { url: ROOM_EXTENSION_URL, valueString: 'b' },
        ])
      );

      await callUpdateLocation(location.id!, { rooms: [] });

      const refreshed = await readLocation(location.id!);
      expect(findExtensions(refreshed, ROOM_EXTENSION_URL)).toHaveLength(0);
    });

    it('skips blank/whitespace-only room names (no empty extensions are written)', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-rooms-blank-${randomUUID()}`));

      await callUpdateLocation(location.id!, { rooms: ['Room 1', '', '   ', '\t', 'Room 2'] });

      const refreshed = await readLocation(location.id!);
      const rooms = findExtensions(refreshed, ROOM_EXTENSION_URL).map((e) => e.valueString);
      expect(rooms).toEqual(['Room 1', 'Room 2']);
      rooms.forEach((value) => expect(value && value.trim()).not.toBe(''));
    });

    it('never writes empty-string valueString for any extension', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-no-empty-${randomUUID()}`));

      await callUpdateLocation(location.id!, {
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
  });

  describe('name (Location.name)', () => {
    it('renames a Location', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-name-rename-${randomUUID()}`));
      expect(location.name).toBeDefined();

      const newName = `Renamed Location ${randomUUID()}`;
      await callUpdateLocation(location.id!, { name: newName });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe(newName);
    });

    it('trims whitespace around the new name before saving', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-name-trim-${randomUUID()}`));

      await callUpdateLocation(location.id!, { name: '   Padded Name   ' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe('Padded Name');
    });

    it('clears the name when sent as an empty string', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-name-clear-${randomUUID()}`));
      expect(location.name).toBeDefined();

      await callUpdateLocation(location.id!, { name: '   ' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBeUndefined();
    });

    it('does not touch name when the field is not sent', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-name-untouched-${randomUUID()}`));
      const originalName = location.name;

      await callUpdateLocation(location.id!, { description: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.name).toBe(originalName);
    });
  });

  describe('description (Location.description)', () => {
    it('adds a description on a Location that had none', async () => {
      const baseLocation = makePhysicalLocation(`upd-desc-add-${randomUUID()}`);
      delete baseLocation.description;
      const location = await persistLocation(baseLocation);
      expect(location.description).toBeUndefined();

      await callUpdateLocation(location.id!, { description: 'Walk-in clinic, north entrance' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe('Walk-in clinic, north entrance');
    });

    it('replaces an existing description', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-desc-replace-${randomUUID()}`));

      await callUpdateLocation(location.id!, { description: 'Updated description text' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe('Updated description text');
    });

    it('clears the description when sent as an empty string', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-desc-clear-${randomUUID()}`));
      expect(location.description).toBeDefined();

      await callUpdateLocation(location.id!, { description: '' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBeUndefined();
    });

    it('clears the description when sent as null', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-desc-null-${randomUUID()}`));

      await callUpdateLocation(location.id!, { description: null });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBeUndefined();
    });

    it('does not touch description when the field is not sent', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-desc-untouched-${randomUUID()}`));
      const originalDescription = location.description;

      await callUpdateLocation(location.id!, { name: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.description).toBe(originalDescription);
    });
  });

  describe('address (Location.address)', () => {
    it('writes a fully-populated address with auto-filled use/type/country', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-full-${randomUUID()}`));

      await callUpdateLocation(location.id!, {
        address: { line: ['813 Washington Ave'], city: 'Iowa Falls', state: 'IA', postalCode: '50126' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toEqual({
        use: 'work',
        type: 'physical',
        country: 'US',
        line: ['813 Washington Ave'],
        city: 'Iowa Falls',
        state: 'IA',
        postalCode: '50126',
      });
    });

    it('removes the address field entirely when all sub-fields are empty', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-empty-${randomUUID()}`));
      expect(location.address).toBeDefined();

      await callUpdateLocation(location.id!, { address: { line: [''], city: '', state: '', postalCode: '' } });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toBeUndefined();
    });

    it('removes the address field when sent as null', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-null-${randomUUID()}`));

      await callUpdateLocation(location.id!, { address: null });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toBeUndefined();
    });

    it('keeps a partial address (e.g. only state) and drops empty sub-fields', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-partial-${randomUUID()}`));

      await callUpdateLocation(location.id!, { address: { line: [''], city: '   ', state: 'NJ', postalCode: '' } });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address?.state).toBe('NJ');
      expect(refreshed.address?.line).toBeUndefined();
      expect(refreshed.address?.city).toBeUndefined();
      expect(refreshed.address?.postalCode).toBeUndefined();
      expect(refreshed.address?.use).toBe('work');
      expect(refreshed.address?.type).toBe('physical');
      expect(refreshed.address?.country).toBe('US');
    });

    it('trims whitespace around address sub-fields', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-trim-${randomUUID()}`));

      await callUpdateLocation(location.id!, {
        address: { line: ['  100 Main St  '], city: '  Townsville ', state: ' NY ', postalCode: ' 10001 ' },
      });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address?.line).toEqual(['100 Main St']);
      expect(refreshed.address?.city).toBe('Townsville');
      expect(refreshed.address?.state).toBe('NY');
      expect(refreshed.address?.postalCode).toBe('10001');
    });

    it('does not touch address when the field is not sent', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-addr-untouched-${randomUUID()}`));
      const originalAddress = location.address;

      await callUpdateLocation(location.id!, { name: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.address).toEqual(originalAddress);
    });
  });

  describe('telecom (Location.telecom)', () => {
    it('writes phone, url, and fax entries with use=work', async () => {
      const baseLocation = makePhysicalLocation(`upd-telecom-full-${randomUUID()}`);
      delete baseLocation.telecom;
      const location = await persistLocation(baseLocation);
      expect(location.telecom).toBeUndefined();

      await callUpdateLocation(location.id!, {
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
      const location = await persistLocation(
        makePhysicalLocation(`upd-telecom-replace-${randomUUID()}`, [], {
          telecom: [
            { system: 'phone', use: 'work', value: 'OLD-PHONE' },
            { system: 'url', use: 'work', value: 'https://old.example.com' },
          ],
        })
      );

      await callUpdateLocation(location.id!, {
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
      const location = await persistLocation(makePhysicalLocation(`upd-telecom-clear-one-${randomUUID()}`));

      await callUpdateLocation(location.id!, { telecom: { phone: '5551234567', url: '', fax: '4441112222' } });

      const refreshed = await readLocation(location.id!);
      expect((refreshed.telecom ?? []).map((cp: ContactPoint) => cp.system).sort()).toEqual(['fax', 'phone']);
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'url')).toBeUndefined();
    });

    it('removes telecom entirely when all three sub-fields are empty', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-telecom-all-empty-${randomUUID()}`, [], {
          telecom: [
            { system: 'phone', use: 'work', value: '5551234567' },
            { system: 'url', use: 'work', value: 'https://example.com' },
            { system: 'fax', use: 'work', value: '5559876543' },
          ],
        })
      );
      expect(location.telecom).toBeDefined();

      await callUpdateLocation(location.id!, { telecom: { phone: '', url: '', fax: '' } });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('removes telecom entirely when sent as null', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-telecom-null-${randomUUID()}`));

      await callUpdateLocation(location.id!, { telecom: null });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('trims whitespace around telecom values', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-telecom-trim-${randomUUID()}`));

      await callUpdateLocation(location.id!, {
        telecom: { phone: '  555-0123  ', url: ' https://trim.example.com ', fax: '\t777-9999\n' },
      });

      const refreshed = await readLocation(location.id!);
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'phone')?.value).toBe('555-0123');
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'url')?.value).toBe('https://trim.example.com');
      expect((refreshed.telecom ?? []).find((cp) => cp.system === 'fax')?.value).toBe('777-9999');
    });

    it('treats whitespace-only sub-fields as empty (no empty entries are written)', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-telecom-ws-only-${randomUUID()}`));

      await callUpdateLocation(location.id!, { telecom: { phone: '   ', url: '\t\n', fax: '' } });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toBeUndefined();
    });

    it('preserves non-phone/url/fax telecom entries (e.g., sms, email)', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-telecom-preserve-others-${randomUUID()}`, [], {
          telecom: [
            { system: 'phone', use: 'work', value: 'PHONE-OLD' },
            { system: 'sms', use: 'work', value: '+15551239876' },
            { system: 'email', use: 'work', value: 'office@example.com' },
          ],
        })
      );

      await callUpdateLocation(location.id!, { telecom: { phone: 'PHONE-NEW', url: 'https://x.test', fax: '' } });

      const refreshed = await readLocation(location.id!);
      const bySystem = Object.fromEntries((refreshed.telecom ?? []).map((cp) => [cp.system, cp.value]));
      expect(bySystem.phone).toBe('PHONE-NEW');
      expect(bySystem.url).toBe('https://x.test');
      expect(bySystem.fax).toBeUndefined();
      expect(bySystem.sms).toBe('+15551239876');
      expect(bySystem.email).toBe('office@example.com');
    });

    it('does not touch telecom when the field is not sent', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-telecom-untouched-${randomUUID()}`, [], {
          telecom: [
            { system: 'phone', use: 'work', value: '5550001111' },
            { system: 'fax', use: 'work', value: '5552223333' },
          ],
        })
      );
      const originalTelecom = location.telecom;
      expect(originalTelecom).toBeDefined();

      await callUpdateLocation(location.id!, { name: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(refreshed.telecom).toEqual(originalTelecom);
    });
  });

  describe('reviewLink (Location review-link extension)', () => {
    const findReviewExt = (loc: Location): Extension | undefined =>
      (loc.extension ?? []).find((ext) => ext.url === LOCATION_REVIEW_LINK_EXTENSION_URL);

    it('writes the review-link extension as valueUrl', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-review-add-${randomUUID()}`));
      expect(findReviewExt(location)).toBeUndefined();

      await callUpdateLocation(location.id!, { reviewLink: 'https://g.page/r/sample-google-review' });

      const refreshed = await readLocation(location.id!);
      const ext = findReviewExt(refreshed);
      expect(ext).toBeDefined();
      expect(ext?.valueUrl).toBe('https://g.page/r/sample-google-review');
    });

    it('replaces an existing review-link without duplicating the extension', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-review-replace-${randomUUID()}`, [
          { url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://old.example/review' },
        ])
      );

      await callUpdateLocation(location.id!, { reviewLink: 'https://g.page/r/new-google-review' });

      const refreshed = await readLocation(location.id!);
      const matching = (refreshed.extension ?? []).filter((e) => e.url === LOCATION_REVIEW_LINK_EXTENSION_URL);
      expect(matching).toHaveLength(1);
      expect(matching[0]?.valueUrl).toBe('https://g.page/r/new-google-review');
    });

    it('removes the review-link extension when sent as an empty string', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-review-clear-${randomUUID()}`, [
          { url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://existing.example/review' },
        ])
      );

      await callUpdateLocation(location.id!, { reviewLink: '' });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('removes the review-link extension when sent as null', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-review-null-${randomUUID()}`, [
          { url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://existing.example/review' },
        ])
      );

      await callUpdateLocation(location.id!, { reviewLink: null });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('trims whitespace before persisting', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-review-trim-${randomUUID()}`));

      await callUpdateLocation(location.id!, { reviewLink: '   https://g.page/r/trimmed-review   ' });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)?.valueUrl).toBe('https://g.page/r/trimmed-review');
    });

    it('treats whitespace-only values as empty (no extension written)', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-review-whitespace-${randomUUID()}`));

      await callUpdateLocation(location.id!, { reviewLink: '   \t\n' });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)).toBeUndefined();
    });

    it('does not touch the review-link when the field is not sent', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-review-untouched-${randomUUID()}`, [
          { url: LOCATION_REVIEW_LINK_EXTENSION_URL, valueUrl: 'https://keep.example/review' },
        ])
      );

      await callUpdateLocation(location.id!, { name: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(findReviewExt(refreshed)?.valueUrl).toBe('https://keep.example/review');
    });
  });

  describe('supportPhone (Location support-phone extension)', () => {
    const findSupportExt = (loc: Location): Extension | undefined =>
      (loc.extension ?? []).find((ext) => ext.url === LOCATION_SUPPORT_PHONE_EXTENSION_URL);

    it('writes the support phone as a valueString and clears it when sent empty/null', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-support-${randomUUID()}`));

      await callUpdateLocation(location.id!, { supportPhone: '555-123-4567' });
      let refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)?.valueString).toBe('555-123-4567');

      await callUpdateLocation(location.id!, { supportPhone: '' });
      refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)).toBeUndefined();

      await callUpdateLocation(location.id!, { supportPhone: '555-123-4567' });
      await callUpdateLocation(location.id!, { supportPhone: null });
      refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)).toBeUndefined();
    });

    it('trims whitespace and treats whitespace-only as empty', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-support-trim-${randomUUID()}`));

      await callUpdateLocation(location.id!, { supportPhone: '  555-999-0000  ' });
      let refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)?.valueString).toBe('555-999-0000');

      await callUpdateLocation(location.id!, { supportPhone: '   \t' });
      refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)).toBeUndefined();
    });

    it('does not touch the support phone when the field is not sent', async () => {
      const location = await persistLocation(
        makePhysicalLocation(`upd-support-untouched-${randomUUID()}`, [
          { url: LOCATION_SUPPORT_PHONE_EXTENSION_URL, valueString: '555-keep-me' },
        ])
      );

      await callUpdateLocation(location.id!, { name: 'change something else' });

      const refreshed = await readLocation(location.id!);
      expect(findSupportExt(refreshed)?.valueString).toBe('555-keep-me');
    });
  });

  describe('slug (Location.identifier with SLUG_SYSTEM)', () => {
    const findSlugIdentifiers = (loc: Location): { system?: string; value?: string }[] =>
      (loc.identifier ?? []).filter((id) => id.system === SLUG_SYSTEM);

    it('replaces the existing slug identifier (no duplicates left behind)', async () => {
      const originalSlug = `upd-slug-replace-old-${randomUUID()}`;
      const newSlug = `upd-slug-replace-new-${randomUUID()}`;
      const location = await persistLocation(makePhysicalLocation(originalSlug));
      expect(findSlugIdentifiers(location)).toEqual([{ system: SLUG_SYSTEM, value: originalSlug }]);

      await callUpdateLocation(location.id!, { slug: newSlug });

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(newSlug);
    });

    it('preserves non-slug identifiers (other identifier systems are untouched)', async () => {
      const slug = `upd-slug-preserve-others-${randomUUID()}`;
      const otherSystem = 'https://identifiers.fhir.oystehr.com/lab-account-number';
      const location = await persistLocation(
        makePhysicalLocation(slug, [], {
          identifier: [
            { system: SLUG_SYSTEM, value: slug },
            { system: otherSystem, value: 'LAB-12345' },
          ],
        })
      );

      await callUpdateLocation(location.id!, { slug: `${slug}-updated` });

      const refreshed = await readLocation(location.id!);
      const slugIdentifiers = findSlugIdentifiers(refreshed);
      expect(slugIdentifiers).toHaveLength(1);
      expect(slugIdentifiers[0]?.value).toBe(`${slug}-updated`);
      const otherIdentifier = (refreshed.identifier ?? []).find((id) => id.system === otherSystem);
      expect(otherIdentifier?.value).toBe('LAB-12345');
    });

    it('clears the slug identifier when slug is sent as an empty string', async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-slug-clear-${randomUUID()}`));

      await callUpdateLocation(location.id!, { slug: '' });

      const refreshed = await readLocation(location.id!);
      expect(findSlugIdentifiers(refreshed)).toEqual([]);
    });
  });

  describe('validation', () => {
    let validLocationId: string;

    beforeAll(async () => {
      const location = await persistLocation(makePhysicalLocation(`upd-validation-${randomUUID()}`));
      validLocationId = location.id!;
    });

    const expectRejected = async (fields: Record<string, unknown>): Promise<void> => {
      await expect(
        oystehrTestUserM2M.zambda.execute({ id: 'update-location', locationId: validLocationId, ...fields } as any)
      ).rejects.toThrow();
    };

    it('rejects a missing locationId', async () => {
      await expect(oystehrTestUserM2M.zambda.execute({ id: 'update-location', name: 'x' } as any)).rejects.toThrow();
    });

    it('rejects non-boolean isVirtual', async () => {
      await expectRejected({ isVirtual: 'true' });
    });

    it('rejects non-boolean isInPerson', async () => {
      await expectRejected({ isInPerson: 'true' });
    });

    it('rejects non-string stripeAccountId', async () => {
      await expectRejected({ stripeAccountId: 123 });
    });

    it('rejects non-string advapacsLocationId', async () => {
      await expectRejected({ advapacsLocationId: { not: 'a string' } });
    });

    it('rejects rooms that is not an array', async () => {
      await expectRejected({ rooms: 'A,B,C' });
    });

    it('rejects rooms containing non-string entries', async () => {
      await expectRejected({ rooms: ['ok', 7] });
    });

    it('rejects non-string name', async () => {
      await expectRejected({ name: 42 });
    });

    it('rejects non-string description', async () => {
      await expectRejected({ description: { not: 'a string' } });
    });
  });
});
