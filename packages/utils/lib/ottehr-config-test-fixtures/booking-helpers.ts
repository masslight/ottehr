import { type BookingConfig, getBookingConfig } from '../ottehr-config/booking';
import { BOOKING_CAPABILITY_TEST_CONFIGS, type BookingCapabilityTestConfig } from './booking-capability-configs';

/**
 * Get a booking capability config by name
 */
export function getBookingCapabilityConfig(name: string): BookingCapabilityTestConfig {
  const config = BOOKING_CAPABILITY_TEST_CONFIGS[name];
  if (!config) {
    throw new Error(
      `Unknown booking capability config: ${name}. Available: ${Object.keys(BOOKING_CAPABILITY_TEST_CONFIGS).join(
        ', '
      )}`
    );
  }
  return config;
}

/**
 * Create a booking config instance with capability test overrides
 *
 * This is a pure function that creates isolated config instances, allowing
 * parallel test execution without shared state or race conditions.
 *
 * Usage in tests:
 * ```typescript
 * const config = createBookingConfigForTest('virtualOnly');
 * const enabledModes = BookingConfigHelper.getEnabledServiceModes(config);
 * ```
 */
export function createBookingConfigForTest(configName: string): BookingConfig {
  const capability = getBookingCapabilityConfig(configName);
  return getBookingConfig(capability.overrides);
}
