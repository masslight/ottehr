import { test } from '@playwright/test';
import { ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectInsurancesPage } from '../page/InsurancesPage';
import { INSURANCE_NAME } from '../../e2e-utils/resource-handler';
const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(10000);
  await page.goto('/telemed-admin/insurances');
});

test('Open "Insurances page", click forward and backward,  paginagiton works correctly', async ({ page }) => {
  const insurancesPage = await expectInsurancesPage(page);
  await insurancesPage.verifyPaginationState('1–10 of 1000');
  await insurancesPage.clickNextPage();
  await insurancesPage.verifyPaginationState('11–20 of 1000');
  await insurancesPage.clickPreviousPage();
  await insurancesPage.verifyPaginationState('1–10 of 1000');
});

test('Open "Insurances page", enter insurance name,  correct search result is displayed', async ({ page }) => {
  const insurancesPage = await expectInsurancesPage(page);
  await insurancesPage.searchInsurance(INSURANCE_NAME);
  await page.waitForTimeout(1000);
  await insurancesPage.verifyInsurancePresent(INSURANCE_NAME);
  await insurancesPage.verifyPaginationState('1–1 of 1');

  await insurancesPage.searchInsurance('QQ');
  await insurancesPage.verifyPaginationState('0–0 of 0');
});
