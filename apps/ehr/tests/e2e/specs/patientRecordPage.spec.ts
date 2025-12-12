import { BrowserContext, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForResponseWithData } from 'test-utils';
import {
  BOOKING_CONFIG,
  CreateAppointmentResponse,
  DEMO_VISIT_CITY,
  DEMO_VISIT_MARKETING_MESSAGING,
  DEMO_VISIT_PATIENT_ETHNICITY,
  DEMO_VISIT_PATIENT_RACE,
  DEMO_VISIT_PHYSICIAN_ADDRESS,
  DEMO_VISIT_PHYSICIAN_MOBILE,
  DEMO_VISIT_POINT_OF_DISCOVERY,
  DEMO_VISIT_PRACTICE_NAME,
  DEMO_VISIT_PREFERRED_LANGUAGE,
  DEMO_VISIT_PROVIDER_FIRST_NAME,
  DEMO_VISIT_PROVIDER_LAST_NAME,
  DEMO_VISIT_RESPONSIBLE_BIRTH_SEX,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH,
  DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR,
  DEMO_VISIT_RESPONSIBLE_EMAIL,
  DEMO_VISIT_RESPONSIBLE_FIRST_NAME,
  DEMO_VISIT_RESPONSIBLE_LAST_NAME,
  DEMO_VISIT_RESPONSIBLE_PHONE,
  DEMO_VISIT_RESPONSIBLE_RELATIONSHIP,
  DEMO_VISIT_STATE,
  DEMO_VISIT_STREET_ADDRESS,
  DEMO_VISIT_STREET_ADDRESS_OPTIONAL,
  DEMO_VISIT_ZIP,
  FormFieldsItem,
  PATIENT_RECORD_CONFIG,
  unpackFhirResponse,
} from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { ENV_LOCATION_NAME } from '../../e2e-utils/resource/constants';
import {
  PATIENT_BIRTH_DATE_SHORT,
  PATIENT_EMAIL,
  PATIENT_FIRST_NAME,
  PATIENT_GENDER,
  PATIENT_LAST_NAME,
  PATIENT_PHONE_NUMBER,
  ResourceHandler,
} from '../../e2e-utils/resource-handler';
import { openAddPatientPage } from '../page/AddPatientPage';
import { AddInsuranceDialog } from '../page/patient-information/AddInsuranceDialog';
import { expectDialog } from '../page/patient-information/Dialog';
import {
  expectPatientInformationPage,
  openPatientInformationPage,
  PatientInformationPage,
} from '../page/PatientInformationPage';
import { expectPatientRecordPage } from '../page/PatientRecordPage';
import { expectPatientsPage } from '../page/PatientsPage';

const NEW_PATIENT_LAST_NAME = 'Test_last_name';
const NEW_PATIENT_FIRST_NAME = 'Test_first_name';
const NEW_PATIENT_MIDDLE_NAME = 'Test_middle';
const NEW_PATIENT_SUFFIX = 'Mrs';
const NEW_PATIENT_PREFERRED_NAME = 'Test_pref';
const NEW_PATIENT_DATE_OF_BIRTH = '01/01/2024';
const NEW_PATIENT_PREFERRED_PRONOUNS = 'They/them';
const NEW_PATIENT_BIRTH_SEX = 'Female';
const NEW_STREET_ADDRESS = 'Test address, 1';
const NEW_STREET_ADDRESS_OPTIONAL = 'test, optional';
const NEW_CITY = 'New York';
const NEW_STATE = 'CA';
const NEW_ZIP = '05000';
const NEW_PATIENT_EMAIL = 'testemail@getMaxListeners.com';
const NEW_PATIENT_MOBILE = '2027139680';
const NEW_PATIENT_ETHNICITY = 'Hispanic or Latino';
const NEW_PATIENT_RACE = 'Asian';
const NEW_PATIENT_SEXUAL_ORIENTATION = 'Straight';
const NEW_PATIENT_GENDER_IDENTITY = 'Female';
const NEW_PATIENT_HOW_DID_YOU_HEAR = 'Webinar';
const NEW_SEND_MARKETING_MESSAGES = false;
const NEW_PREFERRED_LANGUAGE = 'Spanish';
const NEW_COMMON_WELL_CONSENT = true;
const NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER = 'Parent';
const NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER = 'First name';
const NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER = 'Last name';
const NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER = '10/10/2000';
const NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER = 'Male';
const NEW_PHONE_FROM_RESPONSIBLE_CONTAINER = '(202) 111-1111';
const NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER = 'rowdyroddypiper@hotmail.com';
const NEW_ADDRESS_RESPONSIBLE_PARTY = '123 fake lane';
const NEW_CITY_RESPONSIBLE_PARTY = 'Los Angeles';
const NEW_STATE_RESPONSIBLE_PARTY = 'NY';
const NEW_ZIP_RESPONSIBLE_PARTY = '10003';
const NEW_PROVIDER_FIRST_NAME = 'John';
const NEW_PROVIDER_LAST_NAME = 'Doe';
const NEW_PRACTICE_NAME = 'Dental';
const NEW_PHYSICIAN_ADDRESS = '5th avenue';
const NEW_PHYSICIAN_MOBILE = '(202) 222-2222';
const NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD = 'testing gender';
const NEW_REASON_FOR_VISIT = BOOKING_CONFIG.reasonForVisitOptions[0];

// Emergency Contact test data
const NEW_EMERGENCY_CONTACT_RELATIONSHIP = 'Parent';
const NEW_EMERGENCY_CONTACT_FIRST_NAME = 'Emergency';
const NEW_EMERGENCY_CONTACT_MIDDLE_NAME = 'Middle';
const NEW_EMERGENCY_CONTACT_LAST_NAME = 'Contact';
const NEW_EMERGENCY_CONTACT_PHONE = '(303) 333-3333';
const NEW_EMERGENCY_CONTACT_STREET_ADDRESS = '789 Emergency St';
const NEW_EMERGENCY_CONTACT_ADDRESS_LINE_2 = 'Apt 3';
const NEW_EMERGENCY_CONTACT_CITY = 'Emergency City';
const NEW_EMERGENCY_CONTACT_STATE = 'FL';
const NEW_EMERGENCY_CONTACT_ZIP = '33101';

// Pharmacy test data
const NEW_PHARMACY_NAME = 'Test Pharmacy';
const NEW_PHARMACY_ADDRESS = '456 Pharmacy Ave, City, ST 12345';

// Employer test data
const NEW_EMPLOYER_NAME = 'Test Employer Inc';
const NEW_EMPLOYER_ADDRESS_LINE_1 = '100 Business Blvd';
const NEW_EMPLOYER_ADDRESS_LINE_2 = 'Suite 200';
const NEW_EMPLOYER_CITY = 'Business City';
const NEW_EMPLOYER_STATE = 'TX';
const NEW_EMPLOYER_ZIP = '75001';
const NEW_EMPLOYER_CONTACT_FIRST_NAME = 'John';
const NEW_EMPLOYER_CONTACT_LAST_NAME = 'Manager';
const NEW_EMPLOYER_CONTACT_TITLE = 'HR Director';
const NEW_EMPLOYER_CONTACT_EMAIL = 'hr@testemployer.com';
const NEW_EMPLOYER_CONTACT_PHONE = '(214) 555-1234';
const NEW_EMPLOYER_CONTACT_FAX = '(214) 555-1235';

const patientSummary = PATIENT_RECORD_CONFIG.FormFields.patientSummary.items;
const contactInformation = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation.items;
const patientDetails = PATIENT_RECORD_CONFIG.FormFields.patientDetails.items;
const responsibleParty = PATIENT_RECORD_CONFIG.FormFields.responsibleParty.items;
const primaryCarePhysician = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;
const insuranceSection = PATIENT_RECORD_CONFIG.FormFields.insurance;
const emergencyContact = PATIENT_RECORD_CONFIG.FormFields.emergencyContact.items;
const preferredPharmacy = PATIENT_RECORD_CONFIG.FormFields.preferredPharmacy.items;
const employerInformation = PATIENT_RECORD_CONFIG.FormFields.employerInformation.items;

const HIDDEN_SECTIONS = PATIENT_RECORD_CONFIG.hiddenFormSections || [];
const SECTIONS = PATIENT_RECORD_CONFIG.FormFields;

const PCPTestStep = HIDDEN_SECTIONS.includes(SECTIONS.primaryCarePhysician.linkId) ? test.skip : test.step;
const PCPTest = HIDDEN_SECTIONS.includes(SECTIONS.primaryCarePhysician.linkId) ? test.skip : test;

const PatientSummaryTest = HIDDEN_SECTIONS.includes(SECTIONS.patientSummary.linkId) ? test.skip : test;
const PatientSummaryTestStep = HIDDEN_SECTIONS.includes(SECTIONS.patientSummary.linkId) ? test.skip : test.step;

// Helper to get conditionally rendered fields from config
const getConditionalFields = (
  items: Record<string, FormFieldsItem>,
  controlFieldKey: string
): { key: string; label: string; shouldBeRequired: boolean; disabledDisplay: string }[] => {
  return Object.values(items)
    .filter((item) => {
      if (!item.triggers || item.triggers.length === 0) return false;
      if (!item.disabledDisplay || item.disabledDisplay === 'disabled') return false;
      return item.triggers.some((trigger) => trigger.targetQuestionLinkId === controlFieldKey);
    })
    .map((item) => {
      const shouldBeRequired = (item.triggers ?? []).some(
        (trigger) => trigger.targetQuestionLinkId === controlFieldKey && trigger.effect.includes('require')
      );
      return {
        key: item.key,
        label: item.label,
        shouldBeRequired,
        disabledDisplay: item.disabledDisplay || 'disabled',
      };
    });
};

const ContactInformationTest = HIDDEN_SECTIONS.includes(SECTIONS.patientContactInformation.linkId) ? test.skip : test;
const ContactInformationTestStep = HIDDEN_SECTIONS.includes(SECTIONS.patientContactInformation.linkId)
  ? test.skip
  : test.step;

