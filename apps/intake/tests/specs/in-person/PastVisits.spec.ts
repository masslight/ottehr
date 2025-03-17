import { test } from '@playwright/test';
import { cleanAppointment, waitForResponseWithData } from 'test-utils';
import { CreateAppointmentUCTelemedResponse } from 'utils';
import { Homepage } from '../../utils/in-person/Homepage';
import { PastVisitsPage } from '../../utils/in-person/PastVisitsPage';
import { FillingInfo } from '../../utils/telemed/FillingInfo';

let patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined;
const appointmentIds: string[] = [];

test.beforeEach(async ({ page }) => {
  page.on('response', async (response) => {
    if (response.url().includes('/telemed-create-appointment')) {
      const { resources } = (await response.json()) as CreateAppointmentUCTelemedResponse;
      const id = resources?.appointment.id;

      if (id) {
        appointmentIds.push(id);
      }
    }
  });
});

test.afterAll(async () => {
  const env = process.env.ENV;

  for (const appointmentId of appointmentIds) {
    console.log(`Deleting ${appointmentId} on env: ${env}`);
    await cleanAppointment(appointmentId, env!);
  }
});

test.describe.serial('Past Visits - Empty State', () => {
  test('Should create new patient', async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();

    await homepage.clickStartVirtualVisitButton();

    await page.getByTestId('Different family member').click();
    await homepage.clickContinue();

    await homepage.selectState();

    await homepage.clickContinue();

    const fillingInfo = new FillingInfo(page);

    patientInfo = await fillingInfo.fillNewPatientInfo();
    await fillingInfo.fillDOBless18();

    await page.getByRole('button', { name: 'Continue' }).click();
    await waitForResponseWithData(page, '/telemed-create-appointment/');
  });

  test('should show empty state when no past visits exist', async ({ page }) => {
    const homepage = new Homepage(page);
    await homepage.navigate();
    await homepage.verifyPastVisitsButton();
    await homepage.clickPastVisitsButton();

    const patientName = page.getByText(`${patientInfo?.firstName} ${patientInfo?.lastName}`);
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
    await patientName.click();

    await homepage.clickContinue();
    const pastVisitsPage = new PastVisitsPage(page);

    await pastVisitsPage.verifyBackButton();
    await pastVisitsPage.clickBackToHomepageButton();
    await homepage.verifyPage();
  });
});
