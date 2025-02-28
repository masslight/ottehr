import { BrowserContext, test, Page, expect } from '@playwright/test';
import { cleanAppointment } from 'test-utils';
import { Locators } from '../../utils/locators';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Paperwork } from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let pcpData: Awaited<ReturnType<Paperwork['fillPrimaryCarePhysician']>>;
const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointment } = await response.json();
      if (appointment && !appointmentIds.includes(appointment)) {
        appointmentIds.push(appointment);
      }
    }
  });
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  bookingData = await flowClass.startVisit();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
  const env = process.env.ENV;
  for (const appointment of appointmentIds) {
    console.log(`Deleting ${appointment} on env: ${env}`);
    await cleanAppointment(appointment, env!);
  }
});

test.describe.configure({ mode: 'serial' });
test.describe('Contact information screen - Check and fill all fields', () => {
  test('PCI-1 Click on [Proceed to paperwork] - Contact information screen opens', async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.checkContactInformationPageOpens();
  });
  test('PCI-2 Fill Contact Information all fields', async () => {
    await paperwork.fillContactInformationAllFields();
  });
  test('PCI-3 Contact Information - Check email is prefilled', async () => {
    await paperwork.checkEmailIsPrefilled(bookingData.email);
  });
  test('PCI-4 Contact Information - Check mobile is prefilled', async () => {
    await paperwork.checkMobileIsPrefilled(process.env.PHONE_NUMBER || '');
  });
  test('PCI-5 Contact Information - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('PPD-1 Click on [Continue] - Patient details screen opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Patient details');
  });
});
test.describe('Patient details screen - Check and fill all fields', () => {
  test('PPD-1 Check required fields', async () => {
    await paperwork.checkRequiredFields('"Ethnicity","Race","Preferred language"', 'Patient details');
  });
  test('PPD-2 Fill Patient details all fields', async () => {
    await paperwork.fillPatientDetailsAllFields();
  });
  test('PPD-3 Patient details - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('PPD-4 Patient details - Fill not listed pronoun', async () => {
    await paperwork.fillNotListedPronouns();
  });
  test('PPD-5 Click on [Continue] - Primary Care Physician', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
});
test.describe('Primary Care Physician - Check and fill all fields', () => {
  test('PPCP-1 Primary Care Physician - Check patient name is displayed', async () => {
    await paperwork.checkPatientNameIsDisplayed(bookingData.firstName, bookingData.lastName);
  });
  test('PPCP-2 Click on [Continue] with empty fields - Primary Care Physician opens', async () => {
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PPCP-3 Click on [Back] - Primary Care Physician opens', async () => {
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
  });
  test('PPCP-4 Check phone field validation', async () => {
    await paperwork.checkPhoneValidations(locator.pcpNumber, locator.pcpNumberErrorText);
  });
  test('PPCP-5 Fill all fields and click [Continue]', async () => {
    pcpData = await paperwork.fillPrimaryCarePhysician();
    await locator.clickContinueButton();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
  });
  test('PPCP-6 Click on [Back] - fields have correct values', async () => {
    await locator.clickBackButton();
    await expect(locator.pcpFirstName).toHaveValue(pcpData.firstName);
    await expect(locator.pcpLastName).toHaveValue(pcpData.lastName);
    await expect(locator.pcpAddress).toHaveValue(pcpData.pcpAddress);
    await expect(locator.pcpPractice).toHaveValue(pcpData.pcpName);
    await expect(locator.pcpNumber).toHaveValue(pcpData.formattedPhoneNumber);
  });
});
