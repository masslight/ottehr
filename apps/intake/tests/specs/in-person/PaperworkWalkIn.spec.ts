// cSpell:ignore SNPRF
import Oystehr from '@oystehr/sdk';
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { Appointment, QuestionnaireResponseItem } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { addProcessIdMetaTagToAppointment } from 'test-utils';
import { QuestionnaireHelper } from 'tests/utils/QuestionnaireHelper';
import { ResourceHandler } from 'tests/utils/resource-handler';
import {
  chooseJson,
  cleanAppointmentGraph,
  CreateAppointmentResponse,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
} from 'utils';
import { CommonLocatorsHelper } from '../../utils/CommonLocatorsHelper';
import { Locators } from '../../utils/locators';
import { Paperwork } from '../../utils/Paperwork';
import { FillingInfo } from '../../utils/telemed/FillingInfo';

let page: Page;
let context: BrowserContext;
let locator: Locators;
let paperwork: Paperwork;
let commonLocatorsHelper: CommonLocatorsHelper;
let fillingInfo: FillingInfo;
const appointmentIds: string[] = [];
const locationName = process.env.LOCATION;

const PROCESS_ID = `PaperworkWalkIn.spec.ts-${DateTime.now().toMillis()}`;
let oystehr: Oystehr;

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext();
  page = await context.newPage();
  page.on('response', async (response) => {
    if (response.url().includes('/create-appointment/')) {
      const { appointmentId } = chooseJson(await response.json()) as CreateAppointmentResponse;
      if (!appointmentIds.includes(appointmentId)) {
        appointmentIds.push(appointmentId);
      }
      const resourceHandler = new ResourceHandler();
      await resourceHandler.initApi();
      oystehr = resourceHandler.apiClient;
      const appointment = await oystehr.fhir.get<Appointment>({
        resourceType: 'Appointment',
        id: appointmentId,
      });
      await oystehr.fhir.update(addProcessIdMetaTagToAppointment(appointment, PROCESS_ID));
    }
  });
  paperwork = new Paperwork(page);
  locator = new Locators(page);
  commonLocatorsHelper = new CommonLocatorsHelper(page);
  fillingInfo = new FillingInfo(page);
});
test.afterAll(async () => {
  await page.close();
  await context.close();
  await cleanAppointmentGraph(
    {
      system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
      code: PROCESS_ID,
    },
    oystehr
  );
});

test.describe.serial('Start now In person visit - Paperwork submission flow with only required fields', () => {
  test('SNPRF-1 Fill required contact information', async () => {
    await page.goto(`/walkin/location/${locationName?.replaceAll(' ', '_')}/select-service-category`);
    await fillingInfo.selectFirstServiceCategory();
    await locator.clickContinueButton();
    await locator.selectDifferentFamilyMember();
    await fillingInfo.fillNewPatientInfo();
    await fillingInfo.fillDOBgreater18();
    await locator.clickContinueButton();
    await locator.confirmWalkInButton.click();
    await locator.proceedToPaperwork.click();
    await paperwork.fillContactInformationRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Patient details');
  });

  test('SNPRF-2 Fill patient details', async () => {
    await paperwork.fillPatientDetailsRequiredFields();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Primary Care Physician');
  });

  test('SNPRF-3 Skip PCP and Select Self-Pay Payment Option', async () => {
    await paperwork.skipPrimaryCarePhysician();
    await paperwork.skipPreferredPharmacy();
    await paperwork.selectSelfPayPayment();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Credit card details');
  });
  test('SNPRF-4 Fill credit card and proceed to responsible party page', async () => {
    await paperwork.fillAndAddCreditCardIfDoesntExist();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toBeVisible();
    await expect(locator.flowHeading).toHaveText('Responsible party information');
  });
  test('SNPRF-5 Fill responsible party details', async () => {
    await paperwork.fillResponsiblePartyDataSelf();
    await commonLocatorsHelper.clickContinue();
    // Check which page appears (employer information is conditional)
    await expect(locator.flowHeading).not.toHaveText('Loading...', { timeout: 60000 });
    const currentPageTitle = await locator.flowHeading.textContent();
    if (currentPageTitle === 'Employer information') {
      await paperwork.fillEmployerInformation();
      await commonLocatorsHelper.clickContinue();
    }
    await expect(locator.flowHeading).toHaveText('Emergency Contact');
  });
  test('SNPRF-7 Fill emergency contact details', async () => {
    await expect(locator.flowHeading).toHaveText('Emergency Contact');
    await paperwork.fillEmergencyContactInformation();
    await commonLocatorsHelper.clickContinue();
    const attorneyPageVisible = QuestionnaireHelper.inPersonAttorneyPageIsVisible([
      {
        linkId: 'contact-information-page',
        item: [
          {
            linkId: 'reason-for-visit',
            answer: [{ valueString: fillingInfo.getReasonForVisit() }],
          },
        ],
      },
    ]);
    if (attorneyPageVisible) {
      await expect(locator.flowHeading).toHaveText('Attorney for Motor Vehicle Accident');
    } else {
      await expect(locator.flowHeading).toHaveText('Photo ID');
    }
  });
  test('SNPRF-7a Fill attorney information', async () => {
    test.skip(
      (() => {
        const responseItems: QuestionnaireResponseItem[] = [
          {
            linkId: 'contact-information-page',
            item: [
              {
                linkId: 'reason-for-visit',
                answer: [{ valueString: fillingInfo.getReasonForVisit() }],
              },
            ],
          },
        ];
        // Check if attorney page would be visible for this reason for visit
        return !QuestionnaireHelper.inPersonAttorneyPageIsVisible(responseItems);
      })(),
      'Attorney page not visible for this appointment type; skipping test.'
    );
    await expect(locator.flowHeading).toHaveText('Attorney for Motor Vehicle Accident');
    await paperwork.fillAttorneyInformation();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Photo ID');
  });
  test('SNPRF-8 Skip photo ID and complete consent forms', async () => {
    await paperwork.skipPhotoID();
    await paperwork.fillConsentForms();
    await commonLocatorsHelper.clickContinue();
    await commonLocatorsHelper.clickContinue();
    await expect(locator.flowHeading).toHaveText('Review and submit');
  });
  test('SNPRF-9 Submit paperwork', async () => {
    await commonLocatorsHelper.clickContinue();
    await expect(locator.checkInHeading).toBeVisible();
  });
});
