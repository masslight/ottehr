import Oystehr from '@oystehr/sdk';
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { AppointmentParticipant, Location } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getPatientConditionPhotosStepAnswers,
  waitForChartDataDeletion,
  waitForSaveChartDataResponse,
} from 'test-utils';
import { expectTelemedTrackingBoard, TelemedTrackingBoardPage } from 'tests/e2e/page/telemed/TelemedTrackingBoardPage';
import {
  allLicensesForPractitioner,
  ApptTelemedTab,
  DATE_FORMAT,
  formatScreeningQuestionValue,
  getAdditionalQuestionsAnswers,
  getAllergiesStepAnswers,
  getCardPaymentStepAnswers,
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
  isLocationVirtual,
  isoToDateObject,
  TelemedAppointmentStatusEnum,
  TelemedAppointmentVisitTabs,
} from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../src/constants';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { checkDropdownHasOptionAndSelectIt, telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

const DEFAULT_TIMEOUT = { timeout: 15000 };

async function getTestUserQualificationStates(resourceHandler: ResourceHandler): Promise<string[]> {
  const testsUser = await resourceHandler.getTestsUserAndPractitioner();

  const telemedLocations = await getTelemedLocations(await resourceHandler.apiClient);
  if (!telemedLocations) {
    throw new Error('No Telemed locations available');
  }
  const availableStates = new Set(
    telemedLocations.filter((location) => location.available).map((location) => location.state)
  );

  const userQualificationStates = allLicensesForPractitioner(testsUser.practitioner)
    .filter((license) => license.active && license.state && availableStates.has(license.state))
    .map((license) => license.state);
  if (userQualificationStates.length < 1) throw new Error('User has no qualification locations');
  return userQualificationStates;
}

async function getTestStateThatNotQualificationsStatesList(
  apiClient: Oystehr,
  qualificationStates: string[]
): Promise<string> {
  const activeStates = (await getTelemedLocations(apiClient))
    ?.filter((location) => location.available)
    .map((location) => location.state);
  const activeStateNotInList = activeStates?.find((state) => !qualificationStates.includes(state));
  if (!activeStateNotInList)
    throw new Error(
      `Can't find active test state that not in list of test user qualifications states: ${JSON.stringify(
        qualificationStates
      )}`
    );
  return activeStateNotInList;
}

test.describe.configure({ mode: 'serial' });

