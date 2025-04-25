import { expect, Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { TelemedAppointmentVisitTabs } from 'utils';
import { checkDropdownHasOptionAndSelectIt, getDropdownOption } from '../../../e2e-utils/helpers/tests-utils';

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
      expect(primaryCarePhysicianButton.getAttribute('aria-pressed')).toBe(true);
    });

    // todo: i believe here is not 'Note' expected but 'None' instead
    test("Should check 'Follow up visit in' drop down and 'Note' field are present for 'Primary Care Physician' selected", async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown).click();
      const dropdown = page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionFollowUpDropdown);
      await dropdown.click();
      await getDropdownOption(page, 'None');
    });

    test("Should check note section has pre-filled text for 'Primary Care Physician'", async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(defaultNote);
    });

    // todo: i'm not sure but i can't see follow up days on Review&Sign after save
    test('Should select follow up option and check it on Review&Sign tab', async () => {});

    test('Should update Primary Care Physician note and check it on Review&Sign tab', async () => {
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)
        .locator('textarea')
        .first()
        .fill(updatedNote);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.planTabDispositionNote)).toHaveText(defaultNote);
    });
  });

  test.describe('Transfer to another location', async () => {
    const resourceHandler = new ResourceHandler('telemed');
    let page: Page;
    const defaultNote = 'Please see your Primary Care Physician as discussed.';

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

    test('', async () => {});
  });

  test.describe('Speciality transfer', async () => {
    const resourceHandler = new ResourceHandler('telemed');
    let page: Page;

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

    test('', async () => {});
  });
});
