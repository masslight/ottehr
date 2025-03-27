import { expect, test } from '@playwright/test';
import { fillWaitAndSelectDropdown, getPatientConditionPhotosStepAnswers } from 'test-utils';
import {
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
  isoToDateObject,
  TELEMED_INITIAL_STATES,
} from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { awaitAppointmentsTableToBeVisible, telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { PATIENT_STATE, ResourceHandler } from '../../../e2e-utils/resource-handler';
import {
  ADDITIONAL_QUESTIONS,
  AdditionalBooleanQuestionsFieldsNames,
  stateCodeToFullName,
  TelemedAppointmentStatusEnum,
} from '../../../e2e-utils/temp-imports-from-utils';

// We may create new instances for the tests with mutable operations, and keep parralel tests isolated
const resourceHandler = new ResourceHandler('telemed');

const DEFAULT_TIMEOUT = { timeout: 15000 };

test.describe('Tests checking data without mutating state', () => {
  const resourceHandler2 = new ResourceHandler('telemed');

  test.beforeAll(async () => {
    await Promise.all([
      resourceHandler.setResources(),
      resourceHandler2.setResources({
        telemedLocationState: TELEMED_INITIAL_STATES.filter((state) => state === (process.env.STATE_ONE || ''))[0],
      }),
    ]);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
    await resourceHandler2.cleanupResources();
  });

  test("Appointment in 'my patients' tab is visible", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    ).toBeVisible(DEFAULT_TIMEOUT);
  });

  test('Appointment has location label and is in a relevant location group', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

    const state = PATIENT_STATE;
    const fullStateName = stateCodeToFullName[state];

    // Find the appointment row
    const appointmentRow = table
      .locator('tbody tr')
      .filter({ hasText: resourceHandler.appointment?.id ?? '' })
      .filter({ hasText: state })
      .filter({ hasText: new RegExp(TelemedAppointmentStatusEnum.ready, 'i') });

    await expect(appointmentRow).toBeVisible(DEFAULT_TIMEOUT);

    // Get the closest group row above the appointment
    const groupRowText = await appointmentRow.evaluate(
      (row, { testId }) => {
        const rows = Array.from(document.querySelectorAll('tbody tr'));
        const currentIndex = rows.indexOf(row);

        // Look up from current row to find the closest group row
        for (let i = currentIndex - 1; i >= 0; i--) {
          const currentRow = rows[i];
          if (currentRow.getAttribute('data-testid') === testId) {
            return currentRow.textContent;
          }
        }
        return null;
      },
      { testId: dataTestIds.telemedEhrFlow.trackingBoardTableGroupRow }
    );

    // Check if group row exists and contains the location name
    expect(groupRowText).toContain(fullStateName);
  });

  test("Another appointment in 'all patients' tab is visible", async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
    await awaitAppointmentsTableToBeVisible(page);
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler2.appointment.id!))
    ).toBeVisible(DEFAULT_TIMEOUT);
  });

  test('All appointments in my-patients section has appropriate assign buttons', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

    // Get all ready rows
    const readyRows = await table.locator('tbody tr').filter({ hasText: TelemedAppointmentStatusEnum.ready }).all();

    // Verify each ready row has an assign button
    await Promise.all(
      readyRows.map((row) =>
        expect(row.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton)).toBeVisible(DEFAULT_TIMEOUT)
      )
    );
  });

  // TODO: the next test doesn't make sense cause it doesn't account for the state of the appointment and if it's
  // in licensed states list for provider, it's wrong
  //   test('Appointments in all-patients section that are not in licensed state for provider are readonly', async ({
  //     page,
  //   }) => {
  //     await page.goto(`telemed/appointments`);
  //     await awaitAppointmentsTableToBeVisible(page);

  //     await test.step('go to all patients and find appointment', async () => {
  //       await page.getByTestId(dataTestIds.telemedEhrFlow.allPatientsButton).click(DEFAULT_TIMEOUT);
  //       await awaitAppointmentsTableToBeVisible(page);

  //       const otherAppointmentViewButton = page.getByTestId(
  //         dataTestIds.telemedEhrFlow.trackingBoardViewButton(resourceHandler2.appointment.id!)
  //       );

  //       expect(otherAppointmentViewButton).toBeDefined();
  //       await otherAppointmentViewButton?.click(DEFAULT_TIMEOUT);
  //     });

  //     await test.step('check that after clicking there are readonly view', async () => {
  //       const footer = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentChartFooter);
  //       await expect(footer).toBeVisible(DEFAULT_TIMEOUT);
  //       await expect(footer.getByTestId(dataTestIds.telemedEhrFlow.footerButtonAssignMe)).not.toBeVisible();
  //     });
  //   });
});

