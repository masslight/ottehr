/**
 * Index of concrete smoke test configurations
 *
 * Dynamically discovers and loads all instance configurations from subfolders.
 * Each subfolder should follow the pattern:
 *   {instance-name}/
 *     index.ts          - exports fillingStrategy
 *     booking/index.ts  - exports BOOKING_OVERRIDES
 *     intake-paperwork/index.ts - exports INTAKE_PAPERWORK_CONFIG
 *     intake-paperwork-virtual/index.ts - exports INTAKE_PAPERWORK_CONFIG
 *
 * New configs can be added by creating a new subfolder following this pattern.
 */

import * as fs from 'fs';
import * as path from 'path';
// ES module compatible directory resolution (cross-platform)
import { fileURLToPath } from 'url';
import { FillingStrategy } from '../booking/BookingTestFactory';

/**
 * Location definition for concrete configs
 */
export interface ConcreteLocationConfig {
  name: string;
}

/**
 * Locations overrides structure
 */
export interface ConcreteLocationsOverrides {
  inPersonLocations: ConcreteLocationConfig[];
  telemedLocations: ConcreteLocationConfig[];
  locationSupportPhoneNumberMap?: Record<string, string>;
}

/**
 * A concrete smoke test configuration
 */
export interface ConcreteTestConfig {
  /** Unique identifier for this config (folder name) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Filling strategy for this config */
  fillingStrategy: FillingStrategy;
  /** Booking config overrides */
  bookingOverrides: any;
  /** In-person paperwork config overrides */
  paperworkConfigInPerson: any;
  /** Virtual paperwork config overrides */
  paperworkConfigVirtual: any;
  /** Locations config overrides */
  locationsOverrides: ConcreteLocationsOverrides;
  /** Value sets overrides */
  valueSetsOverrides: any;
  /** Consent forms overrides */
  consentFormsOverrides: any;
}

/**
 * Discover and load all concrete test configurations from subfolders
 */

export async function loadConcreteTestConfigs(): Promise<ConcreteTestConfig[]> {
  const configs: ConcreteTestConfig[] = [];
  const configsDir = path.dirname(fileURLToPath(import.meta.url));

  // Get all subdirectories
  const entries = fs.readdirSync(configsDir, { withFileTypes: true });
  const subdirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  for (const subdir of subdirs) {
    const subdirPath = path.join(configsDir, subdir);

    try {
      // Check if required files exist (TypeScript source)
      const indexPath = path.join(subdirPath, 'index.ts');
      const bookingPath = path.join(subdirPath, 'booking', 'index.ts');
      const paperworkPath = path.join(subdirPath, 'intake-paperwork', 'index.ts');
      const paperworkVirtualPath = path.join(subdirPath, 'intake-paperwork-virtual', 'index.ts');
      const locationsPath = path.join(subdirPath, 'locations', 'index.ts');
      const valueSetsPath = path.join(subdirPath, 'value-sets', 'index.ts');
      const consentFormsPath = path.join(subdirPath, 'consent-forms', 'index.ts');

      if (
        !fs.existsSync(indexPath) ||
        !fs.existsSync(bookingPath) ||
        !fs.existsSync(paperworkPath) ||
        !fs.existsSync(paperworkVirtualPath) ||
        !fs.existsSync(locationsPath) ||
        !fs.existsSync(valueSetsPath) ||
        !fs.existsSync(consentFormsPath)
      ) {
        console.log(`Skipping ${subdir} - missing required config files`);
        continue;
      }

      // Dynamically import the configs (TypeScript source)
      const indexModule = await import(indexPath);
      const bookingModule = await import(bookingPath);
      const paperworkModule = await import(paperworkPath);
      const paperworkVirtualModule = await import(paperworkVirtualPath);
      const locationsModule = await import(locationsPath);
      const valueSetsModule = await import(valueSetsPath);
      const consentFormsModule = await import(consentFormsPath);

      if (indexModule.skip) {
        console.log(`Skipping ${subdir} as marked by skip flag`);
        continue;
      }

      // Create config object
      const config: ConcreteTestConfig = {
        id: subdir,
        name: subdir
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .replace(' Overrides', ''),
        fillingStrategy: indexModule.fillingStrategy,
        bookingOverrides: bookingModule.BOOKING_OVERRIDES,
        paperworkConfigInPerson: paperworkModule.INTAKE_PAPERWORK_CONFIG,
        paperworkConfigVirtual: paperworkVirtualModule.INTAKE_PAPERWORK_CONFIG,
        locationsOverrides: locationsModule.LOCATIONS_OVERRIDES,
        valueSetsOverrides: valueSetsModule.VALUE_SETS_OVERRIDES,
        consentFormsOverrides: consentFormsModule.CONSENT_FORMS_OVERRIDE,
      };

      configs.push(config);
      console.log(`Loaded concrete test config: ${config.name} (${config.id})`);
    } catch (error) {
      console.warn(`Failed to load config from ${subdir}:`, error);
    }
  }

  console.error('[ConcreteSmokeConfig] configsDir:', configsDir);
  console.error('[ConcreteSmokeConfig] Loaded configs:', configs);

  return configs;
}

/**
 * All concrete test configurations (loaded at module initialization)
 */
export const CONCRETE_TEST_CONFIGS: Promise<ConcreteTestConfig[]> = loadConcreteTestConfigs();
