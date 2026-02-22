/**
 * Test fixtures for capability-based testing of ottehr-config
 *
 * These configs represent abstract capabilities the system must support,
 * not specific client implementations. They allow upstream to test that
 * the config interpreter handles all valid patterns without needing access
 * to private downstream configurations.
 */

export { CAPABILITY_TEST_CONFIGS } from './capability-configs';
export { getCapabilityConfig, createConfigForTest } from './helpers';
