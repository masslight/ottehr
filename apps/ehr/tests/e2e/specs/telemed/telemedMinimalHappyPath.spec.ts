import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { isTelemedEnabled } from 'test-utils';
import { InPersonHeader } from 'tests/e2e/page/InPersonHeader';
import { openVisitsPage } from 'tests/e2e/page/VisitsPage';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const PROCESS_ID = `videoCallFlow.spec.ts-${DateTime.now().toMillis()}`;
const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  page = await context.newPage();
  await resourceHandler.setResources({ skipPaperwork: true });
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.describe.configure({ mode: 'serial' });

// Skip telemed tests if virtual locations are not configured
test.skip(!isTelemedEnabled, 'Telemed tests require virtual locations to be configured');

test('Should start video call', async () => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(`${err.name}: ${err.message}`));

  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(resourceHandler.appointmentLocation?.name ?? 'Unknown');

  await page.goto(`/in-person/${resourceHandler.appointment.id}`);
  const header = new InPersonHeader(page);
  const testUserPractitioner = (await resourceHandler.getTestsUserAndPractitioner()).practitioner;
  await header.selectIntakePractitioner(testUserPractitioner.id);

  const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
  await expect(connectButton).toBeVisible();

  // Arm response waiter before the click that triggers the fire-and-forget mutation.
  // If init-telemed-session fails, this surfaces the status code instead of a 35s DOM timeout.
  const initResponsePromise = page.waitForResponse((r) => r.url().includes('init-telemed-session'));

  await connectButton.click();
  await telemedDialogConfirm(page);

  const initResponse = await initResponsePromise;
  expect(
    initResponse.status(),
    `init-telemed-session zambda returned ${initResponse.status()}. Page errors so far: ${
      pageErrors.join(' | ') || '<none>'
    }`
  ).toBe(200);

  await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible();
});
