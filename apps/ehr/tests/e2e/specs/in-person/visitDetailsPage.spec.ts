import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { ResourceHandler } from 'tests/e2e-utils/resource-handler';

const PROCESS_ID = `visitDetailsPage.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'in-person');

test.describe('Visit details page', { tag: '@smoke' }, async () => {
  let page: Page;
  let context: BrowserContext;
  // let visitDetailsPage: VisitDetailsPage;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!);

    context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`/visit/${resourceHandler.appointment.id!}`);
    // visitDetailsPage = await expectVisitDetailsPage(page, resourceHandler.appointment.id!);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources(page);
    await page.close();
    await context.close();
  });

  test.describe.configure({ mode: 'serial' });

  test('should display visit details page correctly', async () => {});
});
