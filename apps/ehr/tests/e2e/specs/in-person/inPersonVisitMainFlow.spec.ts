import Oystehr from '@oystehr/sdk';
import { Page, test } from '@playwright/test';
import { QuestionnaireItemAnswerOption } from 'fhir/r4b';
import {
  chooseJson,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionInsuranceAnswers,
  getResponsiblePartyStepAnswers,
  INSURANCE_PLAN_PAYER_META_TAG_CODE,
  isoToDateObject,
} from 'utils';
import { getAuth0Token } from '../../../e2e-utils/auth/getAuth0Token';
import {
  PATIENT_INSURANCE_MEMBER_ID,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT,
  PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX,
  PATIENT_INSURANCE_POLICY_HOLDER_2_CITY,
  PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH,
  PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED,
  PATIENT_INSURANCE_POLICY_HOLDER_2_STATE,
  PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE,
  PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT,
  PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX,
  PATIENT_INSURANCE_POLICY_HOLDER_CITY,
  PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH,
  PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME,
  PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED,
  PATIENT_INSURANCE_POLICY_HOLDER_STATE,
  PATIENT_INSURANCE_POLICY_HOLDER_ZIP,
  ResourceHandler,
} from '../../../e2e-utils/resource-handler';
import { ENV_LOCATION_NAME } from '../../../e2e-utils/resource/constants';
import { expectAssessmentPage } from '../../page/in-person/InPersonAssessmentPage';
import { expectInPersonProgressNotePage } from '../../page/in-person/InPersonProgressNotePage';
import { expectPatientInfoPage, PatientInfoPage } from '../../page/PatientInfo';
import { openVisitsPage } from '../../page/VisitsPage';

const DIAGNOSIS = 'Situs inversus';
const EM_CODE = '99201 New Patient - E/M Level 1';

test.describe('Book appointment', async () => {
  const resourceHandler = new ResourceHandler();

  test.beforeEach(async () => {
    await resourceHandler.setResources();
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });
  test('Book appointment, start and complete Intake, check statuses', async ({ page }) => {
    const patientInfoPage = await intakeTestAppointment(page, resourceHandler);
    await patientInfoPage.cssHeader().verifyStatus('intake');
    await patientInfoPage.sideMenu().clickCompleteIntakeButton();
    await patientInfoPage.cssHeader().verifyStatus('ready for provider');
  });

  test('Book appointment, go to Hospitalization page and complete Intake, check statuses', async ({ page }) => {
    const patientInfoPage = await intakeTestAppointment(page, resourceHandler);
    const hospitalizationPage = await patientInfoPage.sideMenu().clickHospitalization();
    await hospitalizationPage.clickCompleteIntakeButton();
    await patientInfoPage.cssHeader().verifyStatus('ready for provider');
  });

  test('Book appointment, click Provider on "Patient info", check statuses', async ({ page }) => {
    const patientInfoPage = await intakeTestAppointment(page, resourceHandler);
    await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
    await patientInfoPage.cssHeader().verifyStatus('provider');
  });

  test('Book appointment,fill required fields for signing the visit, review and sign progress note', async ({
    page,
  }) => {
    await BookAppointmentFillInfoSignProgressNote(page, resourceHandler);
  });
});

