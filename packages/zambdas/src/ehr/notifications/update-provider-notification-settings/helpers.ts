import { Operation } from 'fast-json-patch';
import { Extension, Practitioner } from 'fhir/r4b';
import {
  PROVIDER_NOTIFICATION_PREFERENCES_V2_URL,
  PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
} from 'utils/lib/types/api/practitioner.types';
import { ProviderNotificationPreferencesV2 } from 'utils/lib/types/api/provider-notifications';

export const SMS_TELECOM_SYSTEM = 'sms';

/** The stored SMS number, which is what the settings form seeds its phone field from. */
export const getSmsTelecomValue = (practitioner: Practitioner): string | undefined =>
  practitioner.telecom?.find((telecom) => telecom.system === SMS_TELECOM_SYSTEM)?.value;

/**
 * The patch that saves notification settings onto a Practitioner.
 *
 * Index-based paths, so this MUST be computed from a freshly read Practitioner. The browser used to
 * build it from its cached profile, and a second save in one session computed indices against a stale
 * copy — appending a duplicate settings extension and a duplicate `sms` telecom rather than replacing
 * either. The caller reads the resource immediately before calling this.
 *
 * Only the V2 blob is written. Any legacy flat children of the settings extension (`…-method`,
 * `…-enabled-task`, `…-enabled-telemed`) are dropped with the container they lived in: the V2 blob is
 * the sole source of truth, and the read path derives the legacy values from it on the fly.
 */
export const buildNotificationSettingsPatchOperations = ({
  practitioner,
  preferences,
  phoneNumber,
}: {
  practitioner: Practitioner;
  preferences: ProviderNotificationPreferencesV2;
  /** Already validated and normalized. Undefined leaves whatever number is stored alone. */
  phoneNumber?: string;
}): Operation[] => {
  const settingsExtension: Extension = {
    url: PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL,
    extension: [{ url: PROVIDER_NOTIFICATION_PREFERENCES_V2_URL, valueString: JSON.stringify(preferences) }],
  };

  const operations: Operation[] = [];

  const extensions = practitioner.extension;
  if (!extensions) {
    operations.push({ op: 'add', path: '/extension', value: [settingsExtension] });
  } else {
    const existingIndex = extensions.findIndex(
      (extension) => extension.url === PROVIDER_NOTIFICATIONS_SETTINGS_EXTENSION_URL
    );
    operations.push(
      existingIndex >= 0
        ? { op: 'replace', path: `/extension/${existingIndex}`, value: settingsExtension }
        : { op: 'add', path: '/extension/-', value: settingsExtension }
    );
  }

  // Persisted regardless of the chosen methods — someone on 'computer' must not lose the number they
  // typed on reload. SMS is still only *sent* for phone methods; that decision lives in the cron.
  if (phoneNumber) {
    const telecoms = practitioner.telecom;
    if (!telecoms) {
      operations.push({ op: 'add', path: '/telecom', value: [{ system: SMS_TELECOM_SYSTEM, value: phoneNumber }] });
    } else {
      const smsIndex = telecoms.findIndex((telecom) => telecom.system === SMS_TELECOM_SYSTEM);
      operations.push(
        smsIndex >= 0
          ? { op: 'replace', path: `/telecom/${smsIndex}/value`, value: phoneNumber }
          : { op: 'add', path: '/telecom/-', value: { system: SMS_TELECOM_SYSTEM, value: phoneNumber } }
      );
    }
  }

  return operations;
};
