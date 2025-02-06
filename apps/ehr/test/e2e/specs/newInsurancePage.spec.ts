import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectEditInsurancePage } from '../page/EditInsurancePage';
//import { dataTestIds } from '../../../src/constants/data-test-ids';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/telemed-admin/insurances/new');
});

test('Open "New insurance page", leave "Payer name" field empty and click save button, validation error on "Payer name" field shown', async ({
  page,
}) => {
  const newInsurancePage = await expectEditInsurancePage(page);
  await newInsurancePage.clickSaveChangesButton();
  await newInsurancePage.verifyPageStillOpened();
});

