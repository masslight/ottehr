// cSpell:ignore PRST
import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { UploadDocs } from 'tests/utils/UploadDocs';
import { getPrivacyPolicyLinkDefForLocation, getTermsAndConditionsLinkDefForLocation } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { TelemedWalkInPatientTestData } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadDocs;
let commonLocatorsHelper: CommonLocatorsHelper;
let patient: TelemedWalkInPatientTestData;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  uploadPhoto = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);

  const testDataPath = path.join('test-data', 'telemedNoRpNoInsReqPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});
const REVIEW_PAGE_ID = 'REVIEW_PAGE';

test.describe.parallel('Telemed - Prefilled Paperwork, Review and Submit', () => {
  test('PRS-1. Review and submit', async () => {
    await test.step('PRS-1.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-1.2. Check patient and appointment details', async () => {
      await expect(locator.patientNamePaperworkReviewScreen).toHaveText(`${patient.firstName} ${patient.lastName}`);
      await expect(locator.locationNamePaperworkReviewScreen).toHaveText(`${patient.location}`);
      // no check-in time for walk-in appointments
      // await expect(locator.checkInTimePaperworkReviewScreen).toHaveText(`${patient.slot}`);
    });

    await test.step('PRS-1.3. Check links', async () => {
      const privacyLinkDef = getPrivacyPolicyLinkDefForLocation(REVIEW_PAGE_ID);
      if (privacyLinkDef === undefined) {
        await expect(locator.privacyPolicyReviewScreen).not.toBeVisible();
        return;
      }
      const privacyLink = page.locator(`[data-testid="${privacyLinkDef.testId}"]`);
      await commonLocatorsHelper.checkLinkOpensPdf(privacyLink);

      const termsLinkDef = getTermsAndConditionsLinkDefForLocation(REVIEW_PAGE_ID);
      if (termsLinkDef === undefined) {
        await expect(locator.termsAndConditions).not.toBeVisible();
        return;
      }
      const termsLink = page.locator(`[data-testid="${termsLinkDef.testId}"]`);
      await commonLocatorsHelper.checkLinkOpensPdf(termsLink);
    });

    await test.step('PRS-1.4. Check Complete/Missing chips', async () => {
      await expect(locator.contactInformationChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.patientDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
      // todo need to change to 'uncompleted' when https://github.com/masslight/ottehr/issues/1594 is fixed
      await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.currentMedicationsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.currentAllergiesChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.medicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.surgicalHistoryChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.additionalQuestionsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.insuranceDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.responsiblePartyChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.photoIdChipStatus).toHaveAttribute('data-testid', 'uncompleted');
      // todo need to change to 'uncompleted' when https://github.com/masslight/ottehr/issues/1594 is fixed
      await expect(locator.patientConditionChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.schoolWorkNotesChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.consentFormsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.inviteParticipantChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.continueButton).toBeVisible();
    });

    await test.step('PRS-1.5. Add Photo IDs, check all chips are completed, [Finish] button is visible', async () => {
      await locator.photoIdEditButton.click();
      await paperwork.checkCorrectPageOpens('Photo ID');
      await uploadPhoto.fillPhotoFrontID();
      await uploadPhoto.fillPhotoBackID();
      await locator.clickContinueButton();
      await page.waitForTimeout(1_000);
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkAllChipsAreCompletedTelemed();
      await expect(locator.goToWaitingRoomButton).toBeVisible();
    });

    await test.step('PRS-1.6. Select Insurance, fill required fields, check all chips are completed, [Finish] button is visible', async () => {
      await locator.insuranceDetailsEditButton.click();
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      await paperwork.selectInsurancePayment();
      await expect(locator.insuranceHeading).toBeVisible();
      await paperwork.fillInsuranceRequiredFields(false);
      await locator.clickContinueButton();
      await page.waitForTimeout(1_000);
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkAllChipsAreCompletedInPerson();
      await expect(locator.goToWaitingRoomButton).toBeVisible();
    });

    await test.step('PRS-1.7. All chips are completed after reload', async () => {
      await page.reload();
      await paperwork.checkAllChipsAreCompletedInPerson();
      await expect(locator.goToWaitingRoomButton).toBeVisible();
    });
  });

  test('PRS-2. Edit icon opens contact information page', async () => {
    await test.step('PRS-2.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-2.2. Edit opens contact information', async () => {
      await locator.contactInformationEditButton.click();
      await paperwork.checkCorrectPageOpens('Contact information');
      await page.goBack({ waitUntil: 'load' });
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-3. Edit icon opens patient details page', async () => {
    await test.step('PRS-3.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-3.2. Edit opens patient details', async () => {
      await locator.patientDetailsEditButton.click();
      await paperwork.checkCorrectPageOpens('Patient details');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-4. Edit icon opens Primary Care Physician page', async () => {
    await test.step('PRS-4.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-4.2. Edit opens Primary Care Physician', async () => {
      await locator.pcpEditButton.click();
      await paperwork.checkCorrectPageOpens('Primary Care Physician');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-5. Edit icon opens payment options page', async () => {
    await test.step('PRS-5.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-5.2. Edit opens payment options', async () => {
      await locator.insuranceDetailsEditButton.click();
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-6. Edit icon opens responsible party information page', async () => {
    await test.step('PRS-6.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-6.2. Edit opens responsible party information', async () => {
      await locator.responsiblePartyEditButton.click();
      await paperwork.checkCorrectPageOpens('Responsible party information');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-7. Edit icon opens photo ID page', async () => {
    await test.step('PRS-7.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-7.2. Edit opens photo ID', async () => {
      await locator.photoIdEditButton.click();
      await paperwork.checkCorrectPageOpens('Photo ID');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-8. Edit icon opens consent forms page', async () => {
    await test.step('PRS-8.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-8.2. Edit opens consent forms', async () => {
      await locator.consentFormsEditButton.click();
      await paperwork.checkCorrectPageOpens('Complete consent forms');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-9. Edit icon opens current medications page', async () => {
    await test.step('PRS-9.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-9.2. Edit opens current medications', async () => {
      await locator.currentMedicationsEditButton.click();
      await paperwork.checkCorrectPageOpens('Current medications');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-10. Edit icon opens current allergies page', async () => {
    await test.step('PRS-10.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-10.2. Edit opens current allergies', async () => {
      await locator.currentAllergiesEditButton.click();
      await paperwork.checkCorrectPageOpens('Current allergies');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-11. Edit icon opens medical history page', async () => {
    await test.step('PRS-11.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-11.2. Edit opens medical history', async () => {
      await locator.medicalHistoryEditButton.click();
      await paperwork.checkCorrectPageOpens('Medical history');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-12. Edit icon opens surgical history page', async () => {
    await test.step('PRS-12.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-12.2. Edit opens surgical history', async () => {
      await locator.surgicalHistoryEditButton.click();
      await paperwork.checkCorrectPageOpens('Surgical history');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-13. Edit icon opens additional questions page', async () => {
    await test.step('PRS-13.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-13.2. Edit opens additional questions', async () => {
      await locator.additionalQuestionsEditButton.click();
      await paperwork.checkCorrectPageOpens('Additional questions');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-14. Edit icon opens patient condition page', async () => {
    await test.step('PRS-14.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-14.2. Edit opens patient condition', async () => {
      await locator.patientConditionEditButton.click();
      await paperwork.checkCorrectPageOpens('Patient condition');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-15. Edit icon opens school/work notes page', async () => {
    await test.step('PRS-15.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-15.2. Edit opens school/work notes', async () => {
      await locator.schoolWorkNotesEditButton.click();
      await paperwork.checkCorrectPageOpens('Do you need a school or work note?');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });

  test('PRS-16. Edit icon opens invite participant page', async () => {
    await test.step('PRS-16.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-16.2. Edit opens invite participant', async () => {
      await locator.inviteParticipantEditButton.click();
      await paperwork.checkCorrectPageOpens('Would you like someone to join this call?');
      await locator.clickBackButton();
      await paperwork.checkCorrectPageOpens('Review and submit');
    });
  });
});
