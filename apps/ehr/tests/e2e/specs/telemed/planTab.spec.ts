import { expect, Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { TelemedAppointmentVisitTabs } from 'utils';
import { waitForSaveChartDataResponse } from 'test-utils';
import { getDropdownOption } from '../../../e2e-utils/helpers/tests-utils';
import { DateTime } from 'luxon';

test.describe('Disposition', async () => {
  test.describe('Primary Care Physician', async () => {
    const PROCESS_ID = `planTab.spec.ts-disposition-${DateTime.now().toMillis()}`;
    const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
    let page: Page;
    const defaultNote = 'Please see your Primary Care Physician as discussed.';
    const updatedNote = 'Lorem ipsum';
    const followUpMenuOption = '3 days';
    const followUpMessage = 'Follow-up visit in 3 days';

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

    test("Should check 'Note' section has pre-filled text for 'Primary Care Physician'", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
    });

    test("Should select some 'Follow up visit in' option", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown).click();
      const option = await getDropdownOption(page, followUpMenuOption);
      await option.click();
      await waitForSaveChartDataResponse(page);
    });

    test("Should update 'Primary Care Physician' 'Note' section", async () => {
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
    });

    test('Should check follow up message and note are saved on Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      const patientInstructionsContainer = page.getByTestId(
        dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer
      );
      await expect(patientInstructionsContainer).toBeVisible();
      await expect(patientInstructionsContainer).toHaveText(new RegExp(updatedNote));
      await expect(patientInstructionsContainer).toHaveText(new RegExp(followUpMessage));
    });
  });

  test.describe('Transfer to another location', async () => {
    const PROCESS_ID = `planTab.spec.ts-transfer-${DateTime.now().toMillis()}`;
    const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
    let page: Page;
    const defaultNote = 'Please proceed to the ABC Office as advised.';
    const updatedNote = 'Lorem ipsum';
    const reasonForTransferOption = 'Equipment availability';

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

    test("Should check 'Note' section has pre-filled text for 'Transfer to another location' selected", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
    });

    test("Should select some 'Reason for transfer' option", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionReasonForTransferDropdown).click();
      const option = await getDropdownOption(page, reasonForTransferOption);
      await option.click();
      await waitForSaveChartDataResponse(page);
    });

    test('Should edit transfer Note', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(
        new RegExp(defaultNote)
      );
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
    });

    test('Should check reason for transfer and note are saved on Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      const patientInstructionsContainer = page.getByTestId(
        dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer
      );
      await expect(patientInstructionsContainer).toHaveText(new RegExp(updatedNote));
      await expect(patientInstructionsContainer).toHaveText(new RegExp(reasonForTransferOption));
    });
  });

  test.describe('Speciality transfer', async () => {
    const PROCESS_ID = `planTab.spec.ts-specialty-transfer-${DateTime.now().toMillis()}`;
    const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
    let page: Page;
    const updatedNote = 'Lorem ipsum';
    const followUpMenuOption = '3 days';
    const followUpMessage = 'Follow-up visit in 3 days';

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

    test("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Specialty transfer' selected", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.plan)).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionContainer)).toBeVisible();

      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionToggleButton('specialty')).click();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toBeVisible();
    });

    test("Should check 'Note' field is empty by default for 'Specialty transfer' selected", async () => {
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote).locator('textarea').first()
      ).toHaveText('');
    });

    test("Should select some 'Follow up visit in' option", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown).click();
      const option = await getDropdownOption(page, followUpMenuOption);
      await option.click();
      await waitForSaveChartDataResponse(page);
    });

    test('Should edit transfer note', async () => {
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await waitForSaveChartDataResponse(page);
    });

    test('Should check follow up message and transfer note are saved on Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      const patientInstructionsContainer = page.getByTestId(
        dataTestIds.telemedEhrFlow.reviewTabPatientInstructionsContainer
      );
      await expect(patientInstructionsContainer).toHaveText(new RegExp(updatedNote));
      await expect(patientInstructionsContainer).toHaveText(new RegExp(followUpMessage));
    });
  });
});
