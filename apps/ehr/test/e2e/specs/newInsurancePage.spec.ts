import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectEditInsurancePage } from '../page/EditInsurancePage';
import { INSURANCE_SETTINGS_MAP } from 'utils/lib/types';
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
    option: INSURANCE_SETTINGS_MAP.requiresSubscriberId,
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: INSURANCE_SETTINGS_MAP.requiresRelationshipToSubscriber,
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: INSURANCE_SETTINGS_MAP.requiresInsuranceName,
    checked: true,
    enabled: false,
  });

  await newInsurancePage.verifyOptionState({
    option: INSURANCE_SETTINGS_MAP.requiresInsuranceCardImage,
    checked: true,
    enabled: false,
  });
});
