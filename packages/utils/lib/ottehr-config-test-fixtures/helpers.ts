import { QuestionnaireConfigType } from '../ottehr-config';
import { getIntakePaperworkConfig } from '../ottehr-config/intake-paperwork';
import { CAPABILITY_TEST_CONFIGS, CapabilityTestConfig } from './capability-configs';

/**
 * Get a capability config by name
 */
export function getCapabilityConfig(name: string): CapabilityTestConfig {
  const config = CAPABILITY_TEST_CONFIGS[name];
  if (!config) {
    throw new Error(
      `Unknown capability config: ${name}. Available: ${Object.keys(CAPABILITY_TEST_CONFIGS).join(', ')}`
    );
  }
  return config;
}

/**
 * Create an intake paperwork config instance with capability test overrides
 *
 * This is a pure function that creates isolated config instances, allowing
 * parallel test execution without shared state or race conditions.
 *
 * Usage in tests:
 * ```typescript
 * const config = createConfigForTest('hidden-fields');
 * const visibleFields = ConfigHelper.getVisibleFields(config.contactInformation);
 * ```
 */
export function createConfigForTest(configName: string): QuestionnaireConfigType {
  const capability = getCapabilityConfig(configName);
  return getIntakePaperworkConfig(capability.overrides);
}
