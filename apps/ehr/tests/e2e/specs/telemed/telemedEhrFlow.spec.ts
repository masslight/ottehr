import { BrowserContext, expect, Page, test } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { awaitAppointmentsTableToBeVisible, telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import {
  AdditionalBooleanQuestionsFieldsNames,
  allLicensesForPractitioner,
  ApptTelemedTab,
  getAdditionalQuestionsAnswers,
  getAllergiesStepAnswers,
  getConsentStepAnswers,
  getContactInformationAnswers,
  getInviteParticipantStepAnswers,
  getMedicalConditionsStepAnswers,
  getMedicationsStepAnswers,
  getPatientDetailsStepAnswers,
  getPaymentOptionSelfPayAnswers,
  getResponsiblePartyStepAnswers,
  getSchoolWorkNoteStepAnswers,
  getSurgicalHistoryStepAnswers,
  getTelemedLocations,
  isoToDateObject,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../src/constants';
import { fillWaitAndSelectDropdown, getPatientConditionPhotosStepAnswers } from 'test-utils';
import Oystehr from '@oystehr/sdk';

async function getTestUserQualificationStates(resourceHandler: ResourceHandler): Promise<string[]> {
  const testsUser = await resourceHandler.getTestsUserAndPractitioner();
  const userQualificationStates = allLicensesForPractitioner(testsUser.practitioner)
    .filter((license) => license.active && license.state)
    .map((license) => license.state);
  if (userQualificationStates.length < 1) throw new Error('User has no qualification locations');
  return userQualificationStates;
}

async function getTestStateThatNotQualificationsStatesList(
  apiClient: Oystehr,
  qualificationStates: string[]
): Promise<string> {
  const activeStates = (await getTelemedLocations(apiClient))
    .filter((location) => location.available)
    .map((location) => location.state);
  const activeStateNotInList = activeStates.find((state) => !qualificationStates.includes(state));
  if (!activeStateNotInList)
    throw new Error(
      `Can't find active test state that not in list of test user qualifications states: ${JSON.stringify(
        qualificationStates
      )}`
    );
  return activeStateNotInList;
}

test.describe('Tests checking data without mutating state', () => {
  const myPatientsTabAppointmentResources = new ResourceHandler('telemed');
  const otherPatientsTabAppointmentResources = new ResourceHandler('telemed');
  let testsUserQualificationState: string;
  let randomState: string;

  test.beforeAll(async () => {
    const testsUserStates = await getTestUserQualificationStates(myPatientsTabAppointmentResources);
    testsUserQualificationState = testsUserStates[0];
    randomState = await getTestStateThatNotQualificationsStatesList(
      myPatientsTabAppointmentResources.apiClient,
      testsUserStates
    );

    await myPatientsTabAppointmentResources.setResources({
      telemedLocationState: testsUserQualificationState,
    });
    await otherPatientsTabAppointmentResources.setResources({
      telemedLocationState: randomState,
    });
  });

  test.afterAll(async () => {
    await myPatientsTabAppointmentResources.cleanupResources();
    await otherPatientsTabAppointmentResources.cleanupResources();
  });

  test("Appointment should appear correctly in 'my patients' tab", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await expect(
      page.getByTestId(
        dataTestIds.telemedEhrFlow.trackingBoardTableRow(myPatientsTabAppointmentResources.appointment.id!)
      )
    ).toBeVisible({ timeout: 20000 });
  });

  test("Appointment should appear correctly in 'all patients' tab.", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click();
    await awaitAppointmentsTableToBeVisible(page);

    await expect(
      page.getByTestId(
        dataTestIds.telemedEhrFlow.trackingBoardTableRow(otherPatientsTabAppointmentResources.appointment.id!)
      )
    ).toBeVisible();
  });

  test('Appointment has location label and is in a relevant location group', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    const appointmentId = myPatientsTabAppointmentResources.appointment.id;
    const appointmentRow = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId));

    const locationGroup = await appointmentRow.getAttribute('data-location-group');

    expect(locationGroup.toLowerCase()).toEqual(testsUserQualificationState.toLowerCase());
  });

  test('All appointments in my-patients section has appropriate assign buttons', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
    const allButtonsNames = (await table.getByRole('button').allTextContents()).join(', ');
    expect(allButtonsNames).not.toEqual(new RegExp('View'));
  });
});

