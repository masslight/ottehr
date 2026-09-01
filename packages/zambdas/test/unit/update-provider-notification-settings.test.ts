import { Operation } from 'fast-json-patch';
import { Practitioner } from 'fhir/r4b';
import {
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
  ProviderNotificationMethod,
} from 'utils/lib/types/api/practitioner.types';
import {
  defaultNotificationRowPref,
  normalizeNotificationPreferencesV2,
} from 'utils/lib/types/api/provider-notifications';
import { describe, expect, it } from 'vitest';
import {
  buildNotificationSettingsPatchOperations,
  getSmsTelecomValue,
} from '../../src/ehr/notifications/update-provider-notification-settings/helpers';

const preferences = normalizeNotificationPreferencesV2({
  waitingRoom: defaultNotificationRowPref(true, ProviderNotificationMethod.computer),
});

const build = (practitioner: Practitioner, phoneNumber?: string): Operation[] =>
  buildNotificationSettingsPatchOperations({ practitioner, preferences, phoneNumber });

const practitioner = (overrides: Partial<Practitioner> = {}): Practitioner => ({
  resourceType: 'Practitioner',
  id: 'prac-1',
  ...overrides,
});

const OTHER_EXTENSION = { url: 'https://example.com/something-else', valueString: 'keep me' };

describe('buildNotificationSettingsPatchOperations — preferences extension', () => {
  it('creates the extension array when the Practitioner has none', () => {
    expect(build(practitioner())).toEqual([
      {
        op: 'add',
        path: '/extension',
        value: [
          {
            url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
            extension: [{ url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(preferences) }],
          },
        ],
      },
    ]);
  });

  it('appends to an existing extension array that has no settings extension yet', () => {
    const [operation] = build(practitioner({ extension: [OTHER_EXTENSION] }));
    expect(operation).toMatchObject({ op: 'add', path: '/extension/-' });
  });

  it('replaces the settings extension in place, at its actual index', () => {
    const [operation] = build(
      practitioner({
        extension: [
          OTHER_EXTENSION,
          { url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL, extension: [{ url: 'stale', valueString: 'old' }] },
        ],
      })
    );
    // Index 1, not 0 and not appended: computing this against a stale copy of the resource is exactly
    // how the browser-side version ended up with two settings extensions on a second save.
    expect(operation).toMatchObject({ op: 'replace', path: '/extension/1' });
  });

  it('writes only the V2 blob, dropping any legacy flat children of the container', () => {
    const [operation] = build(
      practitioner({
        extension: [
          {
            url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
            extension: [
              { url: `${PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL}-method`, valueString: 'Phone' },
              { url: `${PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL}-enabled-task`, valueBoolean: true },
            ],
          },
        ],
      })
    );
    expect((operation as { value: { extension: unknown[] } }).value.extension).toEqual([
      { url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(preferences) },
    ]);
  });
});

describe('buildNotificationSettingsPatchOperations — sms telecom', () => {
  it('leaves the stored number alone when no phone number is given', () => {
    expect(build(practitioner({ telecom: [{ system: 'sms', value: '+15551234567' }] }))).toHaveLength(1);
  });

  it('creates the telecom array when the Practitioner has none', () => {
    expect(build(practitioner(), '+15551234567')[1]).toEqual({
      op: 'add',
      path: '/telecom',
      value: [{ system: 'sms', value: '+15551234567' }],
    });
  });

  it('appends an sms entry alongside other contact methods', () => {
    expect(build(practitioner({ telecom: [{ system: 'email', value: 'a@b.c' }] }), '+15551234567')[1]).toEqual({
      op: 'add',
      path: '/telecom/-',
      value: { system: 'sms', value: '+15551234567' },
    });
  });

  it('replaces the existing sms value at its actual index', () => {
    expect(
      build(
        practitioner({
          telecom: [
            { system: 'email', value: 'a@b.c' },
            { system: 'sms', value: '+15550000000' },
          ],
        }),
        '+15551234567'
      )[1]
    ).toEqual({ op: 'replace', path: '/telecom/1/value', value: '+15551234567' });
  });
});

describe('getSmsTelecomValue', () => {
  it('finds the sms number among other contact methods', () => {
    expect(
      getSmsTelecomValue(
        practitioner({
          telecom: [
            { system: 'phone', value: '+15559999999' },
            { system: 'sms', value: '+15551234567' },
          ],
        })
      )
    ).toBe('+15551234567');
  });

  it('is undefined when no sms number is stored', () => {
    expect(getSmsTelecomValue(practitioner({ telecom: [{ system: 'email', value: 'a@b.c' }] }))).toBeUndefined();
    expect(getSmsTelecomValue(practitioner())).toBeUndefined();
  });
});
