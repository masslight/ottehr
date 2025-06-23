// cSpell:ignore networkidle, PRST
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { chooseJson, CreateAppointmentResponse } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { PrebookTelemedFlow } from '../../utils/telemed/PrebookTelemedFlow';
import { UploadDocs } from '../../utils/UploadDocs';

let page: Page;
let context: BrowserContext;
let flowClass: PrebookTelemedFlow;
let bookingData: Awaited<ReturnType<PrebookTelemedFlow['startVisitFullFlow']>>;
let paperwork: Paperwork;
let locator: Locators;
let uploadDocs: UploadDocs;
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
  uploadDocs = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  bookingData = await flowClass.startVisitFullFlow();
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe('Paperwork.Review and Submit - Check Complete/Missing chips', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRST-1 Review and Submit - Check Complete/Missing chips', async () => {
    await page.goto(bookingData.bookingURL);
    await paperwork.clickProceedToPaperwork();
    await paperwork.checkCorrectPageOpens('Contact information');
    await paperwork.fillPaperworkOnlyRequiredFieldsTelemed();
    await paperwork.checkCorrectPageOpens('Review and submit');
    await expect(locator.contactInformationChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.patientDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    // need to uncomment when https://github.com/masslight/ottehr/issues/1594 is fixed
    // await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'uncompleted');
    await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.currentMedicationsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.currentAllergiesChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.medicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.surgicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.additionalQuestionsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.insuranceDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.responsiblePartyChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.photoIdChipStatus).toHaveAttribute('data-testid', 'uncompleted');
    // need to uncomment when https://github.com/masslight/ottehr/issues/1594 is fixed
    // await expect(locator.patientConditionChipStatus).toHaveAttribute('data-testid', 'uncompleted');
    await expect(locator.patientConditionChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.schoolWorkNotesChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.consentFormsChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.inviteParticipantChipStatus).toHaveAttribute('data-testid', 'completed');
    await expect(locator.continueButton).toBeVisible();
  });
  // TO DO - Add test for filling and checking pcp chip after https://github.com/masslight/ottehr/issues/1594 fix
  // TO DO - Add test for filling and checking photo condition after https://github.com/masslight/ottehr/issues/1594 fix
  test('PRST-2 Add Photo IDs, check all chips are completed, [Finish] button is visible', async () => {
    await locator.photoIdEditButton.click();
    await paperwork.checkCorrectPageOpens('Photo ID');
    await uploadDocs.fillPhotoFrontID();
    await uploadDocs.fillPhotoBackID();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await paperwork.checkAllChipsAreCompletedTelemed();
    await expect(locator.finishButton).toBeVisible();
  });
  test('PRST-3 Select Insurance, fill required fields, check all chips are completed, [Finish] button is visible', async () => {
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
    await locator.clickContinueButton();
    await locator.clickContinueButton();
    await paperwork.checkAllChipsAreCompletedInPerson();
    await expect(locator.finishButton).toBeVisible();
  });
  test('PRST-4 All chips are completed after reload', async () => {
    await page.reload();
    await paperwork.checkAllChipsAreCompletedTelemed();
    await expect(locator.finishButton).toBeVisible();
  });
});
test.describe('Paperwork.Review and Submit - Check values', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRST-5 Open review page', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/review`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-6 Check patient name', async () => {
    await expect(locator.patientNamePaperworkReviewScreen).toHaveText(
      `${bookingData.patientBasicInfo.firstName} ${bookingData.patientBasicInfo.lastName}`
    );
  });
  test('PRST-7 Check location', async () => {
    await expect(locator.locationNamePaperworkReviewScreen).toHaveText(`${bookingData.slotAndLocation.locationTitle}`);
  });
  test('PRST-8 Check check in time', async () => {
    await expect(locator.checkInTimePaperworkReviewScreen).toHaveText(
      `${bookingData.slotAndLocation.selectedSlot?.fullSlot}`
    );
  });
  test('PRST-9 Check privacy policy link', async () => {
    await commonLocatorsHelper.checkLinkOpensPdf(locator.privacyPolicyReviewScreen);
  });
  test('PRST-10 Check terms and conditions link', async () => {
    await commonLocatorsHelper.checkLinkOpensPdf(locator.termsAndConditions);
  });
});
test.describe('Paperwork.Review and Submit - Check edit icons', () => {
  test.describe.configure({ mode: 'serial' });
  test('PRST-11 Open review page', async () => {
    await page.goto(`paperwork/${bookingData.bookingUUID}/review`);
    await page.waitForLoadState('networkidle');
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-12 Edit opens contact information', async () => {
    await locator.contactInformationEditButton.click();
    await paperwork.checkCorrectPageOpens('Contact information');
    await page.goBack({ waitUntil: 'load' });
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-13 Edit opens patient details', async () => {
    await locator.patientDetailsEditButton.click();
    await paperwork.checkCorrectPageOpens('Patient details');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-14 Edit opens primary care physician', async () => {
    await locator.pcpEditButton.click();
    await paperwork.checkCorrectPageOpens('Primary Care Physician');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-15 Edit opens payment options', async () => {
    await locator.insuranceDetailsEditButton.click();
    await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-16 Edit opens responsible party information', async () => {
    await locator.responsiblePartyEditButton.click();
    await paperwork.checkCorrectPageOpens('Responsible party information');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-17 Edit opens photo ID', async () => {
    await locator.photoIdEditButton.click();
    await paperwork.checkCorrectPageOpens('Photo ID');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-18 Edit opens consent forms', async () => {
    await locator.consentFormsEditButton.click();
    await paperwork.checkCorrectPageOpens('Complete consent forms');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-18 Edit opens current medications', async () => {
    await locator.currentMedicationsEditButton.click();
    await paperwork.checkCorrectPageOpens('Current medications');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-19 Edit opens current allergies', async () => {
    await locator.currentAllergiesEditButton.click();
    await paperwork.checkCorrectPageOpens('Current allergies');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-20 Edit opens medical history', async () => {
    await locator.medicalHistoryEditButton.click();
    await paperwork.checkCorrectPageOpens('Medical history');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-21 Edit opens surgical history', async () => {
    await locator.surgicalHistoryEditButton.click();
    await paperwork.checkCorrectPageOpens('Surgical history');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-22 Edit opens additional questions', async () => {
    await locator.additionalQuestionsEditButton.click();
    await paperwork.checkCorrectPageOpens('Additional questions');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-23 Edit opens patient condition', async () => {
    await locator.patientConditionEditButton.click();
    await paperwork.checkCorrectPageOpens('Patient condition');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-24 Edit opens school/work notes', async () => {
    await locator.schoolWorkNotesEditButton.click();
    await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
  test('PRST-25 Edit opens invite participant', async () => {
    await locator.inviteParticipantEditButton.click();
    await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
    await locator.clickBackButton();
    await paperwork.checkCorrectPageOpens('Review and submit');
  });
});