const PatientDetailsTest = HIDDEN_SECTIONS.includes(SECTIONS.patientDetails.linkId) ? test.skip : test;
const PatientDetailsTestStep = HIDDEN_SECTIONS.includes(SECTIONS.patientDetails.linkId) ? test.skip : test.step;

const ResponsiblePartyTest = HIDDEN_SECTIONS.includes(SECTIONS.responsibleParty.linkId) ? test.skip : test;
const ResponsiblePartyTestStep = HIDDEN_SECTIONS.includes(SECTIONS.responsibleParty.linkId) ? test.skip : test.step;

const EmployerTest = HIDDEN_SECTIONS.includes(SECTIONS.employerInformation.linkId) ? test.skip : test;
const EmployerTestStep = HIDDEN_SECTIONS.includes(SECTIONS.employerInformation.linkId) ? test.skip : test.step;

const EmergencyContactTest = HIDDEN_SECTIONS.includes(SECTIONS.emergencyContact.linkId) ? test.skip : test;
const EmergencyContactTestStep = HIDDEN_SECTIONS.includes(SECTIONS.emergencyContact.linkId) ? test.skip : test.step;

const PharmacyTest = HIDDEN_SECTIONS.includes(SECTIONS.preferredPharmacy.linkId) ? test.skip : test;
const PharmacyTestStep = HIDDEN_SECTIONS.includes(SECTIONS.preferredPharmacy.linkId) ? test.skip : test.step;

/*  
// this will probably be more involved, will get to it when needed
const PrimaryInsuranceTestStep = PATIENT_RECORD_CONFIG.hiddenFormSections?.includes(
  PATIENT_RECORD_CONFIG.FormFields.insurance.linkId[0]
)
  ? test.skip
  : test.step;
const PrimaryInsuranceTest = PATIENT_RECORD_CONFIG.hiddenFormSections?.includes(
  PATIENT_RECORD_CONFIG.FormFields.insurance.linkId[0]
)
  ? test.skip
  : test;
*/

//const RELEASE_OF_INFO = 'Yes, Release Allowed';
//const RX_HISTORY_CONSENT = 'Rx history consent signed by the patient';