test.describe('Telemed tracking board checks, buttons, chart data filling', () => {
  let page: Page;
  let context: BrowserContext;

  let telemedTrackingBoard: TelemedTrackingBoardPage;

  const myPatientsProcessId = `telemedEhrFlow.spec.ts-my-patients-non-mutating-${DateTime.now().toMillis()}`;
  const myPatientsTabAppointmentResources = new ResourceHandler(
    myPatientsProcessId,
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
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          birthDate: isoToDateObject(patientInfo.dateOfBirth || '') || undefined,
          email: patientInfo.email,
          phoneNumber: patientInfo.phoneNumber,
          birthSex: patientInfo.sex,
        }),
        getPatientDetailsStepAnswers({}),
        getMedicationsStepAnswers(),
        getAllergiesStepAnswers(),
        getMedicalConditionsStepAnswers(),
        getSurgicalHistoryStepAnswers(),
        getAdditionalQuestionsAnswers(),
        getPaymentOptionSelfPayAnswers(),
        getCardPaymentStepAnswers(),
        getResponsiblePartyStepAnswers({}),
        getSchoolWorkNoteStepAnswers(),
        getConsentStepAnswers({}),
        getInviteParticipantStepAnswers(),
        patientConditionPhotosStepAnswers,
      ];
    }
  );
  const otherPatientsProcessId = `telemedEhrFlow.spec.ts-other-patients-non-mutating-${DateTime.now().toMillis()}`;
  const otherPatientsTabAppointmentResources = new ResourceHandler(otherPatientsProcessId, 'telemed');
  let testsUserQualificationState: string;
  let randomState: string;

  test.beforeAll(async ({ browser }) => {
    const testsUserStates = await getTestUserQualificationStates(myPatientsTabAppointmentResources);
    testsUserQualificationState = testsUserStates[0];
    randomState = await getTestStateThatNotQualificationsStatesList(
      await myPatientsTabAppointmentResources.apiClient,
      testsUserStates
    );

    await Promise.all([
      myPatientsTabAppointmentResources.setResources({
        telemedLocationState: testsUserQualificationState,
      }),
      otherPatientsTabAppointmentResources.setResources({
        telemedLocationState: randomState,
      }),
    ]);
    context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await page.close();
    await context.close();
    await Promise.all([
      myPatientsTabAppointmentResources.cleanupResources(),
      otherPatientsTabAppointmentResources.cleanupResources(),
    ]);
  });

  test('Appointments should appear correctly in telemed tracking board tabs', async () => {
    await page.goto(`telemed/appointments`);
    telemedTrackingBoard = await expectTelemedTrackingBoard(page);

    await test.step("Appointment should appear correctly in 'all patients' tab.", async () => {
      await telemedTrackingBoard.clickAllPatientsTab();
      await telemedTrackingBoard.awaitAppointmentsTableToBeLoaded();

      await telemedTrackingBoard.expectAppointment(otherPatientsTabAppointmentResources.appointment.id!);
    });

    await test.step("Appointment should appear correctly in 'my patients' tab.", async () => {
      await telemedTrackingBoard.clickMyPatientsTab();
      await telemedTrackingBoard.awaitAppointmentsTableToBeLoaded();

      await telemedTrackingBoard.expectAppointment(myPatientsTabAppointmentResources.appointment.id!);
    });
  });

  test('Appointment has location label and is in a relevant location group', async () => {
    const appointmentId = myPatientsTabAppointmentResources.appointment.id;
    const appointmentRow = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId!));

    const locationGroup = await appointmentRow.getAttribute('data-location-group');

    expect(locationGroup?.toLowerCase()).toEqual(testsUserQualificationState.toLowerCase());
  });

  test('All appointments in my-patients section has appropriate assign buttons', async () => {
    const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');
    const allButtonsNames = (await table.getByRole('button').allTextContents()).join(', ');
    expect(allButtonsNames).not.toEqual(new RegExp('View'));
  });

  test('Appointment is present in tracking board, can be assigned', async () => {
    await test.step('Find and assign my appointment', async () => {
      const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

      const appointmentRow = table
        .locator('tbody tr')
        .filter({ hasText: myPatientsTabAppointmentResources.appointment?.id });

      await expect(
        appointmentRow.filter({ has: page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton) })
      ).toBeVisible(DEFAULT_TIMEOUT);

      await appointmentRow.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton).click(DEFAULT_TIMEOUT);

      await telemedDialogConfirm(page);
    });

    await test.step('Correct buttons on visit page should appear in assigned appointment', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.cancelThisVisitButton)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.inviteParticipant)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).toBeVisible();
    });

    await test.step('Appointment has pre-video status', async () => {
      const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
      await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
      await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
    });
  });

  test('Assigned appointment should be in "provider" tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.closeChartButton).click();
    await telemedTrackingBoard.openTab(ApptTelemedTab.provider);
    await telemedTrackingBoard.awaitAppointmentsTableToBeLoaded();
    await telemedTrackingBoard.expectAppointment(myPatientsTabAppointmentResources.appointment.id!);
  });

  test('Unassign appointment, and check in "Ready for provider"', async () => {
    await telemedTrackingBoard.clickAppointmentRow(myPatientsTabAppointmentResources.appointment.id!);
    await page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign).click();
    await telemedDialogConfirm(page);
    await telemedTrackingBoard.awaitAppointmentsTableToBeLoaded();
    await telemedTrackingBoard.expectAppointment(myPatientsTabAppointmentResources.appointment.id!);
  });

  // test.skip('Check message for patient', { tag: '@flaky' }, async () => {
  //   await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardChatButton(resourceHandler.appointment.id!)).click();
  //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.chatModalDescription)).toBeVisible();

  //   const expectedSms =
  //     'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
  //   await expect(page.getByText(expectedSms).first()).toBeVisible({ timeout: 25000 });
  // });

  test('Buttons on visit page should not appear', async () => {
    await telemedTrackingBoard.clickAppointmentRow(myPatientsTabAppointmentResources.appointment.id!);

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.cancelThisVisitButton)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.inviteParticipant)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).not.toBeVisible();
  });

  test('Assign my appointment back', async () => {
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test('Connection to patient is working', async () => {
    const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
    await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
    await connectButton.click(DEFAULT_TIMEOUT);

    await telemedDialogConfirm(page);

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
    await page.getByTestId(dataTestIds.telemedEhrFlow.pinVideoCallButton).click();
  });

  test('Patient provided hpi data is correct', async () => {
    await test.step('Medical conditions provided by patient', async () => {
      await expect(
        page.getByTestId(dataTestIds.medicalConditions.medicalConditionPatientProvidedList).getByText('Constipation')
      ).toBeVisible();
    });

    await test.step('Current medications provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList);
      await expect(list.getByText('Amoxicillin')).toBeVisible();
      // cSpell:disable-next Cetirizine
      await expect(list.getByText('Cetirizine/ Zyrtec')).toBeVisible();
    });

    await test.step('Known allergies provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.allergies.knownAllergiesPatientProvidedList);
      // cSpell:disable-next Azithromycin
      await expect(list.getByText('Azithromycin (medication)')).toBeVisible();
      await expect(list.getByText('Fish/ Fish Oil (other)')).toBeVisible();
    });

    await test.step('Surgical history provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryPatientProvidedList);
      await expect(list.getByText('Circumcision')).toBeVisible();
      // cSpell:disable-next Myringotomy
      await expect(list.getByText('Ear tube placement (Myringotomy)')).toBeVisible();
    });

    await test.step('Additional questions provided by patient', async () => {
      for (const question of ADDITIONAL_QUESTIONS) {
        await expect(
          page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
        ).toBeVisible();
      }
    });

    await test.step('Reason for visit provided by patient', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiReasonForVisit)).toHaveText(
        myPatientsTabAppointmentResources.appointment.description ?? ''
      );
    });

    await test.step('Condition photo provided by patient', async () => {
      const block = page.getByTestId(dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos);
      const image = block.locator('img');
      await expect(image).toHaveCount(1);
      const imageSrc = await image.getAttribute('src');
      expect(imageSrc).toContain(myPatientsTabAppointmentResources.patient.id);
      await image.click();

      const zoomedImage = page.locator("div[role='dialog'] img[alt='Patient condition photo #1']");
      await expect(zoomedImage).toBeVisible();
      await page.getByTestId(dataTestIds.telemedEhrFlow.closeImagePreviewButton).click();
      await expect(zoomedImage).not.toBeVisible();
    });
  });

  test.describe('Chart data manipulations and validation checks', async () => {
    test('Check all hpi fields common functionality, without changing data', async () => {
      const startTypingMessage = 'Start typing to load results';
      // const searchOptionThatNotInList = 'undefined';
      // const noOptionsMessage = 'Nothing found for this search criteria';

      await test.step('Medical conditions. Should display message before typing in field', async () => {
        await page.getByTestId(dataTestIds.medicalConditions.medicalConditionsInput).locator('input').click();
        await expect(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage);
      });

      // await test.step('Medical conditions. Should check not-in-list item search try', async () => {
      //   await checkDropdownNoOptions(
      //     page,
      //     dataTestIds.medicalConditions.medicalConditionsInput,
      //     searchOptionThatNotInList,
      //     noOptionsMessage
      //   );
      // });

      // await test.step('Current medications. Should display message before typing in field', async () => {
      //   await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input').click();
      //   await expect(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage);
      // });

      // await test.step('Current medications. Should check not-in-list item search try', async () => {
      //   await checkDropdownNoOptions(
      //     page,
      //     dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput,
      //     searchOptionThatNotInList,
      //     noOptionsMessage
      //   );
      // });

      // await test.step('Known allergies. Should display message before typing in field', async () => {
      //   await checkDropdownNoOptions(page, dataTestIds.allergies.knownAllergiesInput, '', startTypingMessage);
      // });

      // await test.step('Known allergies. Should check not-in-list item search try', async () => {
      //   const input = page.getByTestId(dataTestIds.allergies.knownAllergiesInput).locator('input');
      //   await input.click();
      //   await page.waitForTimeout(10000); // todo something async causes flakiness here
      //   await input.fill(noOptionsMessage);
      //   const option = await getDropdownOption(page, 'Other');
      //   await expect(option).toBeVisible();
      // });

      // await test.step('Surgical history. Should check not-in-list item search try', async () => {
      //   await checkDropdownNoOptions(
      //     page,
      //     dataTestIds.surgicalHistory.surgicalHistoryInput,
      //     searchOptionThatNotInList,
      //     noOptionsMessage
      //   );
      // });

      await test.step('Should check the list of Additional Questions is the same for patient and provider', async () => {
        for (const question of ADDITIONAL_QUESTIONS) {
          await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))).toHaveText(
            new RegExp(question.label)
          );
          await expect(
            page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
          ).toHaveText(new RegExp(question.label));
        }
      });

      await test.step('Should check provider has the same answers for Additional Questions as Patient provided.', async () => {
        const answers = getAdditionalQuestionsAnswers().item;
        for (const question of ADDITIONAL_QUESTIONS) {
          const rawAnswer = answers?.find((item) => item.linkId === question.field)?.answer?.[0]?.valueString ?? '';
          const formattedAnswer = formatScreeningQuestionValue(question.field, rawAnswer);
          await expect(
            page
              .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
              .getByText(formattedAnswer)
          ).toBeVisible();
        }
      });
    });

    const conditionName = 'anemia';
    const conditionIcdCode = 'D60';

    const scheduledMedicationName = 'aspirin';
    const scheduledMedicationDose = '100';
    const scheduledMedicationDate = '01/01/2025';
    const scheduledMedicationTime = '10:00 AM';
    const asNeededMedicationName = 'ibuprofen';
    const asNeededMedicationDose = '200';
    const asNeededMedicationDate = '01/01/2025';
    const asNeededMedicationTime = '10:00 AM';

    const knownAllergyName = 'penicillin';

    const surgery = 'feeding';
    const providerNote = 'lorem ipsum';

    const ROS = 'ROS Lorem ipsum';

    test.describe('Fill in chart data', async () => {
      test('Medical conditions', async () => {
        await test.step('Should search medical condition, and select it', async () => {
          await checkDropdownHasOptionAndSelectIt(
            page,
            dataTestIds.medicalConditions.medicalConditionsInput,
            conditionName
          );
        });

        await test.step('Should search medical condition by ICD10 code, and select it', async () => {
          await checkDropdownHasOptionAndSelectIt(
            page,
            dataTestIds.medicalConditions.medicalConditionsInput,
            conditionIcdCode
          );
        });

        await test.step('check medical condition saved', async () => {
          await expect(page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).toHaveText(
            RegExp(conditionName, 'i')
          );
        });
        await test.step('check medical condition searched by ICD10 code saved', async () => {
          await expect(page.getByTestId(dataTestIds.medicalConditions.medicalConditionsList)).toHaveText(
            RegExp(conditionIcdCode, 'i')
          );
        });
      });

      test('Current medications', async () => {
        await test.step('Should create scheduled medication', async () => {
          await checkDropdownHasOptionAndSelectIt(
            page,
            dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput,
            scheduledMedicationName
          );
          await page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
            .locator('input')
            .fill(scheduledMedicationDose);
          const dateLocator = page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput)
            .locator('input');
          await dateLocator.click();
          await dateLocator.pressSequentially(scheduledMedicationDate.concat(' ', scheduledMedicationTime));
          await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
          await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
        });

        await test.step('Should check scheduled medication is saved in HPI tab', async () => {
          const scheduledMedicationList = page.getByTestId(
            dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList
          );

          await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationName, 'i'));
          await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationDose, 'i'));
          await expect(scheduledMedicationList).toContainText(formatDateForMedications(scheduledMedicationDate));
          await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationTime, 'i'));
        });

        await test.step('Should create as needed medication', async () => {
          await checkDropdownHasOptionAndSelectIt(
            page,
            dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput,
            asNeededMedicationName
          );
          await page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput)
            .locator('input')
            .fill(asNeededMedicationDose);
          const dateLocator = page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateTimeInput)
            .locator('input');
          await dateLocator.click();
          await dateLocator.pressSequentially(asNeededMedicationDate.concat(' ', asNeededMedicationTime));
          await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton).click();
          await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
          await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
        });

        await test.step('Should check as needed medication is saved in HPI tab', async () => {
          const asNeededMedicationList = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList);
          await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationName, 'i'));
          await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationDose, 'i'));
          await expect(asNeededMedicationList).toContainText(
            RegExp(formatDateForMedications(asNeededMedicationDate), 'i')
          );
          await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationTime, 'i'));
        });

        await test.step('Should test required fields validation works', async () => {
          const medicationInput = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput);
          await expect(medicationInput.locator('label')).toHaveClass(/Mui-required/);
          await expect(medicationInput.locator('input[required]:invalid')).toBeVisible();
          await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
          await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
        });
      });

      test('Known allergies', async () => {
        await test.step('Should search known allergy, and select it', async () => {
          await checkDropdownHasOptionAndSelectIt(page, dataTestIds.allergies.knownAllergiesInput, knownAllergyName);
        });

        await test.step('Should check known allergies are saved in HPI tab', async () => {
          await expect(page.getByTestId(dataTestIds.allergies.knownAllergiesList)).toHaveText(
            RegExp(knownAllergyName, 'i')
          );
        });
      });

      test('Surgical history', async () => {
        await test.step('Should add provider notes', async () => {
          await page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
            .locator('textarea')
            .first()
            .fill(providerNote);
          // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryAddNoteButton).click();
          // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNoteIsLoading).waitFor({ state: 'visible' });
          // await page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNoteIsLoading).waitFor({ state: 'hidden' });
          await waitForSaveChartDataResponse(page);
        });

        await test.step('Should search surgery and select it', async () => {
          await checkDropdownHasOptionAndSelectIt(page, dataTestIds.surgicalHistory.surgicalHistoryInput, surgery);
        });

        await test.step('Should check surgical history are saved in HPI tab', async () => {
          await expect(page.getByTestId(dataTestIds.surgicalHistory.surgicalHistoryList)).toHaveText(
            RegExp(surgery, 'i')
          );
        });

        await test.step('Should check provider note saved in HPI tab', async () => {
          await expect(
            page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()
          ).toHaveText(providerNote);
        });
      });

      test('Chief complaint HPI and ROS', async () => {
        await test.step('Should add HPI provider notes and ROS', async () => {
          await page
            .getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes)
            .locator('textarea')
            .first()
            .fill(providerNote);
          await waitForSaveChartDataResponse(page);
          await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill(ROS);
          await waitForSaveChartDataResponse(page);
        });
      });
    });

    test.describe('Verify chart data on progress note page', async () => {
      test('Current Medications appear on Review&Sign tab', async () => {
        await page
          .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign))
          .click();
        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
        await expect(page.getByText(RegExp(scheduledMedicationName, 'i'))).toBeVisible();
        await expect(page.getByText(RegExp(asNeededMedicationName, 'i'))).toBeVisible();
      });

      test('Surgical History appears in Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toHaveText(
          new RegExp(surgery, 'i')
        );
        await test.step('Should check Surgical History provider note saved in Review&Sign tab', async () => {
          await expect(page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toHaveText(
            new RegExp(providerNote, 'i')
          );
        });
      });

      test('HPI provider notes and ROS appear on Review&Sign page', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

        await expect(page.getByTestId(dataTestIds.progressNotePage.hpiContainer)).toHaveText(new RegExp(providerNote));
        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabRosContainer)).toHaveText(new RegExp(ROS));
      });

      test('Known Allergy appears in Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toHaveText(
          new RegExp(knownAllergyName, 'i')
        );
      });

      test('Medical Conditions appear in Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toHaveText(
          new RegExp(conditionName, 'i')
        );
        await expect(page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toHaveText(
          new RegExp(conditionIcdCode, 'i')
        );
      });
    });

    test.describe('Modify chart data', async () => {
      test('Should delete HPI provider notes and ROS', async () => {
        await page
          .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.hpi))
          .click();
        await expect(page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes)).toBeVisible();

        await page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes).locator('textarea').first().fill('');
        await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).click(); // Click empty space to blur the focused input
        await waitForChartDataDeletion(page);
        await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill('');
        await page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes).click();
        await waitForChartDataDeletion(page);
      });

      test('Should delete Surgical History', async () => {
        await test.step('Should delete Surgical History record', async () => {
          const knownAllergyListItem = page
            .getByTestId(dataTestIds.surgicalHistory.surgicalHistoryListItem)
            .filter({ hasText: new RegExp(surgery, 'i') })
            .first();
          await knownAllergyListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
          await waitForChartDataDeletion(page);
          await expect(knownAllergyListItem).not.toBeVisible();
        });

        await test.step('Should delete Surgical History provider note', async () => {
          await page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote)
            .locator('textarea')
            .first()
            .fill('');
          await waitForChartDataDeletion(page);
        });

        await test.step('Confirm Surgical History deletion in hpi tab', async () => {
          const column = page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn);
          await expect(column).toBeVisible();
          await expect(
            column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()
          ).not.toBeVisible({
            timeout: 30000,
          });

          await expect(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible();
        });
      });

      test('Should delete Known Allergy', async () => {
        await test.step('Delete known allergy', async () => {
          const knownAllergyListItem = page
            .getByTestId(dataTestIds.allergies.knownAllergiesListItem)
            .filter({ hasText: new RegExp(knownAllergyName, 'i') })
            .first();
          await knownAllergyListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
          await waitForChartDataDeletion(page);
          await expect(knownAllergyListItem).not.toBeVisible();
        });

        await test.step('Confirm deletion in hpi tab', async () => {
          const column = page.getByTestId(dataTestIds.allergies.knownAllergiesColumn);
          await expect(column).toBeVisible();
          await expect(
            column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()
          ).not.toBeVisible({
            timeout: 30000,
          });

          await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
        });
      });

      test('Should delete Current Medications data', async () => {
        await test.step('Should delete scheduled medication', async () => {
          const scheduledMedicationListItem = page
            .getByTestId(
              dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(
                dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled')
              )
            )
            .filter({ hasText: new RegExp(scheduledMedicationName, 'i') })
            .first();

          await scheduledMedicationListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
          await waitForChartDataDeletion(page);
          await expect(scheduledMedicationListItem).not.toBeVisible();
        });

        await test.step('Should delete as needed medication', async () => {
          const asNeededMedicationListItem = page
            .getByTestId(
              dataTestIds.telemedEhrFlow.hpiCurrentMedicationsListItem(
                dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed')
              )
            )
            .filter({ hasText: new RegExp(asNeededMedicationName, 'i') })
            .first();

          await asNeededMedicationListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
          await waitForChartDataDeletion(page);
          await expect(asNeededMedicationListItem).not.toBeVisible();
        });
      });

      test('Should delete Medical Conditions data', async () => {
        await test.step('Delete medical condition', async () => {
          const medicalConditionListItem = page
            .getByTestId(dataTestIds.medicalConditions.medicalConditionListItem)
            .filter({ hasText: new RegExp(conditionName, 'i') })
            .first();
          await medicalConditionListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
          await waitForChartDataDeletion(page);
          // Check that there are no more medical condition items with this text
          await expect(
            page
              .getByTestId(dataTestIds.medicalConditions.medicalConditionListItem)
              .filter({ hasText: new RegExp(conditionName, 'i') })
          ).toHaveCount(0);
        });

        await test.step('Confirm deletion in hpi tab', async () => {
          const column = page.getByTestId(dataTestIds.medicalConditions.medicalConditionColumn);
          await expect(column).toBeVisible();
          await expect(
            column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()
          ).not.toBeVisible({
            timeout: 30000,
          });

          await expect(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible();
        });
      });

      test('Should update Additional Questions answers', async () => {
        // here we are setting all answers to "Yes"
        for (const question of ADDITIONAL_QUESTIONS) {
          const questionRadioLocator = page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
            .locator('input[value=true]');
          await questionRadioLocator.click();
          await expect(questionRadioLocator).toBeEnabled();
        }
      });
    });

    test.describe('Modifications reflected on progress note page', async () => {
      test('HPI provider notes and ROS removed from "Review&Sign" tab', async () => {
        await page
          .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign))
          .click();
        await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

        await expect(page.getByTestId(dataTestIds.progressNotePage.hpiContainer)).not.toHaveText(
          new RegExp(providerNote)
        );

        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabRosContainer)).not.toBeVisible();
      });

      test('Surgical History record removed from Review&Sign tab', async () => {
        await test.step('Surgical History record removed', async () => {
          await page
            .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign))
            .click();
          await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

          await expect(page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toBeVisible({
            timeout: 30000,
          });
          await expect(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible();
        });
        await test.step('Provider note removed', async () => {
          await expect(page.getByTestId(dataTestIds.progressNotePage.surgicalHistoryContainer)).toBeVisible({
            timeout: 30000,
          });
          await expect(page.getByText(new RegExp(providerNote, 'i'))).not.toBeVisible();
        });
      });

      test('Known Allergies removed from Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

        await expect(page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toBeVisible({
          timeout: 30000,
        });
        await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
      });

      test('Current Medications are removed from Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
        await expect(page.getByText(RegExp(scheduledMedicationName, 'i'))).not.toBeVisible();

        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
        await expect(page.getByText(RegExp(asNeededMedicationName, 'i'))).not.toBeVisible();
      });

      test('Medical Conditions removed from Review&Sign tab', async () => {
        await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

        await expect(page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toBeVisible();
        await expect(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible();
      });

      test('Additional Questions answers updated on Review&Sign tab', async () => {
        for (const question of ADDITIONAL_QUESTIONS) {
          await expect(
            page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(question.field))
          ).toHaveText(new RegExp('Yes'));
        }
      });
    });
  });
});

