import { BrowserContext, expect, Page, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { UploadDocs } from 'tests/utils/UploadDocs';
import { getPrivacyPolicyLinkDefForLocation, getTermsAndConditionsLinkDefForLocation } from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { InPersonPatientSelfTestData } from '../0_paperworkSetup/types';

let page: Page;
let context: BrowserContext;
let paperwork: Paperwork;
let locator: Locators;
let uploadPhoto: UploadDocs;
let commonLocatorsHelper: CommonLocatorsHelper;
let patient: InPersonPatientSelfTestData;
const REVIEW_PAGE_ID = 'PAPERWORK_REVIEW_PAGE';

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  uploadPhoto = new UploadDocs(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);

  const testDataPath = path.join('test-data', 'cardPaymentSelfPatient.json');
  patient = JSON.parse(fs.readFileSync(testDataPath, 'utf-8'));
});
test.afterAll(async () => {
  await page.close();
  await context.close();
});

test.describe.parallel('In-Person - Prefilled Paperwork, Review and Submit', () => {
  test('PRS-1. Review and submit', async () => {
    await test.step('PRS-1.1. Open Review and submit page directly', async () => {
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkCorrectPageOpens('Review and submit');
    });

    await test.step('PRS-1.2. Check patient and appointment details', async () => {
      await expect(locator.patientNamePaperworkReviewScreen).toHaveText(`${patient.firstName} ${patient.lastName}`);
      expect.soft(patient.slotDetails.ownerName).toBeDefined();
      await expect(locator.locationNamePaperworkReviewScreen).toHaveText(`${patient.slotDetails.ownerName}`);
      await expect(locator.checkInTimePaperworkReviewScreen).toHaveText(`${patient.slot}`);
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
      // todo need to uncomment when https://github.com/masslight/ottehr/issues/1594 is fixed
      // await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'uncompleted');
      await expect(locator.pcpChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.insuranceDetailsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.responsiblePartyChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.photoIdChipStatus).toHaveAttribute('data-testid', 'uncompleted');
      await expect(locator.consentFormsChipStatus).toHaveAttribute('data-testid', 'completed');
      await expect(locator.continueButton).toBeVisible();
    });

    await test.step('PRS-1.5. Add Photo IDs, check all chips are completed, [Continue] button is visible', async () => {
      await locator.photoIdEditButton.click();
      await paperwork.checkCorrectPageOpens('Photo ID');
      await uploadPhoto.fillPhotoFrontID();
      await uploadPhoto.fillPhotoBackID();
      await locator.clickContinueButton();
      await page.waitForTimeout(1_000);
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkAllChipsAreCompletedInPerson();
      await expect(locator.continueButton).toBeVisible();
    });

    await test.step('PRS-1.6. Select Insurance, fill required fields, check all chips are completed, [Continue] button is visible', async () => {
      await locator.insuranceDetailsEditButton.click();
      await paperwork.checkCorrectPageOpens('How would you like to pay for your visit?');
      await paperwork.selectInsurancePayment();
      await expect(locator.insuranceHeading).toBeVisible();
      await paperwork.fillInsuranceRequiredFields(false);
      await locator.clickContinueButton();
      await page.waitForTimeout(1_000);
      await page.goto(`paperwork/${patient.appointmentId}/review`);
      await paperwork.checkAllChipsAreCompletedInPerson();
      await expect(locator.continueButton).toBeVisible();
    });

    await test.step('PRS-1.7. All chips are completed after reload', async () => {
      await page.reload();
      await paperwork.checkAllChipsAreCompletedInPerson();
      await expect(locator.continueButton).toBeVisible();
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
});
