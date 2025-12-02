import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import { DateTime } from 'luxon';
import * as path from 'path';
import { Homepage } from 'tests/utils/in-person/Homepage';
import { PastVisitsPage } from '../../utils/in-person/PastVisitsPage';
import { InPersonPatientSelfTestData, InPersonPatientTestData } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let emptyPatient: InPersonPatientTestData;
let appointmentPatient: InPersonPatientSelfTestData;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();

  const emptyTestDataPath = path.join('test-data', 'patientWithoutPaperwork.json');
  emptyPatient = JSON.parse(fs.readFileSync(emptyTestDataPath, 'utf-8'));

  const appointmentTestDataPath = path.join('test-data', 'cardPaymentSelfPatient.json');
  appointmentPatient = JSON.parse(fs.readFileSync(appointmentTestDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('Past Visits', async () => {
  test('PV-1. Empty State', async ({ page }) => {
    const homepage = new Homepage(page);
    let pastVisitsPage: PastVisitsPage;
    const patientFullName = `${emptyPatient?.firstName} ${emptyPatient?.lastName}`;

    await test.step('PV-1.1. Open past visits page', async () => {
      await homepage.navigate();
      await homepage.verifyPastVisitsButton();
      await homepage.clickPastVisitsButton();

      const patientName = page.getByText(patientFullName);
      await patientName.scrollIntoViewIfNeeded();
      await patientName.click();
      await homepage.clickContinue();
    });

    await test.step('PV-1.2. Check empty state', async () => {
      pastVisitsPage = new PastVisitsPage(page);
      await pastVisitsPage.verifyEmptyState();
    });

    await test.step('PV-1.3. Check navigation back to homepage', async () => {
      await pastVisitsPage.verifyBackButton();
      await pastVisitsPage.clickBackToHomepageButton();
      await homepage.verifyPage();
    });
  });

  test('PV-2. Past Visits List', async ({ page }) => {
    const homepage = new Homepage(page);
    let pastVisitsPage: PastVisitsPage;
    const patientFullName = `${appointmentPatient?.firstName} ${appointmentPatient?.lastName}`;
    expect(appointmentPatient.cancelledSlotDetails).toBeDefined();

    await test.step('PV-2.1. Open past visits page', async () => {
      await homepage.navigate();
      await homepage.verifyPastVisitsButton();
      await homepage.clickPastVisitsButton();

      const patientName = page.getByText(patientFullName);
      await patientName.scrollIntoViewIfNeeded();
      await patientName.click();
      await homepage.clickContinue();
    });

    await test.step('PV-2.2. Check non-empty state', async () => {
      pastVisitsPage = new PastVisitsPage(page);
      await pastVisitsPage.verifyNonEmptyState();
    });

    await test.step('PV-2.3. Check appointment details', async () => {
      await expect(
        page.getByText(
          DateTime.fromISO(appointmentPatient.cancelledSlotDetails!.startISO)
            .setZone(appointmentPatient.cancelledSlotDetails!.timezoneForDisplay)
            .toFormat("MMMM dd, yyyy 'at' h:mm a")
        )
      ).toBeVisible();
      await expect(page.getByText(`Visit ID: ${appointmentPatient.cancelledSlotDetails!.appointmentId}`)).toBeVisible();
      await expect(page.getByText('(In-Person)')).toBeVisible();
      await expect(page.getByText('Canceled')).toBeVisible();
    });
  });
});