test.describe('Tests interacting with appointment state', () => {
  const resourceHandlerPrefilled = new ResourceHandler(
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
  test.beforeEach(async () => {
    await resourceHandlerPrefilled.setResources();
  });

  test.afterEach(async () => {
    await resourceHandlerPrefilled.cleanupResources();
  });

  test('Patient provided hpi data', async ({ page }) => {
    await test.step("go to appointment page and make sure it's in pre-video", async () => {
      await page.goto(`telemed/appointments/${resourceHandlerPrefilled.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

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
        resourceHandlerPrefilled.appointment.description ?? ''
      );
    });

    await test.step('Condition photo provided by patient', async () => {
      const block = page.getByTestId(dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos);
      const image = block.locator('img');
      await expect(image).toHaveCount(1);
      const imageSrc = await image.getAttribute('src');
      await image.click();

      const zoomedImage = page.locator("div[role='dialog'] img[alt='Patient condition photo #1']");
      await expect(zoomedImage).toBeVisible();
      const zoomedImageSrc = await zoomedImage.getAttribute('src');

      expect(imageSrc).toEqual(zoomedImageSrc);
    });
  });

  test('Assigned appointment has connect-to-patient button', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await test.step('Find and assign my appointment', async () => {
      const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

      const appointmentRow = table
        .locator('tbody tr')
        .filter({ hasText: resourceHandlerPrefilled.appointment?.id ?? '' });

      await expect(
        appointmentRow.filter({ has: page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton) })
      ).toBeVisible(DEFAULT_TIMEOUT);

      await appointmentRow.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton).click(DEFAULT_TIMEOUT);
    });

    await telemedDialogConfirm(page);

    await test.step('Appointment has connect-to-patient button', async () => {
      const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
      await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
      // todo: is it ok to have check like this that rely on status text??
      await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(
        DEFAULT_TIMEOUT
      );
    });
  });
  test('Appointment hpi fields', async ({ page }) => {
    const medicalConditionsPattern = 'Z3A';
    const knownAllergiePattern = '10-undecenal';
    const surgicalHistoryPattern = '44950';
    const surgicalNote = 'surgical note';
    const chiefComplaintNotes = 'chief complaint';
    const chiefComplaintRos = 'chief ros';

    await test.step("go to appointment page and make sure it's in pre-video", async () => {
      await page.goto(`telemed/appointments/${resourceHandlerPrefilled.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    await test.step('await until hpi fields are ready', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)).toBeVisible(DEFAULT_TIMEOUT);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
          .first()
      ).not.toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('filling up all editable fields', async () => {
      await fillWaitAndSelectDropdown(
        page,
        dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
        medicalConditionsPattern
      );

      // todo make tests for current medications tab, for this moment it's broken

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
          .click(DEFAULT_TIMEOUT);
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
      await page.reload(DEFAULT_TIMEOUT);
      await page.goto(`telemed/appointments/${resourceHandlerPrefilled.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsLoadingSkeleton)
          .first()
      ).not.toBeVisible(DEFAULT_TIMEOUT);
    });

    await test.step('check medical conditions list', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(medicalConditionsPattern)
      );
    });

    await test.step('check known allergies list', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible(DEFAULT_TIMEOUT);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
        RegExp(knownAllergiePattern)
      );
    });

    await test.step('check surgical history list and note', async () => {
      // await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible(DEFAULT_TIMEOUT);
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

  test('Connect to patient function', async ({ page }) => {
    await page.goto(`telemed/appointments/${resourceHandlerPrefilled.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });

    const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
    await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
    await connectButton.click(DEFAULT_TIMEOUT);

    await telemedDialogConfirm(page);

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
  });
});
