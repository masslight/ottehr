/**
 * Helper to check if telemed is enabled in locations config
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const VIRTUAL_LOCATION_EXTENSION_URL = 'https://extensions.fhir.zapehr.com/location-form-pre-release';

/**
 * Check if telemed is enabled by reading the locations config file
 */
function getIsTelemedEnabled(): boolean {
  try {
    const configPath = resolve(__dirname, '../../../../config/oystehr/locations-and-schedules.json');

    if (!existsSync(configPath)) {
      return false;
    }

    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    if (!config?.fhirResources) {
      return false;
    }

    // Check if any location has virtual extension
    for (const item of Object.values(config.fhirResources) as any[]) {
      const location = item?.resource;
      if (
        location?.resourceType === 'Location' &&
        location?.extension?.some(
          (ext: any) => ext.url === VIRTUAL_LOCATION_EXTENSION_URL && ext.valueCoding?.code === 'vi'
        )
      ) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.warn('Failed to check telemed config:', error);
    return false;
  }
}

/**
 * True if telemed (virtual locations) is enabled in the current configuration
 */
export const isTelemedEnabled = getIsTelemedEnabled();
