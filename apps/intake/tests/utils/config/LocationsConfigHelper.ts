import { Page } from '@playwright/test';
import { CONFIG_INJECTION_KEYS } from 'utils';
import { CreatedConcreteLocation } from '../booking/TestLocationManager';
import { ConcreteLocationsOverrides } from '../booking-flow-concrete-smoke-configs';

/**
 * Configuration-aware locations test helper utilities
 *
 * These helpers inject location configurations at runtime and provide utilities
 * for mapping concrete config locations to their worker-suffixed test names.
 */

export class LocationsConfigHelper {
  /**
   * Inject a test locations config into the page's runtime environment.
   * This must be called BEFORE navigating to the page.
   *
   * The config is injected via window.__TEST_LOCATION_CONFIG__ which is then
   * picked up by the LOCATION_CONFIG Proxy in the application.
   *
   * @param page - Playwright page instance
   * @param config - Locations config to inject (overrides)
   */
  static async injectLocationsConfig(page: Page, config: Partial<ConcreteLocationsOverrides>): Promise<void> {
    await page.addInitScript(
      ({ key, overrides }) => {
        (window as any)[key] = overrides;
      },
      { key: CONFIG_INJECTION_KEYS.LOCATIONS, overrides: config }
    );
  }

  /**
   * Transform concrete config locations to use worker-suffixed names for test injection.
   * This creates a locations config that the app will use, with names matching the
   * FHIR locations created by TestLocationManager.
   *
   * @param originalOverrides - Original locations overrides from concrete config
   * @param createdLocations - Locations created by TestLocationManager with suffixed names
   * @returns Transformed locations config with suffixed names
   */
  static transformLocationsForInjection(
    originalOverrides: ConcreteLocationsOverrides,
    createdLocations: CreatedConcreteLocation[]
  ): ConcreteLocationsOverrides {
    // Build a map from original name to suffixed name
    const nameMap = new Map<string, string>();
    for (const loc of createdLocations) {
      nameMap.set(loc.originalName, loc.suffixedName);
    }

    // Transform in-person locations
    const inPersonLocations = originalOverrides.inPersonLocations.map((loc) => ({
      name: nameMap.get(loc.name) || loc.name,
    }));

    // Transform telemed locations
    const telemedLocations = originalOverrides.telemedLocations.map((loc) => ({
      name: nameMap.get(loc.name) || loc.name,
    }));

    // Transform location support phone number map keys if present
    let locationSupportPhoneNumberMap: Record<string, string> | undefined;
    if (originalOverrides.locationSupportPhoneNumberMap) {
      locationSupportPhoneNumberMap = {};
      for (const [originalName, phoneNumber] of Object.entries(originalOverrides.locationSupportPhoneNumberMap)) {
        const suffixedName = nameMap.get(originalName) || originalName;
        locationSupportPhoneNumberMap[suffixedName] = phoneNumber;
      }
    }

    return {
      inPersonLocations,
      telemedLocations,
      locationSupportPhoneNumberMap,
    };
  }
}
