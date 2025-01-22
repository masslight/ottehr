import { chromium } from '@playwright/test';
import { checkIfEnvAllowed } from './test/e2e-utils/check-env';

void (async () => {
  checkIfEnvAllowed();
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('http://localhost:4002');
  await page.waitForTimeout(120000); // 2 min login timeout
  await context.storageState({ path: './playwright/user.json' });
  console.log('Auth state saved successfully');
  await browser.close();
})();
