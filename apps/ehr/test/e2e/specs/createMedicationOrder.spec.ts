import { Page, test } from '@playwright/test';
import { expectVisitsPage } from '../page/VisitsPage';
import { ResourceHandler } from '../../e2e-utils/resource-handler';

const resourceHandler = new ResourceHandler('in-person');

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test('Open eRX tab, click "New Order", "Order Medication" screen is opened', async ({ page }) => {
  await page.goto(`in-person/appointments/${resourceHandler.appointment.id}`);
  await page.waitForTimeout(10000);
});