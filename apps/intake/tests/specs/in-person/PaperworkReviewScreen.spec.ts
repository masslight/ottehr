// cSpell:ignore networkidle
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { PrebookInPersonFlow } from '../../utils/in-person/PrebookInPersonFlow';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { UploadDocs } from '../../utils/UploadDocs';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookInPersonFlow;
let bookingData: Awaited<ReturnType<PrebookInPersonFlow['startVisit']>>;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadDocs;
let commonLocators: CommonLocatorsHelper;
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
  uploadPhoto = new UploadDocs(page);
  commonLocators = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisit();
  expect.soft(bookingData.slotDetails).toBeDefined();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Paperwork.Review and Submit - Check Complete/Missing chips', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRS-1 Review and Submit - Check Complete/Missing chips', async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.checkCorrectPageOpens('Contact information');
    await paperwork.fillPaperworkOnlyRequiredFieldsInPerson();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await expect(locator.contactInformationChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.patientDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    // need to uncomment when https://github.com/masslight/ottehr/issues/1594 is fixed
    // await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'uncompleted');
    await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.insuranceDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.responsiblePartyChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.photoIdChipStatus).toHaveAttribute('data-testid', 'uncompleted');
    await expect(locator.consentFormsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.continueButton).toBeVisible();
  });
  // TO DO - Add test for filling and checking pcp chip after https://github.com/masslight/ottehr/issues/1594 fix
  test('PRS-2 Add Photo IDs, check all chips are completed, [Finish] button is visible', async () => {
    await locator.photoIdEditButton.click();
    await paperwork.checkCorrectPageOpens('Photo ID');
    await uploadPhoto.fillPhotoFrontID();
    await uploadPhoto.fillPhotoBackID();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await paperwork.checkAllChipsAreCompletedInPerson();
    await expect(locator.finishButton).toBeVisible();
  });
  test('PRS-3 Select Insurance, fill required fields, check all chips are completed, [Finish] button is visible', async () => {
    await locator.insuranceDetailsEditButton.click();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await paperwork.selectInsurancePayment();
    await expect(locator.insuranceHeading).toBeVisible();
    await paperwork.fillInsuranceRequiredFields(false);
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await paperwork.checkAllChipsAreCompletedInPerson();
    await expect(locator.finishButton).toBeVisible();
  });
  test('PRS-4 All chips are completed after reload', async () => {
    await page.reload();
    await paperwork.checkAllChipsAreCompletedInPerson();
    await expect(locator.finishButton).toBeVisible();
  });
});
test.describe('Paperwork.Review and Submit - Check values', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRS-5 Open review page', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/review`);
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-6 Check patient name', async () => {
    await expect(locator.patientNamePaperworkReviewScreen).toHaveText(
      `${bookingData.firstName} ${bookingData.lastName}`
    );
  });
  test('PRS-7 Check location', async () => {
    expect.soft(bookingData.slotDetails?.ownerName).toBeDefined();
    await expect(locator.locationNamePaperworkReviewScreen).toHaveText(`${bookingData.slotDetails?.ownerName}`);
  });
  test('PRS-8 Check check in time', async () => {
    await expect(locator.checkInTimePaperworkReviewScreen).toHaveText(`${bookingData.selectedSlot}`);
  });
  test('PRS-9 Check privacy policy link', async () => {
    await commonLocators.checkLinkOpensPdf(locator.privacyPolicyReviewScreen);
  });
  test('PRS-10 Check terms and conditions link', async () => {
    await commonLocators.checkLinkOpensPdf(locator.termsAndConditions);
  });
});
test.describe('Paperwork.Review and Submit - Check edit icons', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRS-11 Open review page', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/review`);
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-12 Edit opens contact information', async () => {
    await locator.contactInformationEditButton.click();
    await paperwork.checkCorrectPageOpens('Contact information');
    await page.goBack({ waitUntil: 'load' });
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-13 Edit opens patient details', async () => {
    await locator.patientDetailsEditButton.click();
    await paperwork.checkCorrectPageOpens('Patient details');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-14 Edit opens primary care physician', async () => {
    await locator.pcpEditButton.click();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-15 Edit opens payment options', async () => {
    await locator.insuranceDetailsEditButton.click();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-16 Edit opens responsible party information', async () => {
    await locator.responsiblePartyEditButton.click();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-17 Edit opens photo ID', async () => {
    await locator.photoIdEditButton.click();
    await paperwork.checkCorrectPageOpens('Photo ID');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRS-18 Edit opens consent forms', async () => {
    await locator.consentFormsEditButton.click();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
});
