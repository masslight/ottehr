import { Page } from '@playwright/test';
import { CONFIG_INJECTION_KEYS } from 'utils';

/**
 * Inject a test config into the page's runtime environment.
 * Must be called BEFORE navigating to the page.
 *
 * The config is injected via window[key] which is then picked up
 * by the corresponding Proxy in the application.
 *
 * @param page - Playwright page instance
 * @param key - The config injection key
 * @param config - Config object to inject
 */
export async function injectTestConfig(page: Page, key: CONFIG_INJECTION_KEYS, config: unknown): Promise<void> {
  await page.addInitScript(
    ({ key, overrides }) => {
      (window as any)[key] = overrides;
    },
    { key, overrides: config }
  );
}
