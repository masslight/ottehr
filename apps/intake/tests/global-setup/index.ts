import { chromium, FullConfig } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';

const globalSetup = async (_config: FullConfig): Promise<void> => {
  const processId = process.env.PLAYWRIGHT_SUITE_ID;
  if (!processId) {
    throw new Error('PLAYWRIGHT_SUITE_ID is not set. Please set it before running the tests.');
  }
  if (!processId.startsWith('intake-')) {
    throw new Error('PLAYWRIGHT_SUITE_ID must start with "intake-". Current value: ' + processId);
  }
  console.log('Running global setup for intake tests', processId);

  if (process.env.IS_LOGIN_TEST === 'true') {
    console.log('Skipping auth check for login test');
    return;
  }

  const authFile = './playwright/user.json';
  const browser = await chromium.launch();
  const page = await browser.newPage({
    storageState: authFile, // load the saved session
  });

  try {
    console.log('Starting auth check...');
    await page.goto(`${process.env.WEBSITE_URL}/`);
    console.log('Page loaded successfully');

    console.log('Looking for auth element...');
    await page.locator('[data-testid="header-for-authenticated-user"]').waitFor({
      state: 'visible',
      timeout: 10_000,
    });
    console.log('Auth check passed');
  } catch (error: any) {
    console.error('Authentication failed:', error.message);
    if (existsSync(authFile)) {
      const fileContent = readFileSync(authFile, 'utf8');
      const parsed = JSON.parse(fileContent);
      console.log('Auth file exists');
      console.log('Cookies count:', parsed.cookies?.length || 0);
      console.log('Origins count:', parsed.origins?.length || 0);

      const hasAuth0Token = parsed.origins?.some?.(
        (origin: any) =>
          origin?.localStorage?.some?.(
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