test.describe('Telemed appointment with two locations (physical and virtual)', () => {
  const PROCESS_ID = `telemedEhrFlow.spec.ts-2-locs-no-appointment-state-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let telemedTrackingBoard: TelemedTrackingBoardPage;
  let location: Location;
  test.beforeAll(async () => {
    location = await createAppointmentWithVirtualAndPhysicalLocations(resourceHandler);
  });
  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });
  test('Appointment is present in tracking board and searchable by location filter', async ({ page }) => {
    await page.goto(`telemed/appointments`);
    telemedTrackingBoard = await expectTelemedTrackingBoard(page);
    await telemedTrackingBoard.awaitAppointmentsTableToBeLoaded();
    await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardLocationsSelect).locator('input').click();
    await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardLocationsSelectOption(location.id!)).click();

    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    ).toBeVisible(DEFAULT_TIMEOUT);
  });
});

async function createAppointmentWithVirtualAndPhysicalLocations(resourceHandler: ResourceHandler): Promise<Location> {
  const oystehr = await ResourceHandler.getOystehr();
  const [physicalLocation] = await Promise.all([
    new Promise<Location>((resolve, reject) => {
      oystehr.fhir
        .search({
          resourceType: 'Location',
          params: [
            {
              name: '_count',
              value: '1000',
            },
          ],
        })
        .then((locations) => {
          const nonVirtualLocation = locations
            .unbundle()
            .filter((location) => location.resourceType === 'Location')
            .find((location) => !isLocationVirtual(location as Location));
          if (!nonVirtualLocation) {
            throw new Error('No non-virtual location found');
          }
          resolve(nonVirtualLocation as Location);
        })
        .catch((error) => {
          reject(error);
        });
    }),
    await resourceHandler.setResources({ skipPaperwork: true }),
  ]);

  await oystehr.fhir.patch({
    resourceType: 'Appointment',
    id: resourceHandler.appointment.id!,
    operations: [
      {
        op: 'add',
        path: '/participant/-',
        value: <AppointmentParticipant>{
          actor: {
            reference: `Location/${physicalLocation.id}`,
          },
          status: 'accepted',
        },
      },
    ],
  });
  return physicalLocation;
}

// async function checkDropdownNoOptions(
//   page: Page,
//   dropdownTestId: string,
//   searchOption: string,
//   message: string
// ): Promise<void> {
//   const input = page.getByTestId(dropdownTestId).locator('input');
//   await input.click();
//   await page.waitForTimeout(10000); // todo something async causes flakiness here
//   await input.fill(searchOption);
//   const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
//   await dropdownNoOptions.waitFor();
//   await expect(dropdownNoOptions).toHaveText(message);
// }

function formatDateForMedications(dateStr: string): string {
  const date = DateTime.fromFormat(dateStr, 'MM/dd/yyyy');
  return `${date.toFormat(DATE_FORMAT)}`;
}
