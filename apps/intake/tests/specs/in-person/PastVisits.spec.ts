import { BrowserContext, Page, test } from '@playwright/test';
import { PastVisitsPage } from '../../utils/in-person/PastVisitsPage';
import { Homepage } from '../../utils/in-person/Homepage';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { cleanAppointment } from 'test-utils';

let patientInfo: Awaited<ReturnType<FillingInfo['fillNewPatientInfo']>> | undefined;
let context: BrowserContext;
let page: Page;

const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();

  page.on('response', async (response) => {
    if (response.url().includes('/telemed-create-appointment/')) {
      const { appointmentId } = await response.json();
      if (appointmentId && !appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
    }
  });
});

test.afterAll(async () => {
  await page.close();
  await context.close();
  const env = process.env.ENV;

  for (const appointmentId of appointmentIds) {
    console.log(`Deleting ${appointmentId} on env: ${env}`);
    await cleanAppointment(appointmentId, env!);
  }
});

test.describe('Past Visits - Empty State', () => {
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
    await page.waitForResponse((response) => response.url().includes('/telemed-create-appointment/'));
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
