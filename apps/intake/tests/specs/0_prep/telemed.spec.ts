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

test.describe.parallel('Telemed: Create test patients and appointments', () => {
  test('Create prebook patient with self-pay and card payment prebook appointment', async ({ browser, page }) => {
    const { prebookFlowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
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
      return { prebookFlowClass, paperwork, locator, fillingInfo };
    });

    const bookingData = await test.step('Book first appointment', async () => {
      const bookingData = await prebookFlowClass.startVisitFullFlow();
      await page.goto(bookingData.bookingURL);
      await paperwork.clickProceedToPaperwork();
      await paperwork.fillPaperworkAllFieldsTelemed('insurance', 'not-self');
      await locator.finishButton.click();
      return bookingData;
    });

    await test.step('Book second appointment without filling paperwork', async () => {
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
          name: new RegExp(
            `.*${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}.*`,
            'i'
          ),
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
    });

    await test.step('Write test data to file', async () => {
      const prebookTelemedPatient = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: appointmentIds[appointmentIds.length - 1],
      };
      console.log('prebookTelemedPatient', JSON.stringify(prebookTelemedPatient));
      writeTestData('prebookTelemedPatient.json', prebookTelemedPatient);
    });
  });

  test('Create walk-in patient without self-pay with insurance payment walk-in appointment', async ({
    browser,
    page,
  }) => {
    const { walkInFlowClass, paperwork, locator, fillingInfo } = await test.step('Set up playwright', async () => {
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
      return { walkInFlowClass, paperwork, locator, fillingInfo };
    });

    const bookingData = await test.step('Book first appointment', async () => {
      // this uses the card payment and responsible party is self flow
      const bookingData = await walkInFlowClass.startVisitFullFlow();
      const cancelPage = new CancelPage(page);
      await cancelPage.clickCancelButton();
      await cancelPage.selectCancellationReason('virtual');
      return bookingData;
    });

    await test.step('Book second appointment without filling paperwork', async () => {
      await page.goto('/home');
      await locator.startVirtualVisitButton.click();
      await walkInFlowClass.selectTimeLocationAndContinue();
      await page
        .getByRole('heading', {
          name: new RegExp(
            `.*${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}.*`,
            'i'
          ),
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
    });

    await test.step('Write test data to file', async () => {
      const walkInTelemedPatient = {
        firstName: bookingData.patientBasicInfo.firstName,
        lastName: bookingData.patientBasicInfo.lastName,
        email: bookingData.patientBasicInfo.email,
        birthSex: bookingData.patientBasicInfo.birthSex,
        dateOfBirth: bookingData.patientBasicInfo.dob,
        appointmentId: appointmentIds[appointmentIds.length - 1],
      };
      console.log('walkInTelemedPatient', JSON.stringify(walkInTelemedPatient));
      writeTestData('walkInTelemedPatient.json', walkInTelemedPatient);
    });
  });
});