test.describe('Book appointment filling insurances information on payment option step', async () => {
  let insuranceCarrier1: QuestionnaireItemAnswerOption | undefined;
  let insuranceCarrier2: QuestionnaireItemAnswerOption | undefined;

  test.beforeAll(async () => {
    const authToken = await getAuth0Token();
    const oystehr = new Oystehr({
      accessToken: authToken,
      fhirApiUrl: process.env.FHIR_API,
      projectApiUrl: process.env.PROJECT_API_ZAMBDA_URL,
    });
    const insuranceCarriersOptionsResponse = await oystehr.zambda.execute({
      id: process.env.GET_ANSWER_OPTIONS_ZAMBDA_ID!,
      answerSource: {
        resourceType: 'InsurancePlan',
        query: `status=active&_tag=${INSURANCE_PLAN_PAYER_META_TAG_CODE}`,
      },
    });
    const insuranceCarriersOptions = chooseJson(insuranceCarriersOptionsResponse) as QuestionnaireItemAnswerOption[];

    insuranceCarrier1 = insuranceCarriersOptions.at(0);
    insuranceCarrier2 = insuranceCarriersOptions.at(1);
  });

  const resourceHandler = new ResourceHandler('in-person', async ({ patientInfo }) => {
    return [
      getContactInformationAnswers({
        firstName: patientInfo.patient.firstName,
        lastName: patientInfo.patient.lastName,
        birthDate: isoToDateObject(patientInfo.patient.dateOfBirth || '') || undefined,
        email: patientInfo.patient.email,
        phoneNumber: patientInfo.patient.phoneNumber,
        birthSex: patientInfo.patient.sex,
      }),
      getPatientDetailsStepAnswers({}),
      getPaymentOptionInsuranceAnswers({
        insuranceCarrier: insuranceCarrier1!,
        insuranceMemberId: PATIENT_INSURANCE_MEMBER_ID,
        insurancePolicyHolderFirstName: PATIENT_INSURANCE_POLICY_HOLDER_FIRST_NAME,
        insurancePolicyHolderLastName: PATIENT_INSURANCE_POLICY_HOLDER_LAST_NAME,
        insurancePolicyHolderMiddleName: PATIENT_INSURANCE_POLICY_HOLDER_MIDDLE_NAME,
        insurancePolicyHolderDateOfBirth: PATIENT_INSURANCE_POLICY_HOLDER_DATE_OF_BIRTH,
        insurancePolicyHolderBirthSex: PATIENT_INSURANCE_POLICY_HOLDER_BIRTH_SEX,
        insurancePolicyHolderAddressAsPatient: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_AS_PATIENT,
        insurancePolicyHolderAddress: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS,
        insurancePolicyHolderAddressAdditionalLine: PATIENT_INSURANCE_POLICY_HOLDER_ADDRESS_ADDITIONAL_LINE,
        insurancePolicyHolderCity: PATIENT_INSURANCE_POLICY_HOLDER_CITY,
        insurancePolicyHolderState: PATIENT_INSURANCE_POLICY_HOLDER_STATE,
        insurancePolicyHolderZip: PATIENT_INSURANCE_POLICY_HOLDER_ZIP,
        insurancePolicyHolderRelationshipToInsured: PATIENT_INSURANCE_POLICY_HOLDER_RELATIONSHIP_TO_INSURED,
        insuranceCarrier2: insuranceCarrier2!,
        insuranceMemberId2: PATIENT_INSURANCE_MEMBER_ID,
        insurancePolicyHolderFirstName2: PATIENT_INSURANCE_POLICY_HOLDER_2_FIRST_NAME,
        insurancePolicyHolderLastName2: PATIENT_INSURANCE_POLICY_HOLDER_2_LAST_NAME,
        insurancePolicyHolderMiddleName2: PATIENT_INSURANCE_POLICY_HOLDER_2_MIDDLE_NAME,
        insurancePolicyHolderDateOfBirth2: PATIENT_INSURANCE_POLICY_HOLDER_2_DATE_OF_BIRTH,
        insurancePolicyHolderBirthSex2: PATIENT_INSURANCE_POLICY_HOLDER_2_BIRTH_SEX,
        insurancePolicyHolderAddressAsPatient2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_AS_PATIENT,
        insurancePolicyHolderAddress2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS,
        insurancePolicyHolderAddressAdditionalLine2: PATIENT_INSURANCE_POLICY_HOLDER_2_ADDRESS_ADDITIONAL_LINE,
        insurancePolicyHolderCity2: PATIENT_INSURANCE_POLICY_HOLDER_2_CITY,
        insurancePolicyHolderState2: PATIENT_INSURANCE_POLICY_HOLDER_2_STATE,
        insurancePolicyHolderZip2: PATIENT_INSURANCE_POLICY_HOLDER_2_ZIP,
        insurancePolicyHolderRelationshipToInsured2: PATIENT_INSURANCE_POLICY_HOLDER_2_RELATIONSHIP_TO_INSURED,
      }),
      getResponsiblePartyStepAnswers({}),
      getConsentStepAnswers({}),
    ];
  });
  test.beforeEach(async () => {
    await resourceHandler.setResources();
  });

  test.afterEach(async () => {
    await resourceHandler.cleanupResources();
  });
  test('Book appointment, fill required fields for signing the visit, review and sign progress note', async ({
    page,
  }) => {
    await BookAppointmentFillInfoSignProgressNote(page, resourceHandler);
  });
});

async function intakeTestAppointment(page: Page, resourceHandler: ResourceHandler): Promise<PatientInfoPage> {
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickPrebookedTab();
  await visitsPage.clickIntakeButton(resourceHandler.appointment.id!);
  return await expectPatientInfoPage(resourceHandler.appointment.id!, page);
}

async function BookAppointmentFillInfoSignProgressNote(page: Page, resourceHandler: ResourceHandler): Promise<void> {
  await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);
  const patientInfoPage = await intakeTestAppointment(page, resourceHandler);
  await patientInfoPage.cssHeader().clickSwitchStatusButton('provider');
  const progressNotePage = await expectInPersonProgressNotePage(page);
  await progressNotePage.verifyReviewAndSignButtonDisabled();
  await patientInfoPage.sideMenu().clickAssessment();
  const assessmentPage = await expectAssessmentPage(page);
  await assessmentPage.selectDiagnosis(DIAGNOSIS);
  await assessmentPage.selectEMCode(EM_CODE);
  await patientInfoPage.sideMenu().clickProgressNote();
  await progressNotePage.clickReviewAndSignButton();
  await progressNotePage.clickSignButton();
  await patientInfoPage.cssHeader().verifyStatus('completed');
  const visitsPage = await openVisitsPage(page);
  await visitsPage.selectLocation(ENV_LOCATION_NAME!);
  await visitsPage.clickDischargedTab();
  await visitsPage.verifyVisitPresent(resourceHandler.appointment.id!);
}