const populateAllRequiredFields = async (patientInformationPage: PatientInformationPage): Promise<void> => {
  // Patient Summary fields
  if (!HIDDEN_SECTIONS.includes(SECTIONS.patientSummary.linkId)) {
    await patientInformationPage.enterTextFieldValue(patientSummary.lastName.key, NEW_PATIENT_LAST_NAME);
    await patientInformationPage.enterTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.enterDateFieldValue(patientSummary.birthDate.key, NEW_PATIENT_DATE_OF_BIRTH);
    await patientInformationPage.selectFieldOption(patientSummary.birthSex.key, NEW_PATIENT_BIRTH_SEX);
  }

  // Contact Information fields
  if (!HIDDEN_SECTIONS.includes(SECTIONS.patientContactInformation.linkId)) {
    await patientInformationPage.enterTextFieldValue(contactInformation.streetAddress.key, NEW_STREET_ADDRESS);
    await patientInformationPage.enterTextFieldValue(contactInformation.city.key, NEW_CITY);
    await patientInformationPage.selectFieldOption(contactInformation.state.key, NEW_STATE);
    await patientInformationPage.enterTextFieldValue(contactInformation.zip.key, NEW_ZIP);
    await patientInformationPage.enterTextFieldValue(contactInformation.email.key, NEW_PATIENT_EMAIL);
    await patientInformationPage.enterPhoneFieldValue(contactInformation.phone.key, NEW_PATIENT_MOBILE);
  }

  // Patient Details fields
  if (!HIDDEN_SECTIONS.includes(SECTIONS.patientDetails.linkId)) {
    await patientInformationPage.selectFieldOption(patientDetails.ethnicity.key, NEW_PATIENT_ETHNICITY);
    await patientInformationPage.selectFieldOption(patientDetails.race.key, NEW_PATIENT_RACE);
  }

  // Responsible Party fields
  if (!HIDDEN_SECTIONS.includes(SECTIONS.responsibleParty.linkId)) {
    await patientInformationPage.selectFieldOption(
      responsibleParty.relationship.key,
      NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterTextFieldValue(
      responsibleParty.firstName.key,
      NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterTextFieldValue(
      responsibleParty.lastName.key,
      NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterDateFieldValue(
      responsibleParty.birthDate.key,
      NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.selectFieldOption(
      responsibleParty.birthSex.key,
      NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER
    );
    await patientInformationPage.enterPhoneFieldValue(responsibleParty.phone.key, NEW_PHONE_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterTextFieldValue(responsibleParty.email.key, NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER);
    await patientInformationPage.enterTextFieldValue(responsibleParty.addressLine1.key, NEW_ADDRESS_RESPONSIBLE_PARTY);
    await patientInformationPage.enterTextFieldValue(responsibleParty.city.key, NEW_CITY_RESPONSIBLE_PARTY);
    await patientInformationPage.selectFieldOption(responsibleParty.state.key, NEW_STATE_RESPONSIBLE_PARTY);
    await patientInformationPage.enterTextFieldValue(responsibleParty.zip.key, NEW_ZIP_RESPONSIBLE_PARTY);
  }
};

test.describe('Patient Record Page tests', () => {
  const PROCESS_ID = `patientRecordPage-mutating-patient-info-fields-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID);

  test.describe.configure({ mode: 'serial' });
  let context: BrowserContext;
  let page: Page;
  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillHarvestingDone(resourceHandler.appointment.id!);
    context = await browser.newContext();
    page = await context.newPage();
  });
  test.afterAll(async () => {
    await page.close();
    await context.close();
    await resourceHandler.cleanupResources();
  });
  let patientInformationPage: PatientInformationPage;

  /* Non-mutating part start */
  test('Click on "See all patient info button", Patient Info Page is opened', async () => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    const patientRecordPage = await expectPatientRecordPage(resourceHandler.patient.id!, page);
    await patientRecordPage.clickSeeAllPatientInfoButton();
    patientInformationPage = await expectPatientInformationPage(page, resourceHandler.patient.id!);
  });

  PatientSummaryTest('Verify required data from Patient info block is displayed correctly', async () => {
    await patientInformationPage.verifyTextFieldValue(patientSummary.lastName.key, PATIENT_LAST_NAME);
    await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, PATIENT_FIRST_NAME);
    await patientInformationPage.verifyDateFieldValue(patientSummary.birthDate.key, PATIENT_BIRTH_DATE_SHORT);
    await patientInformationPage.verifySelectFieldValue(patientSummary.birthSex.key, PATIENT_GENDER);
  });

  ContactInformationTest('Verify required data from Contact info block is displayed correctly', async () => {
    await patientInformationPage.verifyTextFieldValue(contactInformation.streetAddress.key, DEMO_VISIT_STREET_ADDRESS);
    await patientInformationPage.verifyTextFieldValue(
      contactInformation.addressLine2.key,
      DEMO_VISIT_STREET_ADDRESS_OPTIONAL
    );
    await patientInformationPage.verifyTextFieldValue(contactInformation.city.key, DEMO_VISIT_CITY);
    await patientInformationPage.verifySelectFieldValue(contactInformation.state.key, DEMO_VISIT_STATE);
    await patientInformationPage.verifyTextFieldValue(contactInformation.zip.key, DEMO_VISIT_ZIP);
    await patientInformationPage.verifyTextFieldValue(contactInformation.email.key, PATIENT_EMAIL);
    await patientInformationPage.verifyPhoneFieldValue(contactInformation.phone.key, PATIENT_PHONE_NUMBER);
  });

  ResponsiblePartyTest('Verify data from Responsible party information block is displayed correctly', async () => {
    await patientInformationPage.verifySelectFieldValue(
      responsibleParty.relationship.key,
      DEMO_VISIT_RESPONSIBLE_RELATIONSHIP
    );
    await patientInformationPage.verifyTextFieldValue(
      responsibleParty.firstName.key,
      DEMO_VISIT_RESPONSIBLE_FIRST_NAME
    );
    await patientInformationPage.verifyTextFieldValue(responsibleParty.lastName.key, DEMO_VISIT_RESPONSIBLE_LAST_NAME);
    await patientInformationPage.verifyDateFieldValue(
      responsibleParty.birthDate.key,
      DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH +
        '/' +
        DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY +
        '/' +
        DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR
    );
    await patientInformationPage.verifySelectFieldValue(
      responsibleParty.birthSex.key,
      DEMO_VISIT_RESPONSIBLE_BIRTH_SEX
    );
    await patientInformationPage.verifyPhoneFieldValue(responsibleParty.phone.key, DEMO_VISIT_RESPONSIBLE_PHONE);
    await patientInformationPage.verifyTextFieldValue(responsibleParty.email.key, DEMO_VISIT_RESPONSIBLE_EMAIL);
  });

  PatientDetailsTest('Verify entered by patient data from Patient details block is displayed correctly', async () => {
    await patientInformationPage.verifySelectFieldValue(patientDetails.ethnicity.key, DEMO_VISIT_PATIENT_ETHNICITY);
    await patientInformationPage.verifySelectFieldValue(patientDetails.race.key, DEMO_VISIT_PATIENT_RACE);
    await patientInformationPage.verifySelectFieldValue(
      patientDetails.pointOfDiscovery.key,
      DEMO_VISIT_POINT_OF_DISCOVERY
    );
    await patientInformationPage.verifyBooleanFieldHasExpectedValue(
      patientDetails.sendMarketing.key,
      DEMO_VISIT_MARKETING_MESSAGING
    );
    // no test for CommonWell consent?
    await patientInformationPage.verifySelectFieldValue(patientDetails.language.key, DEMO_VISIT_PREFERRED_LANGUAGE);
  });

  PCPTest('Verify PCP Section behavior', async () => {
    await PCPTestStep('Verify data from Primary Care Physician block is displayed correctly', async () => {
      await patientInformationPage.verifyTextFieldValue(
        primaryCarePhysician.firstName.key,
        DEMO_VISIT_PROVIDER_FIRST_NAME
      );
      await patientInformationPage.verifyTextFieldValue(
        primaryCarePhysician.lastName.key,
        DEMO_VISIT_PROVIDER_LAST_NAME
      );
      await patientInformationPage.verifyTextFieldValue(
        primaryCarePhysician.practiceName.key,
        DEMO_VISIT_PRACTICE_NAME
      );
      await patientInformationPage.verifyTextFieldValue(primaryCarePhysician.address.key, DEMO_VISIT_PHYSICIAN_ADDRESS);
      await patientInformationPage.verifyPhoneFieldValue(primaryCarePhysician.phone.key, DEMO_VISIT_PHYSICIAN_MOBILE);
    });
    await PCPTestStep(
      'Check validation error is displayed for invalid phone number from Primary Care Physician block',
      async () => {
        await patientInformationPage.clearPhoneField(primaryCarePhysician.phone.key);
        await patientInformationPage.enterPhoneFieldValue(primaryCarePhysician.phone.key, '2222245');
        await patientInformationPage.clickSaveChangesButton();
        await patientInformationPage.verifyFieldError(
          primaryCarePhysician.phone.key,
          'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
        );
      }
    );
    await PCPTestStep(
      'Check all fields from Primary Care Physician block are hidden when checkbox is checked',
      async () => {
        await patientInformationPage.selectBooleanField(primaryCarePhysician.active.key, true);

        // Get conditional fields from config
        const conditionalFields = getConditionalFields(primaryCarePhysician, primaryCarePhysician.active.key);

        // Verify all conditional fields are hidden
        for (const field of conditionalFields) {
          await patientInformationPage.verifyFieldIsHidden(field.key);
        }
      }
    );
    await PCPTestStep(
      'Check all fields from Primary Care Physician block after toggling the checkbox on and off',
      async () => {
        await patientInformationPage.selectBooleanField(primaryCarePhysician.active.key, false);

        await patientInformationPage.verifyTextFieldValue(
          primaryCarePhysician.firstName.key,
          DEMO_VISIT_PROVIDER_FIRST_NAME
        );
        await patientInformationPage.verifyTextFieldValue(
          primaryCarePhysician.lastName.key,
          DEMO_VISIT_PROVIDER_LAST_NAME
        );
        await patientInformationPage.verifyTextFieldValue(
          primaryCarePhysician.practiceName.key,
          DEMO_VISIT_PRACTICE_NAME
        );
        await patientInformationPage.verifyTextFieldValue(
          primaryCarePhysician.address.key,
          DEMO_VISIT_PHYSICIAN_ADDRESS
        );
        await patientInformationPage.enterPhoneFieldValue(primaryCarePhysician.phone.key, DEMO_VISIT_PHYSICIAN_MOBILE);
        await patientInformationPage.verifyPhoneFieldValue(primaryCarePhysician.phone.key, DEMO_VISIT_PHYSICIAN_MOBILE);
      }
    );
  });

  EmergencyContactTest('Verify Emergency Contact Section behavior', async () => {
    await EmergencyContactTestStep('Verify data from Emergency Contact block is displayed correctly', async () => {
      // Note: We can add verification here if there is existing emergency contact data in the resource handler
      // For now, we'll test this section can be interacted with
      await patientInformationPage.verifyFieldIsVisible(emergencyContact.relationship.key);
    });
  });

  PharmacyTest('Verify Pharmacy Section behavior', async () => {
    await PharmacyTestStep('Verify Pharmacy section is visible', async () => {
      // Note: We can add verification here if there is existing pharmacy data in the resource handler
      // For now, we'll test this section can be interacted with
      await patientInformationPage.verifyFieldIsVisible(preferredPharmacy.name.key);
    });
  });

  EmployerTest('Verify Employer Section behavior', async () => {
    await EmployerTestStep('Verify Employer section is visible', async () => {
      // Note: We can add verification here if there is existing employer data in the resource handler
      // For now, we'll test this section can be interacted with
      await patientInformationPage.verifyFieldIsVisible(employerInformation.employerName.key);
    });
  });

  //to do: uncomment when https://github.com/masslight/ottehr/issues/2200 will be fixed
  /* test('Click [x] from Patient info page without updating any data, Patient Record page is opened', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickCloseButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });

  test('Click [x] from Patient info page after updating any field and reverting this changes, Patient Record page is opened', async ({
    page,
  }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterPatientFirstName(NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.enterPatientFirstName(PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });*/

  PatientSummaryTest('Click on [Cancel] button, user stays on Patient Profile page', async () => {
    await patientInformationPage.enterTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDialog(page);
    await discardChangesDialog.clickCancelButton();
    await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
  });

  PatientSummaryTest('Click on [x] icon, user stays on Patient Profile page', async () => {
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDialog(page);
    await discardChangesDialog.clickCloseButton();
    await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
  });

  test('Click on Patients Name breadcrumb, Patient Record page is opened', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickPatientNameBreadcrumb(
      resourceHandler.patient.name?.[0]?.given?.[0] + ' ' + resourceHandler.patient.name?.[0].family
    );
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
  });

  test('Click on Patients breadcrumb, Patients page is opened', async ({ page }) => {
    const patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.clickPatientsBreadcrumb();
    await expectPatientsPage(page);
  });

  PatientSummaryTest('Click on [Discard changes] button, Patient Record page is opened', async ({ page }) => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    let patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.enterTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
    await patientInformationPage.clickCloseButton();
    const discardChangesDialog = await expectDialog(page);
    await discardChangesDialog.clickProceedButton();
    await expectPatientRecordPage(resourceHandler.patient.id!, page);
    patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
    await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, PATIENT_FIRST_NAME);
  });

  /* Non-mutating part end */

  test.describe('Filling and saving required fields, checking validation errors, checking updated fields are displayed correctly', async () => {
    test('Fill and save required values on Patient Info Page, values are saved and updated successfully. Check all section fields validation errors.', async () => {
      patientInformationPage = await openPatientInformationPage(page, resourceHandler.patient.id!);
      await populateAllRequiredFields(patientInformationPage);
      // await patientInformationPage.selectReleaseOfInfo(RELEASE_OF_INFO);
      // await patientInformationPage.selectRxHistoryConsent(RX_HISTORY_CONSENT);

      // todo: future enhancement - mapping all the test data to the config and iterating over them
      await patientInformationPage.clickSaveChangesButton();
      await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
      await patientInformationPage.reloadPatientInformationPage();

      await PatientSummaryTestStep('Verify required data from Patient summary block populated', async () => {
        await patientInformationPage.verifyTextFieldValue(patientSummary.lastName.key, NEW_PATIENT_LAST_NAME);
        await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
        await patientInformationPage.verifyDateFieldValue(patientSummary.birthDate.key, NEW_PATIENT_DATE_OF_BIRTH);
        await patientInformationPage.verifySelectFieldValue(patientSummary.birthSex.key, NEW_PATIENT_BIRTH_SEX);
      });
      await ContactInformationTestStep('Verify required data from Contact info block populated', async () => {
        await patientInformationPage.verifyTextFieldValue(contactInformation.streetAddress.key, NEW_STREET_ADDRESS);
        await patientInformationPage.verifyTextFieldValue(contactInformation.city.key, NEW_CITY);
        await patientInformationPage.verifySelectFieldValue(contactInformation.state.key, NEW_STATE);
        await patientInformationPage.verifyTextFieldValue(contactInformation.zip.key, NEW_ZIP);
        await patientInformationPage.verifyTextFieldValue(contactInformation.email.key, NEW_PATIENT_EMAIL);
        await patientInformationPage.verifyPhoneFieldValue(contactInformation.phone.key, NEW_PATIENT_MOBILE);
      });

      await PatientDetailsTestStep('Verify entered by patient data from Patient details block populated', async () => {
        await patientInformationPage.verifySelectFieldValue(patientDetails.ethnicity.key, NEW_PATIENT_ETHNICITY);
        await patientInformationPage.verifySelectFieldValue(patientDetails.race.key, NEW_PATIENT_RACE);
      });

      await ResponsiblePartyTestStep('Verify data from Responsible party information block populated', async () => {
        await patientInformationPage.verifySelectFieldValue(
          responsibleParty.relationship.key,
          NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifyTextFieldValue(
          responsibleParty.firstName.key,
          NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifyTextFieldValue(
          responsibleParty.lastName.key,
          NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifyDateFieldValue(
          responsibleParty.birthDate.key,
          NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifySelectFieldValue(
          responsibleParty.birthSex.key,
          NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifyPhoneFieldValue(
          responsibleParty.phone.key,
          NEW_PHONE_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.verifyTextFieldValue(
          responsibleParty.email.key,
          NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER
        );
      });

      /*
    skipping these tests because this component has been hidden while await requirement clarification from product team
    await patientInformationPage.verifyReleaseOfInfo(RELEASE_OF_INFO);
    await patientInformationPage.verifyRxHistoryConsent(RX_HISTORY_CONSENT);
    */

      await PatientSummaryTestStep(
        'Check validation error is displayed if any required field in Patient info block is missing',
        async () => {
          const requiredFields: FormFieldsItem[] = [];
          for (const field of PATIENT_RECORD_CONFIG.FormFields.patientSummary.requiredFields ?? []) {
            const requiredField = Object.values(patientSummary).find((item) => item.key === field);
            if (requiredField) {
              requiredFields.push(requiredField);
            }
          }
          // note: choice and reference fields are skipped because they cannot be cleared in the application
          for (const field of requiredFields) {
            if (field.dataType === 'Phone Number') {
              await patientInformationPage.clearPhoneField(field.key);
            } else if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.clearField(field.key);
            }
          }
          if (requiredFields.length === 0) {
            return;
          }
          await patientInformationPage.clickSaveChangesButton();
          for (const field of requiredFields) {
            if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.verifyRequiredFieldValidationErrorShown(field.key);
            }
          }
        }
      );

      await ContactInformationTestStep(
        'Check validation error is displayed if any required field in Contact info block is missing',
        async () => {
          const requiredFields: FormFieldsItem[] = [];
          for (const field of PATIENT_RECORD_CONFIG.FormFields.patientContactInformation.requiredFields ?? []) {
            const requiredField = Object.values(contactInformation).find((item) => item.key === field);
            if (requiredField) {
              requiredFields.push(requiredField);
            }
          }

          for (const field of requiredFields) {
            if (field.dataType === 'Phone Number') {
              await patientInformationPage.clearPhoneField(field.key);
            } else if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.clearField(field.key);
            }
          }
          await patientInformationPage.clickSaveChangesButton();
          for (const field of requiredFields) {
            if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.verifyRequiredFieldValidationErrorShown(field.key);
            }
          }
        }
      );

      await ContactInformationTestStep(
        'Enter invalid email,zip and mobile on Contract info block, validation errors are shown',
        async () => {
          await patientInformationPage.enterTextFieldValue(contactInformation.zip.key, '11');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(contactInformation.zip.key, 'Must be 5 digits');
          await patientInformationPage.enterTextFieldValue(contactInformation.zip.key, '11223344');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(contactInformation.zip.key, 'Must be 5 digits');
          await patientInformationPage.enterTextFieldValue(
            contactInformation.email.key,
            'testEmailGetMaxListeners.com'
          );
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            contactInformation.email.key,
            'Must be in the format "email@example.com"'
          );
          await patientInformationPage.enterTextFieldValue(
            contactInformation.email.key,
            '@testEmailGetMaxListeners.com'
          );
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            contactInformation.email.key,
            'Must be in the format "email@example.com"'
          );
          await patientInformationPage.enterTextFieldValue(
            contactInformation.email.key,
            'testEmailGetMaxListeners@.com'
          );
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            contactInformation.email.key,
            'Must be in the format "email@example.com"'
          );
          await patientInformationPage.clearPhoneField(contactInformation.phone.key);
          await patientInformationPage.enterPhoneFieldValue(contactInformation.phone.key, '111');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            contactInformation.phone.key,
            'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
          );
        }
      );
      await ResponsiblePartyTestStep(
        'Check validation error is displayed if any required field in Responsible party information block is missing or phone number is invalid',
        async () => {
          await patientInformationPage.clearField(responsibleParty.firstName.key);
          await patientInformationPage.clearField(responsibleParty.lastName.key);
          await patientInformationPage.clearField(responsibleParty.birthDate.key);
          await patientInformationPage.clearPhoneField(responsibleParty.phone.key);
          await patientInformationPage.clickSaveChangesButton();

          await patientInformationPage.verifyRequiredFieldValidationErrorShown(responsibleParty.firstName.key);
          await patientInformationPage.verifyRequiredFieldValidationErrorShown(responsibleParty.lastName.key);
          await patientInformationPage.verifyRequiredFieldValidationErrorShown(responsibleParty.birthDate.key);
          await patientInformationPage.enterPhoneFieldValue(responsibleParty.phone.key, '111');
          await patientInformationPage.enterDateFieldValue(responsibleParty.birthDate.key, '10/10/2024');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            responsibleParty.phone.key,
            'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
          );
        }
      );

      await ResponsiblePartyTestStep(
        'When relationship is "Self", all triggered fields should be disabled',
        async () => {
          // Get all fields triggered by the relationship field that are NOT also triggered by address checkbox
          // (we want fields that only depend on relationship, not the address fields which have enableBehavior: 'all')
          const relationshipOnlyFields = getConditionalFields(
            responsibleParty,
            responsibleParty.relationship.key
          ).filter(
            (field) =>
              !getConditionalFields(responsibleParty, responsibleParty.addressSameAsPatient.key).some(
                (addrField) => addrField.key === field.key
              )
          );

          // Change relationship to "Self"
          await patientInformationPage.selectFieldOption(responsibleParty.relationship.key, 'Self');

          // Verify all triggered fields are disabled (by checking they're not enabled)
          for (const field of relationshipOnlyFields) {
            const fieldElement = patientInformationPage.inputByName(field.key);
            await test.expect(fieldElement).toBeDisabled();
          }

          // Change back to a different relationship and verify fields are enabled again
          await patientInformationPage.selectFieldOption(
            responsibleParty.relationship.key,
            NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
          );

          for (const field of relationshipOnlyFields) {
            const fieldElement = patientInformationPage.inputByName(field.key);
            await test.expect(fieldElement).toBeEnabled();
          }
        }
      );

      await ResponsiblePartyTestStep(
        'When "address same as patient" checkbox is checked, address fields should be disabled',
        async () => {
          // Get address fields that are triggered by the address checkbox
          // These fields have enableBehavior: 'all', meaning BOTH relationship != 'Self' AND checkbox != true must be met
          const addressCheckboxTriggeredFields = getConditionalFields(
            responsibleParty,
            responsibleParty.addressSameAsPatient.key
          );

          // Ensure relationship is not "Self" so we can test the checkbox behavior in isolation
          await patientInformationPage.selectFieldOption(
            responsibleParty.relationship.key,
            NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
          );

          // Initially, with relationship != 'Self' and checkbox unchecked, fields should be enabled
          await patientInformationPage.selectBooleanField(responsibleParty.addressSameAsPatient.key, false);
          for (const field of addressCheckboxTriggeredFields) {
            const fieldElement = patientInformationPage.inputByName(field.key);
            await test.expect(fieldElement).toBeEnabled();
          }

          // Check the "same as patient" checkbox - fields should now be disabled
          await patientInformationPage.selectBooleanField(responsibleParty.addressSameAsPatient.key, true);

          for (const field of addressCheckboxTriggeredFields) {
            const fieldElement = patientInformationPage.inputByName(field.key);
            await test.expect(fieldElement).toBeDisabled();
          }

          // Uncheck the checkbox and verify fields are enabled again
          await patientInformationPage.selectBooleanField(responsibleParty.addressSameAsPatient.key, false);

          for (const field of addressCheckboxTriggeredFields) {
            const fieldElement = patientInformationPage.inputByName(field.key);
            await test.expect(fieldElement).toBeEnabled();
          }
        }
      );

      await ResponsiblePartyTestStep(
        'Dynamic population: When relationship is "Self", fields should auto-populate from patient data and restore when changed back',
        async () => {
          // Ensure patient data is populated first (needed for dynamic population source)
          await patientInformationPage.enterTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
          await patientInformationPage.enterTextFieldValue(patientSummary.lastName.key, NEW_PATIENT_LAST_NAME);
          await patientInformationPage.enterDateFieldValue(patientSummary.birthDate.key, NEW_PATIENT_DATE_OF_BIRTH);
          await patientInformationPage.selectFieldOption(patientSummary.birthSex.key, NEW_PATIENT_BIRTH_SEX);
          await patientInformationPage.enterTextFieldValue(contactInformation.email.key, NEW_PATIENT_EMAIL);
          await patientInformationPage.enterPhoneFieldValue(contactInformation.phone.key, NEW_PATIENT_MOBILE);
          await patientInformationPage.enterTextFieldValue(contactInformation.streetAddress.key, NEW_STREET_ADDRESS);
          await patientInformationPage.enterTextFieldValue(contactInformation.city.key, NEW_CITY);
          await patientInformationPage.selectFieldOption(contactInformation.state.key, NEW_STATE);
          await patientInformationPage.enterTextFieldValue(contactInformation.zip.key, NEW_ZIP);

          // Build a mapping of fields with dynamic population from config
          const fieldsWithDynamicPopulation: Array<{
            rpKey: string;
            patientKey: string;
            rpValue: string;
            patientValue: string;
            fieldType: 'text' | 'date' | 'select' | 'phone';
          }> = [];

          // Find all responsible party fields that have dynamicPopulation
          for (const [fieldName, fieldConfig] of Object.entries(responsibleParty)) {
            if (fieldConfig.dynamicPopulation?.sourceLinkId) {
              const patientFieldKey = fieldConfig.dynamicPopulation.sourceLinkId;

              // Determine field type for proper value setting
              let fieldType: 'text' | 'date' | 'select' | 'phone' = 'text';
              if (fieldConfig.dataType === 'DOB' || fieldConfig.type === 'date') {
                fieldType = 'date';
              } else if (fieldConfig.type === 'choice') {
                fieldType = 'select';
              } else if (fieldConfig.dataType === 'Phone Number') {
                fieldType = 'phone';
              }

              // Set up test values (RP will have different values initially)
              let rpValue = '';
              let patientValue = '';

              if (fieldType === 'date') {
                rpValue = '05/05/1995';
                patientValue = NEW_PATIENT_DATE_OF_BIRTH;
              } else if (fieldType === 'select' && fieldName === 'birthSex') {
                rpValue = 'Female';
                patientValue = NEW_PATIENT_BIRTH_SEX;
              } else if (fieldType === 'phone') {
                rpValue = '(555) 999-9999';
                patientValue = NEW_PATIENT_MOBILE;
              } else if (fieldName === 'firstName') {
                rpValue = 'ResponsibleFirst';
                patientValue = NEW_PATIENT_FIRST_NAME;
              } else if (fieldName === 'lastName') {
                rpValue = 'ResponsibleLast';
                patientValue = NEW_PATIENT_LAST_NAME;
              } else if (fieldName === 'email') {
                rpValue = 'responsible@example.com';
                patientValue = NEW_PATIENT_EMAIL;
              } else if (fieldName === 'addressLine1') {
                rpValue = 'RP Street 123';
                patientValue = NEW_STREET_ADDRESS;
              } else if (fieldName === 'city') {
                rpValue = 'RP City';
                patientValue = NEW_CITY;
              } else if (fieldName === 'state') {
                rpValue = 'TX';
                patientValue = NEW_STATE;
              } else if (fieldName === 'zip') {
                rpValue = '99999';
                patientValue = NEW_ZIP;
              } else {
                // Skip fields we don't have test data for
                continue;
              }

              fieldsWithDynamicPopulation.push({
                rpKey: fieldConfig.key,
                patientKey: patientFieldKey,
                rpValue,
                patientValue,
                fieldType,
              });
            }
          }

          // Step 1: Ensure relationship is NOT "Self" and set initial RP values (different from patient values)
          await patientInformationPage.selectFieldOption(
            responsibleParty.relationship.key,
            NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
          );

          for (const field of fieldsWithDynamicPopulation) {
            if (field.fieldType === 'text') {
              await patientInformationPage.enterTextFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'date') {
              await patientInformationPage.enterDateFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'select') {
              await patientInformationPage.selectFieldOption(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'phone') {
              await patientInformationPage.enterPhoneFieldValue(field.rpKey, field.rpValue);
            }
          }

          // Verify initial RP values are set
          for (const field of fieldsWithDynamicPopulation) {
            if (field.fieldType === 'text') {
              await patientInformationPage.verifyTextFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'date') {
              await patientInformationPage.verifyDateFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'select') {
              await patientInformationPage.verifySelectFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'phone') {
              await patientInformationPage.verifyPhoneFieldValue(field.rpKey, field.rpValue);
            }
          }

          // Step 2: Change relationship to "Self" - RP fields should auto-populate with patient values
          await patientInformationPage.selectFieldOption(responsibleParty.relationship.key, 'Self');

          // Verify RP fields now show patient values (dynamic population)
          for (const field of fieldsWithDynamicPopulation) {
            if (field.fieldType === 'text') {
              await patientInformationPage.verifyTextFieldValue(field.rpKey, field.patientValue);
            } else if (field.fieldType === 'date') {
              await patientInformationPage.verifyDateFieldValue(field.rpKey, field.patientValue);
            } else if (field.fieldType === 'select') {
              await patientInformationPage.verifySelectFieldValue(field.rpKey, field.patientValue);
            } else if (field.fieldType === 'phone') {
              await patientInformationPage.verifyPhoneFieldValue(field.rpKey, field.patientValue);
            }
          }

          // Step 3: Change relationship back to "Parent" - RP fields should restore original values
          await patientInformationPage.selectFieldOption(
            responsibleParty.relationship.key,
            NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
          );

          // Verify RP fields are restored to original values
          for (const field of fieldsWithDynamicPopulation) {
            if (field.fieldType === 'text') {
              await patientInformationPage.verifyTextFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'date') {
              await patientInformationPage.verifyDateFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'select') {
              await patientInformationPage.verifySelectFieldValue(field.rpKey, field.rpValue);
            } else if (field.fieldType === 'phone') {
              await patientInformationPage.verifyPhoneFieldValue(field.rpKey, field.rpValue);
            }
          }
        }
      );

      // rework
      await PatientDetailsTestStep(
        'If "Other" gender is selected from Patient details  block, additional field appears and it is required',
        async () => {
          await patientInformationPage.selectFieldOption(patientDetails.genderIdentity.key, 'Other');
          await patientInformationPage.verifyFieldIsVisible(patientDetails.genderIdentityDetails.key);
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyRequiredFieldValidationErrorShown(
            patientDetails.genderIdentityDetails.key
          );
          await patientInformationPage.enterTextFieldValue(
            patientDetails.genderIdentityDetails.key,
            NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD
          );
          // await patientInformationPage.clickSaveChangesButton();
          // await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
          // await patientInformationPage.reloadPatientInformationPage();

          // await patientInformationPage.verifyGenderIdentity('Other');
          // await patientInformationPage.verifyTextFieldValue(patientDetails.genderIdentityDetails.key, NEW_PATIENT_DETAILS_PLEASE_SPECIFY_FIELD);
          // await patientInformationPage.selectFieldOption(patientDetails.genderIdentity.key, NEW_PATIENT_GENDER_IDENTITY);
          // await patientInformationPage.verifyFieldIsHidden(patientDetails.genderIdentityDetails.key);
          // await patientInformationPage.verifyGenderIdentity(NEW_PATIENT_GENDER_IDENTITY); // must go to successfully updated fields check
          // await patientInformationPage.verifyFieldIsHidden(patientDetails.genderIdentityDetails.key); // must go to successfully updated fields check
        }
      );

      await PatientDetailsTestStep(
        'If "Other" language is selected from Patient details block, additional field appears and it is required',
        async () => {
          await patientInformationPage.selectFieldOption(patientDetails.language.key, 'Other');
          await patientInformationPage.verifyFieldIsVisible(patientDetails.otherLanguage.key);
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyRequiredFieldValidationErrorShown(patientDetails.otherLanguage.key);
          await patientInformationPage.enterTextFieldValue(patientDetails.otherLanguage.key, 'Klingon');
          // Select a different language and verify the field is hidden again
          await patientInformationPage.selectFieldOption(patientDetails.language.key, NEW_PREFERRED_LANGUAGE);
          await patientInformationPage.verifyFieldIsHidden(patientDetails.otherLanguage.key);
        }
      );

      await PCPTestStep(
        'Check all fields from Primary Care Physician block are visible and required when checkbox is unchecked',
        async () => {
          await patientInformationPage.verifyBooleanFieldHasExpectedValue(primaryCarePhysician.active.key, false);

          // Get conditional fields from config
          const conditionalFields = getConditionalFields(primaryCarePhysician, primaryCarePhysician.active.key);

          // Verify all conditional fields are visible
          for (const field of conditionalFields) {
            await patientInformationPage.verifyFieldIsVisible(field.key);
          }

          // Clear all conditional fields
          for (const field of conditionalFields) {
            const fieldConfig =
              primaryCarePhysician[
                Object.keys(primaryCarePhysician).find((k) => primaryCarePhysician[k].key === field.key)!
              ];
            if (fieldConfig.dataType === 'Phone Number') {
              await patientInformationPage.clearPhoneField(field.key);
            } else {
              await patientInformationPage.clearField(field.key);
            }
          }

          await patientInformationPage.clickSaveChangesButton();

          // Verify required validation errors appear only for required fields (based on config)
          for (const field of conditionalFields) {
            if (field.shouldBeRequired) {
              await patientInformationPage.verifyRequiredFieldValidationErrorShown(field.key);
            }
          }
        }
      );

      await EmergencyContactTestStep(
        'Check validation error is displayed if any required field in Emergency Contact block is missing or phone number is invalid',
        async () => {
          // Get required fields from config
          const requiredFields: FormFieldsItem[] = [];
          for (const field of PATIENT_RECORD_CONFIG.FormFields.emergencyContact.requiredFields ?? []) {
            const requiredField = Object.values(emergencyContact).find((item) => item.key === field);
            if (requiredField) {
              requiredFields.push(requiredField);
            }
          }

          // Clear all required fields
          for (const field of requiredFields) {
            if (field.dataType === 'Phone Number') {
              await patientInformationPage.clearPhoneField(field.key);
            } else if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.clearField(field.key);
            }
          }

          await patientInformationPage.clickSaveChangesButton();

          // Verify required validation errors appear
          for (const field of requiredFields) {
            if (field.type !== 'choice' && field.type !== 'reference') {
              await patientInformationPage.verifyRequiredFieldValidationErrorShown(field.key);
            }
          }

          // Test invalid phone number validation
          await patientInformationPage.enterPhoneFieldValue(emergencyContact.phone.key, '111');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            emergencyContact.phone.key,
            'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
          );
        }
      );

      await PharmacyTestStep('Verify Pharmacy section fields can be filled', async () => {
        // Pharmacy has no required fields, so we just verify we can enter data
        await patientInformationPage.enterTextFieldValue(preferredPharmacy.name.key, NEW_PHARMACY_NAME);
        await patientInformationPage.enterTextFieldValue(preferredPharmacy.address.key, NEW_PHARMACY_ADDRESS);
      });

      await EmployerTestStep(
        'Check validation errors for Employer Information block with invalid email and phone',
        async () => {
          // Test invalid email validation
          await patientInformationPage.enterTextFieldValue(employerInformation.contactEmail.key, 'invalidEmailFormat');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            employerInformation.contactEmail.key,
            'Must be in the format "email@example.com"'
          );

          // Fix email
          await patientInformationPage.enterTextFieldValue(
            employerInformation.contactEmail.key,
            NEW_EMPLOYER_CONTACT_EMAIL
          );

          // Test invalid phone number validation
          await patientInformationPage.clearPhoneField(employerInformation.contactPhone.key);
          await patientInformationPage.enterPhoneFieldValue(employerInformation.contactPhone.key, '123');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            employerInformation.contactPhone.key,
            'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
          );

          // Fix phone
          await patientInformationPage.enterPhoneFieldValue(
            employerInformation.contactPhone.key,
            NEW_EMPLOYER_CONTACT_PHONE
          );

          // Test invalid fax number validation
          await patientInformationPage.clearPhoneField(employerInformation.contactFax.key);
          await patientInformationPage.enterPhoneFieldValue(employerInformation.contactFax.key, '456');
          await patientInformationPage.clickSaveChangesButton();
          await patientInformationPage.verifyFieldError(
            employerInformation.contactFax.key,
            'Phone number must be 10 digits in the format (xxx) xxx-xxxx'
          );

          // Fix fax
          await patientInformationPage.enterPhoneFieldValue(
            employerInformation.contactFax.key,
            NEW_EMPLOYER_CONTACT_FAX
          );
        }
      );
    });

    test('Updating values for all fields and saving. Checking that they are displayed correctly after save', async () => {
      await populateAllRequiredFields(patientInformationPage);

      await PatientSummaryTestStep('Updating values from Patient Information page sections', async () => {
        await patientInformationPage.enterTextFieldValue(patientSummary.middleName.key, NEW_PATIENT_MIDDLE_NAME);
        await patientInformationPage.enterTextFieldValue(patientSummary.suffix.key, NEW_PATIENT_SUFFIX);
        await patientInformationPage.enterTextFieldValue(patientSummary.preferredName.key, NEW_PATIENT_PREFERRED_NAME);
        await patientInformationPage.enterDateFieldValue(patientSummary.birthDate.key, NEW_PATIENT_DATE_OF_BIRTH);
        await patientInformationPage.selectFieldOption(patientSummary.pronouns.key, NEW_PATIENT_PREFERRED_PRONOUNS);
        await patientInformationPage.selectFieldOption(patientSummary.birthSex.key, NEW_PATIENT_BIRTH_SEX);
      });

      await ContactInformationTestStep('Updating values from Contact info block', async () => {
        await patientInformationPage.enterTextFieldValue(
          contactInformation.addressLine2.key,
          NEW_STREET_ADDRESS_OPTIONAL
        );
      });

      await ResponsiblePartyTestStep('Updating values from Responsible party information block', async () => {
        await patientInformationPage.enterTextFieldValue(
          responsibleParty.firstName.key,
          NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.enterTextFieldValue(
          responsibleParty.lastName.key,
          NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.enterDateFieldValue(
          responsibleParty.birthDate.key,
          NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.selectFieldOption(
          responsibleParty.birthSex.key,
          NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.enterPhoneFieldValue(
          responsibleParty.phone.key,
          NEW_PHONE_FROM_RESPONSIBLE_CONTAINER
        );
        await patientInformationPage.enterTextFieldValue(
          responsibleParty.email.key,
          NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER
        );
      });
      await PatientDetailsTestStep('Updating values from Patient details block', async () => {
        await patientInformationPage.selectFieldOption(patientDetails.ethnicity.key, NEW_PATIENT_ETHNICITY);
        await patientInformationPage.selectFieldOption(patientDetails.race.key, NEW_PATIENT_RACE);
        await patientInformationPage.selectFieldOption(
          patientDetails.sexualOrientation.key,
          NEW_PATIENT_SEXUAL_ORIENTATION
        );
        await patientInformationPage.selectFieldOption(patientDetails.genderIdentity.key, NEW_PATIENT_GENDER_IDENTITY);
        await patientInformationPage.selectFieldOption(
          patientDetails.pointOfDiscovery.key,
          NEW_PATIENT_HOW_DID_YOU_HEAR
        );
        // new SEND_MARKETING_MESSAGES = 'No'
        await patientInformationPage.selectBooleanField(patientDetails.sendMarketing.key, false);
        await patientInformationPage.selectFieldOption(patientDetails.language.key, NEW_PREFERRED_LANGUAGE);
        await patientInformationPage.selectBooleanField(patientDetails.commonWellConsent.key, NEW_COMMON_WELL_CONSENT);
      });

      await PCPTestStep('Updating values from Primary Care Physician block', async () => {
        await patientInformationPage.enterTextFieldValue(primaryCarePhysician.firstName.key, NEW_PROVIDER_FIRST_NAME);
        await patientInformationPage.enterTextFieldValue(primaryCarePhysician.lastName.key, NEW_PROVIDER_LAST_NAME);
        await patientInformationPage.enterTextFieldValue(primaryCarePhysician.practiceName.key, NEW_PRACTICE_NAME);
        await patientInformationPage.enterTextFieldValue(primaryCarePhysician.address.key, NEW_PHYSICIAN_ADDRESS);
        await patientInformationPage.enterPhoneFieldValue(primaryCarePhysician.phone.key, NEW_PHYSICIAN_MOBILE);
      });

      await EmergencyContactTestStep('Updating values from Emergency Contact block', async () => {
        await patientInformationPage.selectFieldOption(
          emergencyContact.relationship.key,
          NEW_EMERGENCY_CONTACT_RELATIONSHIP
        );
        await patientInformationPage.enterTextFieldValue(
          emergencyContact.firstName.key,
          NEW_EMERGENCY_CONTACT_FIRST_NAME
        );
        await patientInformationPage.enterTextFieldValue(
          emergencyContact.middleName.key,
          NEW_EMERGENCY_CONTACT_MIDDLE_NAME
        );
        await patientInformationPage.enterTextFieldValue(
          emergencyContact.lastName.key,
          NEW_EMERGENCY_CONTACT_LAST_NAME
        );
        await patientInformationPage.enterPhoneFieldValue(emergencyContact.phone.key, NEW_EMERGENCY_CONTACT_PHONE);
        await patientInformationPage.enterTextFieldValue(
          emergencyContact.streetAddress.key,
          NEW_EMERGENCY_CONTACT_STREET_ADDRESS
        );
        await patientInformationPage.enterTextFieldValue(
          emergencyContact.addressLine2.key,
          NEW_EMERGENCY_CONTACT_ADDRESS_LINE_2
        );
        await patientInformationPage.enterTextFieldValue(emergencyContact.city.key, NEW_EMERGENCY_CONTACT_CITY);
        await patientInformationPage.selectFieldOption(emergencyContact.state.key, NEW_EMERGENCY_CONTACT_STATE);
        await patientInformationPage.enterTextFieldValue(emergencyContact.zip.key, NEW_EMERGENCY_CONTACT_ZIP);
      });

      await PharmacyTestStep('Updating values from Pharmacy block', async () => {
        await patientInformationPage.enterTextFieldValue(preferredPharmacy.name.key, NEW_PHARMACY_NAME);
        await patientInformationPage.enterTextFieldValue(preferredPharmacy.address.key, NEW_PHARMACY_ADDRESS);
      });

      await EmployerTestStep('Updating values from Employer Information block', async () => {
        await patientInformationPage.enterTextFieldValue(employerInformation.employerName.key, NEW_EMPLOYER_NAME);
        await patientInformationPage.enterTextFieldValue(
          employerInformation.addressLine1.key,
          NEW_EMPLOYER_ADDRESS_LINE_1
        );
        await patientInformationPage.enterTextFieldValue(
          employerInformation.addressLine2.key,
          NEW_EMPLOYER_ADDRESS_LINE_2
        );
        await patientInformationPage.enterTextFieldValue(employerInformation.city.key, NEW_EMPLOYER_CITY);
        await patientInformationPage.selectFieldOption(employerInformation.state.key, NEW_EMPLOYER_STATE);
        await patientInformationPage.enterTextFieldValue(employerInformation.zip.key, NEW_EMPLOYER_ZIP);
        await patientInformationPage.enterTextFieldValue(
          employerInformation.contactFirstName.key,
          NEW_EMPLOYER_CONTACT_FIRST_NAME
        );
        await patientInformationPage.enterTextFieldValue(
          employerInformation.contactLastName.key,
          NEW_EMPLOYER_CONTACT_LAST_NAME
        );
        await patientInformationPage.enterTextFieldValue(
          employerInformation.contactTitle.key,
          NEW_EMPLOYER_CONTACT_TITLE
        );
        await patientInformationPage.enterTextFieldValue(
          employerInformation.contactEmail.key,
          NEW_EMPLOYER_CONTACT_EMAIL
        );
        await patientInformationPage.enterPhoneFieldValue(
          employerInformation.contactPhone.key,
          NEW_EMPLOYER_CONTACT_PHONE
        );
        await patientInformationPage.enterPhoneFieldValue(employerInformation.contactFax.key, NEW_EMPLOYER_CONTACT_FAX);
      });

      await test.step('Click save changes and verify successfully updated message', async () => {
        await patientInformationPage.clickSaveChangesButton();
        await patientInformationPage.verifyUpdatedSuccessfullyMessageShown();
        await patientInformationPage.verifyLoadingScreenIsNotVisible();
        await patientInformationPage.verifyFieldIsEnabled(patientSummary.firstName.key);
        // await patientInformationPage.reloadPatientInformationPage();
      });

      await PatientSummaryTestStep(
        'Checking that all fields from Patient Information page sections are updated correctly',
        async () => {
          await patientInformationPage.verifyTextFieldValue(patientSummary.lastName.key, NEW_PATIENT_LAST_NAME);
          await patientInformationPage.verifyTextFieldValue(patientSummary.firstName.key, NEW_PATIENT_FIRST_NAME);
          await patientInformationPage.verifyTextFieldValue(patientSummary.middleName.key, NEW_PATIENT_MIDDLE_NAME);
          await patientInformationPage.verifyTextFieldValue(patientSummary.suffix.key, NEW_PATIENT_SUFFIX);
          await patientInformationPage.verifyTextFieldValue(
            patientSummary.preferredName.key,
            NEW_PATIENT_PREFERRED_NAME
          );
          await patientInformationPage.verifyDateFieldValue(patientSummary.birthDate.key, NEW_PATIENT_DATE_OF_BIRTH);
          await patientInformationPage.verifySelectFieldValue(
            patientSummary.pronouns.key,
            NEW_PATIENT_PREFERRED_PRONOUNS
          );
          await patientInformationPage.verifySelectFieldValue(patientSummary.birthSex.key, NEW_PATIENT_BIRTH_SEX);
        }
      );

      await ContactInformationTestStep(
        'Checking that all fields from Contact info block are updated correctly',
        async () => {
          await patientInformationPage.verifyTextFieldValue(contactInformation.streetAddress.key, NEW_STREET_ADDRESS);
          await patientInformationPage.verifyTextFieldValue(
            contactInformation.addressLine2.key,
            NEW_STREET_ADDRESS_OPTIONAL
          );
          await patientInformationPage.verifyTextFieldValue(contactInformation.city.key, NEW_CITY);
          await patientInformationPage.verifySelectFieldValue(contactInformation.state.key, NEW_STATE);
          await patientInformationPage.verifyTextFieldValue(contactInformation.zip.key, NEW_ZIP);
          await patientInformationPage.verifyTextFieldValue(contactInformation.email.key, NEW_PATIENT_EMAIL);
          await patientInformationPage.verifyPhoneFieldValue(contactInformation.phone.key, NEW_PATIENT_MOBILE);
        }
      );

      await ResponsiblePartyTestStep(
        'Checking that all fields from Responsible party information block are updated correctly',
        async () => {
          await patientInformationPage.verifySelectFieldValue(
            responsibleParty.relationship.key,
            NEW_RELATIONSHIP_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifyTextFieldValue(
            responsibleParty.firstName.key,
            NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifyTextFieldValue(
            responsibleParty.lastName.key,
            NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifyDateFieldValue(
            responsibleParty.birthDate.key,
            NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifySelectFieldValue(
            responsibleParty.birthSex.key,
            NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifyPhoneFieldValue(
            responsibleParty.phone.key,
            NEW_PHONE_FROM_RESPONSIBLE_CONTAINER
          );
          await patientInformationPage.verifyTextFieldValue(
            responsibleParty.email.key,
            NEW_EMAIL_FROM_RESPONSIBLE_CONTAINER
          );
        }
      );

      await PatientDetailsTestStep(
        'Checking that all fields from Patient details block are updated correctly',
        async () => {
          await patientInformationPage.verifySelectFieldValue(patientDetails.ethnicity.key, NEW_PATIENT_ETHNICITY);
          await patientInformationPage.verifySelectFieldValue(patientDetails.race.key, NEW_PATIENT_RACE);
          await patientInformationPage.verifySelectFieldValue(
            patientDetails.sexualOrientation.key,
            NEW_PATIENT_SEXUAL_ORIENTATION
          );
          await patientInformationPage.verifySelectFieldValue(
            patientDetails.genderIdentity.key,
            NEW_PATIENT_GENDER_IDENTITY
          );
          await patientInformationPage.verifySelectFieldValue(
            patientDetails.pointOfDiscovery.key,
            NEW_PATIENT_HOW_DID_YOU_HEAR
          );
          await patientInformationPage.verifyBooleanFieldHasExpectedValue(
            patientDetails.sendMarketing.key,
            NEW_SEND_MARKETING_MESSAGES
          );
          await patientInformationPage.verifySelectFieldValue(patientDetails.language.key, NEW_PREFERRED_LANGUAGE);
          await patientInformationPage.verifyBooleanFieldHasExpectedValue(
            patientDetails.commonWellConsent.key,
            NEW_COMMON_WELL_CONSENT
          );
        }
      );

      await PCPTestStep(
        'Checking that all fields from Primary Care Physician block are updated correctly',
        async () => {
          await patientInformationPage.verifyTextFieldValue(
            primaryCarePhysician.firstName.key,
            NEW_PROVIDER_FIRST_NAME
          );
          await patientInformationPage.verifyTextFieldValue(primaryCarePhysician.lastName.key, NEW_PROVIDER_LAST_NAME);
          await patientInformationPage.verifyTextFieldValue(primaryCarePhysician.practiceName.key, NEW_PRACTICE_NAME);
          await patientInformationPage.verifyTextFieldValue(primaryCarePhysician.address.key, NEW_PHYSICIAN_ADDRESS);
          await patientInformationPage.verifyPhoneFieldValue(primaryCarePhysician.phone.key, NEW_PHYSICIAN_MOBILE);
        }
      );

      await EmergencyContactTestStep(
        'Checking that all fields from Emergency Contact block are updated correctly',
        async () => {
          await patientInformationPage.verifySelectFieldValue(
            emergencyContact.relationship.key,
            NEW_EMERGENCY_CONTACT_RELATIONSHIP
          );
          await patientInformationPage.verifyTextFieldValue(
            emergencyContact.firstName.key,
            NEW_EMERGENCY_CONTACT_FIRST_NAME
          );
          await patientInformationPage.verifyTextFieldValue(
            emergencyContact.middleName.key,
            NEW_EMERGENCY_CONTACT_MIDDLE_NAME
          );
          await patientInformationPage.verifyTextFieldValue(
            emergencyContact.lastName.key,
            NEW_EMERGENCY_CONTACT_LAST_NAME
          );
          await patientInformationPage.verifyPhoneFieldValue(emergencyContact.phone.key, NEW_EMERGENCY_CONTACT_PHONE);
          await patientInformationPage.verifyTextFieldValue(
            emergencyContact.streetAddress.key,
            NEW_EMERGENCY_CONTACT_STREET_ADDRESS
          );
          await patientInformationPage.verifyTextFieldValue(
            emergencyContact.addressLine2.key,
            NEW_EMERGENCY_CONTACT_ADDRESS_LINE_2
          );
          await patientInformationPage.verifyTextFieldValue(emergencyContact.city.key, NEW_EMERGENCY_CONTACT_CITY);
          await patientInformationPage.verifySelectFieldValue(emergencyContact.state.key, NEW_EMERGENCY_CONTACT_STATE);
          await patientInformationPage.verifyTextFieldValue(emergencyContact.zip.key, NEW_EMERGENCY_CONTACT_ZIP);
        }
      );

      await PharmacyTestStep('Checking that all fields from Pharmacy block are updated correctly', async () => {
        await patientInformationPage.verifyTextFieldValue(preferredPharmacy.name.key, NEW_PHARMACY_NAME);
        await patientInformationPage.verifyTextFieldValue(preferredPharmacy.address.key, NEW_PHARMACY_ADDRESS);
      });

      await EmployerTestStep(
        'Checking that all fields from Employer Information block are updated correctly',
        async () => {
          await patientInformationPage.verifyTextFieldValue(employerInformation.employerName.key, NEW_EMPLOYER_NAME);
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.addressLine1.key,
            NEW_EMPLOYER_ADDRESS_LINE_1
          );
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.addressLine2.key,
            NEW_EMPLOYER_ADDRESS_LINE_2
          );
          await patientInformationPage.verifyTextFieldValue(employerInformation.city.key, NEW_EMPLOYER_CITY);
          await patientInformationPage.verifySelectFieldValue(employerInformation.state.key, NEW_EMPLOYER_STATE);
          await patientInformationPage.verifyTextFieldValue(employerInformation.zip.key, NEW_EMPLOYER_ZIP);
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.contactFirstName.key,
            NEW_EMPLOYER_CONTACT_FIRST_NAME
          );
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.contactLastName.key,
            NEW_EMPLOYER_CONTACT_LAST_NAME
          );
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.contactTitle.key,
            NEW_EMPLOYER_CONTACT_TITLE
          );
          await patientInformationPage.verifyTextFieldValue(
            employerInformation.contactEmail.key,
            NEW_EMPLOYER_CONTACT_EMAIL
          );
          await patientInformationPage.verifyPhoneFieldValue(
            employerInformation.contactPhone.key,
            NEW_EMPLOYER_CONTACT_PHONE
          );
          await patientInformationPage.verifyPhoneFieldValue(
            employerInformation.contactFax.key,
            NEW_EMPLOYER_CONTACT_FAX
          );
        }
      );
    });
  });

  test.describe('Validating insurances section works correctly', async () => {
    const INSURANCE_PLAN_TYPE = '09 - Self Pay';
    const INSURANCE_MEMBER_ID = 'abc1234567';
    const INSURANCE_POLICY_HOLDER_ADDRESS = 'street 17';
    const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE = 'additional';
    const INSURANCE_POLICY_HOLDER_BIRTH_SEX = 'Intersex';
    const INSURANCE_POLICY_HOLDER_CITY = 'Anchorage';
    const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH = '04/04/1992';
    const INSURANCE_POLICY_HOLDER_FIRST_NAME = 'James';
    const INSURANCE_POLICY_HOLDER_LAST_NAME = 'Cannoli';
    const INSURANCE_POLICY_HOLDER_MIDDLE_NAME = 'Bob';
    const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED = 'Common Law Spouse';
    const INSURANCE_POLICY_HOLDER_STATE = 'AK';
    const INSURANCE_POLICY_HOLDER_ZIP = '78956';
    const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO = 'testing';
    const INSURANCE_CARRIER = '20446 - 6 Degrees Health Incorporated';

    const INSURANCE_PLAN_TYPE_2 = '12 - PPO';
    const INSURANCE_MEMBER_ID_2 = '987548ert';
    const INSURANCE_POLICY_HOLDER_ADDRESS_2 = 'second street';
    const INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2 = 'additional2';
    const INSURANCE_POLICY_HOLDER_BIRTH_SEX_2 = 'Male';
    const INSURANCE_POLICY_HOLDER_CITY_2 = 'Denver';
    const INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2 = '03/03/1991';
    const INSURANCE_POLICY_HOLDER_FIRST_NAME_2 = 'David';
    const INSURANCE_POLICY_HOLDER_LAST_NAME_2 = 'Sorbet';
    const INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2 = 'Roger';
    const INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2 = 'Injured Party';
    const INSURANCE_POLICY_HOLDER_STATE_2 = 'CO';
    const INSURANCE_POLICY_HOLDER_ZIP_2 = '21211';
    const INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2 = 'testing2';
    const INSURANCE_CARRIER_2 = '24585 - ACTIN Care Groups';

    let addInsuranceDialog: AddInsuranceDialog;

    test('Check validation error is displayed if any required field in Add insurance dialog is missing', async () => {
      addInsuranceDialog = await patientInformationPage.clickAddInsuranceButton();

      await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);
      await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);
      await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);
      await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
      await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);
      await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);
      await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP);
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.insuranceCarrier);
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersSex);
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.relationship);
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.state);

      await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER);
      await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX);
      await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
      await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE);

      await addInsuranceDialog.clearMemberId();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.memberId);
      await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);

      await addInsuranceDialog.clearPolicyHolderFirstName();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersFirstName);
      await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);

      await addInsuranceDialog.clearPolicyHolderLastName();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersLastName);
      await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);

      await addInsuranceDialog.clearDateOfBirthFromAddInsuranceDialog();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth);
      await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);

      await addInsuranceDialog.clearPolicyHolderStreetAddress();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.streetAddress);
      await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);

      await addInsuranceDialog.clearPolicyHolderCity();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.city);
      await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);

      await addInsuranceDialog.clearZipFromAddInsuranceDialog();
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
      await addInsuranceDialog.verifyValidationErrorShown(dataTestIds.addInsuranceDialog.zip);

      await test.step('Check validation error is displayed for invalid zip', async () => {
        await addInsuranceDialog.enterZipFromAddInsuranceDialog('11');
        await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
        await addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance();
        await addInsuranceDialog.enterZipFromAddInsuranceDialog('11223344');
        await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();
        await addInsuranceDialog.verifyValidationErrorZipFieldFromAddInsurance();
      });
    });

    test('Fill fields and add primary and secondary insurances, verify insurances are saved successfully with correct data. Check validation.', async () => {
      await addInsuranceDialog.selectInsuranceType('Primary');
      await addInsuranceDialog.selectPlanType(INSURANCE_PLAN_TYPE);
      await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID);
      await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME);
      await addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME);
      await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME);
      await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH);
      await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS);
      await addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE);
      await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY);
      await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP);
      await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER);
      await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX);
      await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED);
      await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE);
      await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO);
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

      await patientInformationPage.verifyCoverageAddedSuccessfullyMessageShown();
      await patientInformationPage.reloadPatientInformationPage();
      const primaryInsuranceCard = patientInformationPage.getInsuranceCard(0);
      await primaryInsuranceCard.clickShowMoreButton();
      await primaryInsuranceCard.verifyInsuranceType('Primary');
      await primaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER);
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].insurancePlanType.key, INSURANCE_PLAN_TYPE);
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].memberId.key, INSURANCE_MEMBER_ID);
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].firstName.key,
        INSURANCE_POLICY_HOLDER_FIRST_NAME
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].lastName.key,
        INSURANCE_POLICY_HOLDER_LAST_NAME
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].middleName.key,
        INSURANCE_POLICY_HOLDER_MIDDLE_NAME
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].birthDate.key,
        INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].birthSex.key,
        INSURANCE_POLICY_HOLDER_BIRTH_SEX
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].streetAddress.key,
        INSURANCE_POLICY_HOLDER_ADDRESS
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].addressLine2.key,
        INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE
      );
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].city.key, INSURANCE_POLICY_HOLDER_CITY);
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].state.key, INSURANCE_POLICY_HOLDER_STATE);
      await primaryInsuranceCard.verifyTextField(insuranceSection.items[0].zip.key, INSURANCE_POLICY_HOLDER_ZIP);
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].relationship.key,
        INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED
      );
      await primaryInsuranceCard.verifyTextField(
        insuranceSection.items[0].additionalInformation.key,
        INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO
      );

      await patientInformationPage.clickAddInsuranceButton();
      await addInsuranceDialog.verifyTypeField('Secondary', false);
      await addInsuranceDialog.selectPlanType(INSURANCE_PLAN_TYPE_2);
      await addInsuranceDialog.enterMemberId(INSURANCE_MEMBER_ID_2);
      await addInsuranceDialog.enterPolicyHolderFirstName(INSURANCE_POLICY_HOLDER_FIRST_NAME_2);
      await addInsuranceDialog.enterPolicyHolderMiddleName(INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2);
      await addInsuranceDialog.enterPolicyHolderLastName(INSURANCE_POLICY_HOLDER_LAST_NAME_2);
      await addInsuranceDialog.enterDateOfBirthFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2);
      await addInsuranceDialog.enterPolicyHolderStreetAddress(INSURANCE_POLICY_HOLDER_ADDRESS_2);
      await addInsuranceDialog.enterPolicyHolderAddressLine2(INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2);
      await addInsuranceDialog.enterPolicyHolderCity(INSURANCE_POLICY_HOLDER_CITY_2);
      await addInsuranceDialog.enterZipFromAddInsuranceDialog(INSURANCE_POLICY_HOLDER_ZIP_2);
      await addInsuranceDialog.selectInsuranceCarrier(INSURANCE_CARRIER_2);
      await addInsuranceDialog.selectPolicyHoldersBirthSex(INSURANCE_POLICY_HOLDER_BIRTH_SEX_2);
      await addInsuranceDialog.selectPatientsRelationship(INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2);
      await addInsuranceDialog.selectPolicyHoldersState(INSURANCE_POLICY_HOLDER_STATE_2);
      await addInsuranceDialog.enterAdditionalInsuranceInformation(INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2);
      await addInsuranceDialog.clickAddInsuranceButtonFromAddInsuranceDialog();

      await patientInformationPage.verifyCoverageAddedSuccessfullyMessageShown();
      await patientInformationPage.reloadPatientInformationPage();
      const secondaryInsuranceCard = patientInformationPage.getInsuranceCard(1);
      await secondaryInsuranceCard.clickShowMoreButton();
      await secondaryInsuranceCard.verifyInsuranceType('Secondary');
      await secondaryInsuranceCard.verifyInsuranceCarrier(INSURANCE_CARRIER_2);
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].insurancePlanType.key,
        INSURANCE_PLAN_TYPE_2
      );
      await secondaryInsuranceCard.verifyTextField(insuranceSection.items[1].memberId.key, INSURANCE_MEMBER_ID_2);
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].firstName.key,
        INSURANCE_POLICY_HOLDER_FIRST_NAME_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].lastName.key,
        INSURANCE_POLICY_HOLDER_LAST_NAME_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].middleName.key,
        INSURANCE_POLICY_HOLDER_MIDDLE_NAME_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].birthDate.key,
        INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].birthSex.key,
        INSURANCE_POLICY_HOLDER_BIRTH_SEX_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].streetAddress.key,
        INSURANCE_POLICY_HOLDER_ADDRESS_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].addressLine2.key,
        INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE_2
      );
      await secondaryInsuranceCard.verifyTextField(insuranceSection.items[1].city.key, INSURANCE_POLICY_HOLDER_CITY_2);
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].state.key,
        INSURANCE_POLICY_HOLDER_STATE_2
      );
      await secondaryInsuranceCard.verifyTextField(insuranceSection.items[1].zip.key, INSURANCE_POLICY_HOLDER_ZIP_2);
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].relationship.key,
        INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED_2
      );
      await secondaryInsuranceCard.verifyTextField(
        insuranceSection.items[1].additionalInformation.key,
        INSURANCE_POLICY_HOLDER_ADDITIONAL_INFO_2
      );
    });
  });
});

test.describe('Patient Record Page tests with zero patient data filled in', async () => {
  const PROCESS_ID = `patientRecordPage-zero-data-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID);

  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    await resourceHandler.setResources();
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Check state, ethnicity, race, relationship to patient are required', async () => {
    await page.goto('/patient/' + resourceHandler.patient.id);
    const addPatientPage = await openAddPatientPage(page);
    await addPatientPage.selectOffice(ENV_LOCATION_NAME!);
    await addPatientPage.enterMobilePhone(NEW_PATIENT_MOBILE);
    await addPatientPage.clickSearchForPatientsButton();
    await addPatientPage.clickPatientNotFoundButton();
    await addPatientPage.enterFirstName(NEW_PATIENT_FIRST_NAME);
    await addPatientPage.enterLastName(NEW_PATIENT_FIRST_NAME);
    await addPatientPage.enterDateOfBirth(NEW_PATIENT_DATE_OF_BIRTH);
    await addPatientPage.selectSexAtBirth(NEW_PATIENT_BIRTH_SEX);
    await addPatientPage.selectReasonForVisit(NEW_REASON_FOR_VISIT);
    await addPatientPage.selectVisitType('Walk-in In Person Visit');
    const appointmentCreationResponse = waitForResponseWithData(page, /\/create-appointment\//);
    await addPatientPage.clickAddButton();

    const response = await unpackFhirResponse<CreateAppointmentResponse>(await appointmentCreationResponse);
    const appointmentId = response.appointmentId;
    if (!appointmentId) {
      throw new Error('Appointment ID should be present in the response');
    }
    await resourceHandler.tagAppointmentForCleanup(appointmentId);

    const patientId = await resourceHandler.patientIdByAppointmentId(appointmentId);
    const patientInformationPage = await openPatientInformationPage(page, patientId);

    await ContactInformationTestStep('Enter contact information fields', async () => {
      await patientInformationPage.enterTextFieldValue(contactInformation.streetAddress.key, NEW_STREET_ADDRESS);
      await patientInformationPage.enterTextFieldValue(contactInformation.city.key, NEW_CITY);
      await patientInformationPage.enterTextFieldValue(contactInformation.email.key, NEW_PATIENT_EMAIL);
      await patientInformationPage.enterPhoneFieldValue(contactInformation.phone.key, NEW_PATIENT_MOBILE);
    });
    await ResponsiblePartyTestStep('Enter responsible party information fields', async () => {
      await patientInformationPage.enterTextFieldValue(
        responsibleParty.firstName.key,
        NEW_FIRST_NAME_FROM_RESPONSIBLE_CONTAINER
      );
      await patientInformationPage.enterTextFieldValue(
        responsibleParty.lastName.key,
        NEW_LAST_NAME_FROM_RESPONSIBLE_CONTAINER
      );
      await patientInformationPage.enterDateFieldValue(
        responsibleParty.birthDate.key,
        NEW_BIRTHDATE_FROM_RESPONSIBLE_CONTAINER
      );
      await patientInformationPage.selectFieldOption(
        responsibleParty.birthSex.key,
        NEW_BIRTH_SEX_FROM_RESPONSIBLE_CONTAINER
      );
    });
    await patientInformationPage.clickSaveChangesButton();

    await ContactInformationTestStep('Verify state required in Patient Contact Information section', async () => {
      await patientInformationPage.verifyRequiredFieldValidationErrorShown(contactInformation.state.key);
    });
    await PatientDetailsTestStep('Verify race and ethnicity required in Patient Details section', async () => {
      await patientInformationPage.verifyRequiredFieldValidationErrorShown(patientDetails.ethnicity.key);
      await patientInformationPage.verifyRequiredFieldValidationErrorShown(patientDetails.race.key);
    });
    await ResponsiblePartyTestStep('Verify relationship to patient required in Responsible Party section', async () => {
      await patientInformationPage.verifyRequiredFieldValidationErrorShown(responsibleParty.relationship.key);
    });
  });
});
