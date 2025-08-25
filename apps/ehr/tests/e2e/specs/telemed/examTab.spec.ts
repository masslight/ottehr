import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForSaveChartDataResponse } from 'test-utils';
import { TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

test.describe('Fields tests', async () => {
  const PROCESS_ID = `examTab.spec.ts-fields-tests-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;

  const providerComment = 'Lorem ipsum';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeVisible();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test("Should enter some text in 'Provider' field", async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabTable)
      .locator("input[type='text']:not([role='combobox'])")
      .first()
      .fill(providerComment);
    await waitForSaveChartDataResponse(page);
  });

  test('Should check that text in provider comment is visible on Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);

    await expect(examinationsContainer).toHaveText(new RegExp(providerComment));
  });
});
