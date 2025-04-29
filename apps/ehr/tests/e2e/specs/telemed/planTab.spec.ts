import { expect, Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { TelemedAppointmentVisitTabs } from 'utils';
import { waitForSaveChartDataResponse } from 'test-utils';

test.describe('Disposition', async () => {
  test.describe('Primary Care Physician', async () => {
    const resourceHandler = new ResourceHandler('telemed');
    let page: Page;
    const defaultNote = 'Please see your Primary Care Physician as discussed.';
    const updatedNote = 'Lorem ipsum';

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      page = await context.newPage();
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    test.afterAll(async () => {
      await resourceHandler.cleanupResources();
    });

    test.describe.configure({ mode: 'serial' });

    test("Should check 'Primary Care Physician' is selected by default", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible();
      const primaryCarePhysicianButton = page.getByTestId(
        dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('pcp-no-type')
      );
      const attribute = await primaryCarePhysicianButton.getAttribute('aria-pressed');
      expect(attribute).toBe('true');
    });

    test("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Primary Care Physician' selected", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible();
    });

    test("Should check note section has pre-filled text for 'Primary Care Physician'", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
    });

    // todo: i'm not sure but i can't see follow up days on Review&Sign after save
    // test('Should select follow up option and check it on Review&Sign tab', async () => {});

    test('Should update Primary Care Physician note and check it on Review&Sign tab', async () => {
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer)).toHaveText(
        new RegExp(updatedNote)
      );
    });
  });

  test.describe('Transfer to another location', async () => {
    const resourceHandler = new ResourceHandler('telemed');
    let page: Page;
    const defaultNote = 'Please proceed to the ABC Office as advised.';
    const updatedNote = 'Lorem ipsum';

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      page = await context.newPage();
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    test.afterAll(async () => {
      await resourceHandler.cleanupResources();
    });

    test.describe.configure({ mode: 'serial' });

    test("Should check 'Reason for transfer' drop down and 'Note' field are present for 'Transfer to another location' selected", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible();

      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('another')).click();
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown)
      ).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible();
    });

    test("Should check note section has pre-filled text for 'Transfer to another location' selected", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
    });

    test('Should edit transfer note and check it on Review&Sign tab', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer)).toHaveText(
        new RegExp(updatedNote)
      );
    });
  });

  test.describe('Speciality transfer', async () => {
    const resourceHandler = new ResourceHandler('telemed');
    let page: Page;
    const updatedNote = 'Lorem ipsum';

    test.beforeAll(async ({ browser }) => {
      const context = await browser.newContext();
      page = await context.newPage();
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    test.afterAll(async () => {
      await resourceHandler.cleanupResources();
    });

    test.describe.configure({ mode: 'serial' });

    test("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Speciality transfer' selected", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible();

      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('speciality')).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible();
    });

    test('Should edit transfer note and check it on Review&Sign tab', async () => {
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer)).toHaveText(
        new RegExp(updatedNote)
      );
    });
  });
});
