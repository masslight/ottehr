import { CONFIG_INJECTION_KEYS } from 'utils';

/**
 * Set a config override on the window object for test injection.
 * The createProxyConfigObject Proxy in each config module will pick up
 * these overrides at property access time.
 *
 * Call this BEFORE rendering the component under test.
 */
export function setConfigOverride(key: CONFIG_INJECTION_KEYS, overrides: Record<string, unknown>): void {
  (window as any)[key] = overrides;
}

/**
 * Clear a specific config override.
 */
export function clearConfigOverride(key: CONFIG_INJECTION_KEYS): void {
  delete (window as any)[key];
}

/**
 * Clear all config overrides. Called automatically in afterEach via setup.ts.
 */
export function clearAllConfigOverrides(): void {
  for (const key of Object.values(CONFIG_INJECTION_KEYS)) {
    delete (window as any)[key];
  }
}
