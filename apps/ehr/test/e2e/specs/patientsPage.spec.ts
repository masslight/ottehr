import { test } from '@playwright/test';
import { PATIENT_FIRST_NAME, PATIENT_LAST_NAME, ResourceHandler } from '../../e2e-utils/resource-handler';
import { expectPatientsPage } from '../page/PatientsPage';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.waitForTimeout(2000);
  await page.goto('/patients');
});

test('Search by Last name', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
  await patientsPage.searchByName(PATIENT_LAST_NAME);
  await patientsPage.clickSearchButton();
  await patientsPage.verifyPatientPresent(
    resourceHandler.patient.id!,
    PATIENT_FIRST_NAME,
    PATIENT_LAST_NAME,
    '01/01/2024',
    'john.doe@example.com',
    '+12144985555',
    '-'
  );
});
