// cSpell:ignore IPPPS
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { FillingInfo } from '../../utils/in-person/FillingInfo';
import { Locators } from '../../utils/locators';
import {
  Paperwork,
  PATIENT_ADDRESS,
  PATIENT_ADDRESS_LINE_2,
  PATIENT_CITY,
  PATIENT_ZIP,
  RELATIONSHIP_RESPONSIBLE_PARTY_SELF,
  CARD_NUMBER,
} from '../../utils/Paperwork';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let filledPaperwork: Awaited<ReturnType<Paperwork['fillPaperworkAllFieldsInPerson']>>;
let fillingInfo: FillingInfo;
let commonLocatorsHelper: CommonLocatorsHelper;
const appointmentIds: string[] = [];

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      if (!appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
    }
  });
  flowClass = new PrebookInPersonFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  fillingInfo = new FillingInfo(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisit();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Check paperwork is prefilled for existing patient. Payment - card, responsible party - self', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    filledPaperwork = await paperwork.fillPaperworkAllFieldsInPerson('card', 'self');
    await locator.finishButton.click();
    await page.goto('/home');
    await locator.scheduleInPersonVisitButton.click();
    await flowClass.additionalStepsForPrebook();
    await paperwork.checkCorrectPageOpens('Welcome Back!');
    await page
      .getByRole('heading', { name: new RegExp(`.*${bookingData.firstName} ${bookingData.lastName}.*`, 'i') })
      .click();
    await locator.continueButton.click();
    await fillingInfo.fillCorrectDOB(bookingData.dobMonth, bookingData.dobDay, bookingData.dobYear);
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('About the patient');
    await fillingInfo.fillVisitReason();
    await locator.continueButton.click();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await locator.reserveButton.click();
    await paperwork.checkCorrectPageOpens('Thank you for choosing Ottehr!');
  });
  test('IPPPS-1 Check Responsible party has prefilled values', async () => {
    const dob = await commonLocatorsHelper.getMonthDay(bookingData.dobMonth, bookingData.dobDay);
    if (!dob) {
      throw new Error('DOB data is null');
    }
    await page.goto(`paperwork/${appointmentIds[1]}/responsible-party`);
    await expect(locator.responsiblePartyFirstName).toHaveValue(bookingData.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(bookingData.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(bookingData.birthSex);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
      `${dob?.monthNumber}/${dob?.dayNumber}/${bookingData.dobYear}`
    );
    await expect(locator.responsiblePartyRelationship).toHaveValue(RELATIONSHIP_RESPONSIBLE_PARTY_SELF);
    await expect(locator.responsiblePartyCity).toHaveValue(PATIENT_CITY);
    await expect(locator.responsiblePartyState).toHaveValue(filledPaperwork.stateValue);
    await expect(locator.responsiblePartyZip).toHaveValue(PATIENT_ZIP);
    await expect(locator.responsiblePartyAddress1).toHaveValue(PATIENT_ADDRESS);
    await expect(locator.responsiblePartyAddress2).toHaveValue(PATIENT_ADDRESS_LINE_2);
    await expect(locator.responsiblePartyNumber).toHaveValue(
      paperwork.formatPhoneNumber(process.env.PHONE_NUMBER || '')
    );
  });
  test('IPPPS-2 Check Payment screen does not have preselected card option', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/payment-option`);
    await expect(locator.selfPayOption).not.toBeChecked();
  });
  test('IPPPS-3 Check Card payment has prefilled and preselected card', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/card-payment`);
    const lastFour = CARD_NUMBER.slice(-4);
    const masked = `XXXX - XXXX - XXXX - ${lastFour}`;
    await expect(locator.selectedCard).toBeChecked();
    await expect(locator.cardNumberFilled).toHaveText(masked);
  });
});
