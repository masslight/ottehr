import { chromium, FullConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';

const globalSetup = async (_config: FullConfig): Promise<void> => {
  const processId = process.env.PLAYWRIGHT_SUITE_ID;
  if (!processId) {
    throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
  }
  if (!processId.startsWith('intake-') && !processId.startsWith('ehr-')) {
    throw new Error('PLAYWRIGHT_SUITE_ID must start with "intake-" or "ehr-". Current value: ' + processId);
  }
  console.log('Running global setup for intake tests', processId);

  const authFile = './playwright/user.json';
  const browser = await chromium.launch();

  try {
    if (process.env.IS_LOGIN_TEST === 'true') {
      // Login stage: the login test itself is responsible for generating a fresh user.json.
      console.log('IS_LOGIN_TEST=true: skipping auth validation in globalSetup');
      return;
    }

    // Normal mode: we only validate existing auth; if invalid/missing we fail fast (avoid running on stale auth).
    if (!existsSync(authFile)) {
      console.log('Auth file does not exist');
      throw new Error('AUTH FILE MISSING - RUN LOGIN FLOW FIRST');
    }

    console.log('Auth file exists, validating...');
    const page = await browser.newPage({ storageState: authFile });
    await page.goto(`${process.env.WEBSITE_URL}/`);
    await page.locator('[data-testid="header-for-authenticated-user"]').waitFor({
      state: 'visible',
      timeout: 10_000,
    });
    await page.close();
    console.log('Auth check passed');
  } catch (error: any) {
    console.error('Authentication in globalSetup failed:', error?.message ?? error);
    if (existsSync(authFile)) {
      const fileContent = readFileSync(authFile, 'utf8');
      const parsed = JSON.parse(fileContent);
      console.log('Auth file exists');
      console.log('Cookies count:', parsed.cookies?.length || 0);
      console.log('Origins count:', parsed.origins?.length || 0);

      const hasAuth0Token = parsed.origins?.some?.(
        (origin: any) =>
          origin?.localStorage?.some?.(
            // cSpell:disable-next spa js?
            (item: any) => item?.name?.includes('@@auth0spajs@@') && !item?.name?.includes('@@user@@')
          )
      );
      console.log('Has Auth0 token:', hasAuth0Token);
    } else {
      console.log('Auth file does not exist');
    }

    throw new Error('AUTHENTICATION FAILED - STOPPING ALL TESTS');
  } finally {
    await browser.close();
  }
};

export default globalSetup;
