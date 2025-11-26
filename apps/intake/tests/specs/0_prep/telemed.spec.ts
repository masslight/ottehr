import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CancelPage } from 'tests/utils/CancelPage';
import { BOOKING_CONFIG, chooseJson, CreateAppointmentResponse, shouldShowServiceCategorySelectionPage } from 'utils';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { TelemedVisitFlow } from '../../utils/telemed/TelemedVisitFlow';

const appointmentIds: string[] = [];

function writeTestData(filename: string, data: unknown): void {
  const testDataPath = 'test-data';
  if (!fs.existsSync(testDataPath)) {
    fs.mkdirSync(testDataPath, { recursive: true });
  }
  fs.writeFileSync(path.join(testDataPath, filename), JSON.stringify(data, null, 2));
}

test.describe.parallel('Telemed Setup: Create test patients and appointments', () => {
  test('Create patient with self-pay and card payment prebook appointment', async ({ browser, page }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    page.on('response', async (response) => {
      if (response.url().includes('/create-appointment/')) {
        const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
        if (!appointmentIds.includes(appointmentId)) {
          appointmentIds.push(appointmentId);
        }
      }
    });
    const prebookFlowClass = new PrebookTelemedFlow(page);
    const paperwork = new Paperwork(page);
    const locator = new Locators(page);
    const fillingInfo = new FillingInfo(page);

    const bookingData = await prebookFlowClass.startVisitFullFlow();
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.fillPaperworkAllFieldsTelemed('insurance', 'not-self');
    await locator.finishButton.click();

    // book a new appointment but don't fill paperwork again
    await page.goto('/home');
    await locator.scheduleVirtualVisitButton.click();
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'virtual', visitType: 'prebook' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await page.getByText(firstCategory.display).click();
      }
    }
    await paperwork.checkCorrectPageOpens('Book a visit');
    await prebookFlowClass.selectTimeLocationAndContinue();
    await page
      .getByRole('heading', {
        name: new RegExp(`.*${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}.*`, 'i'),
      })
      .click();
    await locator.continueButton.click();
    await fillingInfo.fillCorrectDOB(
      bookingData.patientBasicInfo.dob.m,
      bookingData.patientBasicInfo.dob.d,
      bookingData.patientBasicInfo.dob.y
    );
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('About the patient');
    await fillingInfo.fillTelemedReasonForVisit();
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.reserveButton.click();
    await paperwork.checkCorrectPageOpens('Thank you for choosing Ottehr!');

    const prebookTelemedPatient = {
      firstName: bookingData.patientBasicInfo.firstName,
      lastName: bookingData.patientBasicInfo.lastName,
      email: bookingData.patientBasicInfo.email,
      birthSex: bookingData.patientBasicInfo.birthSex,
      dateOfBirth: bookingData.patientBasicInfo.dob,
      appointmentId: appointmentIds[appointmentIds.length - 1],
    };

    writeTestData('prebookTelemedPatient.json', prebookTelemedPatient);

    console.log('prebookTelemedPatient', JSON.stringify(prebookTelemedPatient));
    console.log('Appointment IDs:', appointmentIds);
  });

  test('Create patient without self-pay with insurance payment walk-in appointment', async ({ browser, page }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    page.on('response', async (response) => {
      if (response.url().includes('/create-appointment/')) {
        const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
        if (!appointmentIds.includes(appointmentId)) {
          appointmentIds.push(appointmentId);
        }
      }
    });

    const walkInFlowClass = new TelemedVisitFlow(page);
    const paperwork = new Paperwork(page);
    const locator = new Locators(page);
    const fillingInfo = new FillingInfo(page);

    // this uses the card payment and responsible party is self flow
    const bookingData = await walkInFlowClass.startVisitFullFlow();
    const cancelPage = new CancelPage(page);
    await cancelPage.clickCancelButton();
    await cancelPage.selectCancellationReason('virtual');

    // book a new appointment but don't fill paperwork again
    await page.goto('/home');
    await locator.startVirtualVisitButton.click();
    await walkInFlowClass.selectTimeLocationAndContinue();
    await page
      .getByRole('heading', {
        name: new RegExp(`.*${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}.*`, 'i'),
      })
      .click();
    await locator.continueButton.click();
    await fillingInfo.fillCorrectDOB(
      bookingData.patientBasicInfo.dob.m,
      bookingData.patientBasicInfo.dob.d,
      bookingData.patientBasicInfo.dob.y
    );
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('About the patient');
    await fillingInfo.fillTelemedReasonForVisit();
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.confirmWalkInButton.click();
    await paperwork.checkCorrectPageOpens('Contact information');

    const walkInTelemedPatient = {
      firstName: bookingData.patientBasicInfo.firstName,
      lastName: bookingData.patientBasicInfo.lastName,
      email: bookingData.patientBasicInfo.email,
      birthSex: bookingData.patientBasicInfo.birthSex,
      dateOfBirth: bookingData.patientBasicInfo.dob,
      appointmentId: appointmentIds[appointmentIds.length - 1],
    };

    writeTestData('walkInTelemedPatient.json', walkInTelemedPatient);

    console.log('walkInTelemedPatient', JSON.stringify(walkInTelemedPatient));
    console.log('Appointment IDs:', appointmentIds);
  });
});
