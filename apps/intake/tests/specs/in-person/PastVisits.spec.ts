import { test } from '@playwright/test';
import { waitForResponseWithData } from 'test-utils';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { Homepage } from '../../utils/in-person/Homepage';
import { PastVisitsPage } from '../../utils/in-person/PastVisitsPage';
import { FillingInfo } from '../../utils/telemed/FillingInfo';

let patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined;
const appointmentIds: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { resources } = chooseJson(await response.json()) as CreateAppointmentResponse;
      const id = resources?.appointment.id;
      if (id) {
        appointmentIds.push(id);
      }
    }
  });
});

test.describe.serial('Past Visits - Empty State', () => {
  test('Should create new patient', async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();

    await homepage.clickStartVirtualVisitButton();
    await homepage.selectState();

    await page.getByTestId('Different family member').click();
    await homepage.clickContinue();

    const fillingInfo = new FillingInfo(page);

    patientInfo = await fillingInfo.fillNewPatientInfo();
    await fillingInfo.fillDOBless18();

    await homepage.clickContinue();
    await homepage.clickContinue();
    await waitForResponseWithData(page, '/create-appointment/');
  });

  test('should show empty state when no past visits exist', async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();
    await homepage.verifyPastVisitsButton();
    await homepage.clickPastVisitsButton();

    const patientName = page.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`);
    await patientName.scrollIntoViewIfNeeded();
    await patientName.click();

    await homepage.clickContinue();

    const pastVisitsPage = new PastVisitsPage(page);
    await pastVisitsPage.verifyEmptyState();
  });

  test('should navigate back to homepage when clicking Back to homepage button', async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();
    await homepage.verifyPastVisitsButton();
    await homepage.clickPastVisitsButton();

    const patientName = page.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`);
    await patientName.scrollIntoViewIfNeeded();
    await patientName.click();

    await homepage.clickContinue();
    const pastVisitsPage = new PastVisitsPage(page);

    await pastVisitsPage.verifyBackButton();
    await pastVisitsPage.clickBackToHomepageButton();
    await homepage.verifyPage();
  });
});
