import { test } from '@playwright/test';
import {
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectPatientsPage } from '../page/PatientsPage';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler();

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});
test('Search by First name', async ({ page }) => {
  const patientsPage = await expectPatientsPage(page);
});