test.describe('Tests interacting with appointment state', () => {
  test.describe.configure({ mode: 'serial' });

  const resourceHandler = new ResourceHandler(
    'telemed',
    async ({ patientInfo, appointmentId, authToken, zambdaUrl, projectId }) => {
      const patientConditionPhotosStepAnswers = await getPatientConditionPhotosStepAnswers({
        appointmentId,
        authToken,
        zambdaUrl,
        projectId,
        fileName: 'Landscape_1.jpg',
      });
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
        getMedicationsStepAnswers(),
        getAllergiesStepAnswers(),
        getMedicalConditionsStepAnswers(),
        getSurgicalHistoryStepAnswers(),
        getAdditionalQuestionsAnswers(),
        getPaymentOptionSelfPayAnswers(),
        getResponsiblePartyStepAnswers({}),
        getSchoolWorkNoteStepAnswers(),
        getConsentStepAnswers({}),
        getInviteParticipantStepAnswers(),
        patientConditionPhotosStepAnswers,
      ];
    }
  );
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    context = await browser.newContext();
    page = await context.newPage();

    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test('Assign appointment, and open it', async () => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await test.step('Find and assign my appointment', async () => {
      const myAppointmentAssignButton = page
        .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
        .getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton);

      expect(myAppointmentAssignButton).toBeDefined();
      await myAppointmentAssignButton?.click();
    });

    await telemedDialogConfirm(page);

    await test.step('Confirm ppointment assigned', async () => {
      const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
      await expect(statusChip).toBeVisible();
      await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
    });
  });

  test('Buttons on visit page should appear, in assigned appointment', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.cancelThisVisitButton)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.inviteParticipant)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).toBeVisible();
  });

  test('Unassign appointment, and check in "Ready for provider"', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);

    await page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign).click();
    await telemedDialogConfirm(page);
    await awaitAppointmentsTableToBeVisible(page);
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id))
    ).toBeVisible();
  });

  test('Check message for patient', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardChatButton(resourceHandler.appointment.id!)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.chatModalDescription)).toBeVisible();

    const expectedSms =
      'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
    await expect(page.getByText(expectedSms)).toBeVisible({ timeout: 25000 });
  });

  test('Buttons on visit page should not appear', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.cancelThisVisitButton)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.inviteParticipant)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).not.toBeVisible();
  });

  test('Assign my appointment back', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe).click();
    await telemedDialogConfirm(page);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip)).toHaveText(
      TelemedAppointmentStatusEnum['pre-video']
    );
  });

  test('Patient provided hpi data', async () => {
    await test.step('Medical conditions provided by patient', async () => {
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionPatientProvidedsList).getByText('Constipation')
      ).toBeVisible();
    });

    await test.step('Current medications provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedsList);
      await expect(list.getByText('Amoxicillin')).toBeVisible();
      await expect(list.getByText('Cetirizine/ Zyrtec')).toBeVisible();
    });

    await test.step('Known allergies provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList);
      await expect(list.getByText('Azithromycin (medication)')).toBeVisible();
      await expect(list.getByText('Fish/ Fish Oil (other)')).toBeVisible();
    });

    await test.step('Surgical history provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryPatientProvidedList);
      await expect(list.getByText('Circumcision')).toBeVisible();
      await expect(list.getByText('Ear tube placement (Myringotomy)')).toBeVisible();
    });

    await test.step('Additional questions provided by patient', async () => {
      await expect(
        page
          .getByTestId(
            dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(
              AdditionalBooleanQuestionsFieldsNames.CovidSymptoms
            )
          )
          .getByText('No')
      ).toBeVisible();
      await expect(
        page
          .getByTestId(
            dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(
              AdditionalBooleanQuestionsFieldsNames.TestedPositiveCovid
            )
          )
          .getByText('Yes')
      ).toBeVisible();
      await expect(
        page
          .getByTestId(
            dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(
              AdditionalBooleanQuestionsFieldsNames.TravelUsa
            )
          )
          .getByText('No')
      ).toBeVisible();
    });

    await test.step('Reason for visit provided by patient', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiReasonForVisit)).toHaveText(
        resourceHandler.appointment.description ?? ''
      );
    });

    await test.step('Condition photo provided by patient', async () => {
      const block = page.getByTestId(dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos);
      const image = block.locator('img');
      await expect(image).toHaveCount(1);
      const imageSrc = await image.getAttribute('src');
      expect(imageSrc).toContain(resourceHandler.patient.id);
      await image.click();

      const zoomedImage = page.locator("div[role='dialog'] img[alt='Patient condition photo #1']");
      await expect(zoomedImage).toBeVisible();
    });
    fail();
  });

  test('Should test appointment hpi fields', async () => {
    const medicalConditionsPattern = 'Z3A';
    const knownAllergiePattern = '10-undecenal';
    const surgicalHistoryPattern = '44950';
    const surgicalNote = 'surgical note';
    const chiefComplaintNotes = 'chief complaint';
    const chiefComplaintRos = 'chief ros';

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);

    await test.step('await until hpi fields are ready', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible();
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
          .first()
      ).not.toBeVisible();
    });

    await test.step('filling up all editable fields', async () => {
      await fillWaitAndSelectDropdown(
        page,
        dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
        medicalConditionsPattern
      );

      await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergiePattern);

      await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, surgicalHistoryPattern);

      await page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
        .locator('textarea')
        .first()
        .fill(surgicalNote);

      for (const question of ADDITIONAL_QUESTIONS) {
        // HERE WE TAKE ALL QUESTIONS ROWS AND SELECT TRUE LABELED RADIO BUTTON
        await page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
          .locator('input[type="radio"][value="true"]')
          .click();
      }

      await page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)
        .locator('textarea')
        .first()
        .fill(chiefComplaintNotes);
      await page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos)
        .locator('textarea')
        .first()
        .fill(chiefComplaintRos);

      await page.waitForTimeout(10000); // ensure resources are saved
    });

    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
          .first()
      ).not.toBeVisible();
    });

    await test.step('check medical conditions list', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(medicalConditionsPattern)
      );
    });

    await test.step('check known allergies list', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
        RegExp(knownAllergiePattern)
      );
    });

    await test.step('check surgical history list and note', async () => {
      // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible();
      // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toHaveText(surgicalHistoryPattern);

      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()
      ).toHaveText(surgicalNote);
    });

    await test.step('check additional questions', async () => {
      for (const question of ADDITIONAL_QUESTIONS) {
        await expect(
          page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
            .locator('input[value=true]')
        ).toBeChecked();
      }
    });

    await test.step('chief complaint notes and ros', async () => {
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).locator('textarea').first()
      ).toHaveText(chiefComplaintNotes);
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first()
      ).toHaveText(chiefComplaintRos);
    });
  });

  test('Assigned appointment should be in "provider" tab', async () => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await page.getByTestId(dataTestIds.telemedEhrFlow.telemedAppointmentsTabs(ApptTelemedTab.provider)).click();
    await awaitAppointmentsTableToBeVisible(page);
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    ).toBeVisible();
  });
});
