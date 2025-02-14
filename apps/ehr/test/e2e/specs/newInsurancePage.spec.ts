import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectEditInsurancePage } from '../page/EditInsurancePage';

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

test('Open "New insurance page", fill Display name and leave "Payer name" field empty and click save button", insurance is not created', async ({
  page,
}) => {
  const newInsurancePage = await expectEditInsurancePage(page);
  await newInsurancePage.clickSaveChangesButton();
  await newInsurancePage.verifyPageStillOpened();
});

test('Open "New insurance page", select Payer name and leave Display name empty and click save button, error is shown', async ({
  page,
}) => {
  const newInsurancePage = await expectEditInsurancePage(page);
  await newInsurancePage.selectPayerName('Rexnord');
  await newInsurancePage.enterDisplayName('');
  await newInsurancePage.clickSaveChangesButton();
  await newInsurancePage.verifySaveInsuranceError();
});

test('Open "New insurance page", verify mandatory options are uneditable and checked', async ({ page }) => {
  const newInsurancePage = await expectEditInsurancePage(page);
  await newInsurancePage.verifyOptionState({
    option: 'requiresSubscriberId',
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: 'requiresRelationshipToSubscriber',
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: 'requiresInsuranceName',
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: 'requiresInsuranceCardImage',
    checked: true,
    enabled: false,
  });
});
