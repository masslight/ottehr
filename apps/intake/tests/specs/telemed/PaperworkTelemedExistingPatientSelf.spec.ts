// cSpell:ignore VVPPS
import { BrowserContext, expect, Page, test } from '@playwright/test';
import {
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  chooseJson,
  CreateAppointmentResponse,
  shouldShowServiceCategorySelectionPage,
} from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import {
  CARD_NUMBER,
  Paperwork,
  PATIENT_ADDRESS,
  PATIENT_ADDRESS_LINE_2,
  PATIENT_CITY,
  PATIENT_ZIP,
  RELATIONSHIP_RESPONSIBLE_PARTY_SELF,
} from '../../utils/Paperwork';
import { FillingInfo } from '../../utils/telemed/FillingInfo';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookTelemedFlow;
let bookingData: Awaited<ReturnType<PrebookTelemedFlow['startVisitFullFlow']>>;
let filledPaperwork: Awaited<ReturnType<Paperwork['fillPaperworkAllFieldsTelemed']>>;
let fillingInfo: FillingInfo;
let paperwork: Paperwork;
let locator: Locators;
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
  flowClass = new PrebookTelemedFlow(page);
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  fillingInfo = new FillingInfo(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisitFullFlow();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Virtual visit. Check paperwork is prefilled for existing patient. Payment - card, responsible party - self', () => {
  test.beforeAll(async () => {
    test.setTimeout(200000);
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    filledPaperwork = await paperwork.fillPaperworkAllFieldsTelemed('card', 'self');
    await locator.finishButton.click();
    await page.waitForTimeout(1_000);
    await page.goto('/home');
    await locator.scheduleVirtualVisitButton.click();
    if (shouldShowServiceCategorySelectionPage({ serviceMode: 'in-person', visitType: 'prebook' })) {
      const availableCategories = BOOKING_CONFIG.serviceCategories || [];
      const firstCategory = availableCategories[0]!;

      if (firstCategory) {
        await page.getByText(firstCategory.display).click();
      }
    }
    await paperwork.checkCorrectPageOpens('Book a visit');
    await flowClass.selectTimeLocationAndContinue();

    await page
      .getByTestId(`${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}`)
      .locator('input[type="radio"]')
      .click({ timeout: 40_000, noWaitAfter: true, force: true });

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
    await paperwork.checkCorrectPageOpens(`Thank you for choosing ${BRANDING_CONFIG.projectName}!`);
  });
  test('VVPPS-1 Check Responsible party has prefilled values', async () => {
    const dob = commonLocatorsHelper.getMonthDay(
      bookingData.patientBasicInfo.dob.m,
      bookingData.patientBasicInfo.dob.d
    );
    if (!dob) {
      throw new Error('DOB data is null');
    }
    await page.goto(`paperwork/${appointmentIds[1]}/responsible-party`);
    await expect(locator.responsiblePartyFirstName).toHaveValue(bookingData.patientBasicInfo.firstName);
    await expect(locator.responsiblePartyLastName).toHaveValue(bookingData.patientBasicInfo.lastName);
    await expect(locator.responsiblePartyBirthSex).toHaveValue(bookingData.patientBasicInfo.birthSex);
    await expect(locator.responsiblePartyDOBAnswer).toHaveValue(
      `${dob?.monthNumber}/${dob?.dayNumber}/${bookingData.patientBasicInfo.dob.y}`
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
    await expect(locator.responsiblePartyEmail).toHaveValue(bookingData.patientBasicInfo.email);
  });
  test('VVPPS-2 Check Payment screen does not have preselected card option', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/payment-option`);
    await expect(locator.selfPayOption).not.toBeChecked();
  });
  // TODO: Need to remove skip when https://github.com/masslight/ottehr/issues/1988 is fixed
  test.skip('VVPPS-3 Check Card payment has prefilled and preselected card', async () => {
    await page.goto(`paperwork/${appointmentIds[1]}/card-payment`);
    const lastFour = CARD_NUMBER.slice(-4);
    const masked = `XXXX - XXXX - XXXX - ${lastFour}`;
    await expect(locator.selectedCard).toBeChecked();
    await expect(locator.cardNumberFilled).toHaveText(masked);
  });
});
