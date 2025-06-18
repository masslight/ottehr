import Oystehr from '@oystehr/sdk';
import { BrowserContext, expect, Page, test } from '@playwright/test';
import { AppointmentParticipant, Location } from 'fhir/r4b';
import {
  fillWaitAndSelectDropdown,
  getPatientConditionPhotosStepAnswers,
  waitForSaveChartDataResponse,
} from 'test-utils';
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
  isLocationVirtual,
  isoToDateObject,
  TelemedAppointmentStatusEnum,
} from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../src/constants';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { awaitAppointmentsTableToBeVisible, telemedDialogConfirm } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { DateTime } from 'luxon';

const DEFAULT_TIMEOUT = { timeout: 15000 };

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

test.describe('Tests checking data without mutating state', () => {
  const myPatientsProcessId = `telemedEhrFlow.spec.ts-my-patients-non-mutating-${DateTime.now().toMillis()}`;
  const myPatientsTabAppointmentResources = new ResourceHandler(myPatientsProcessId, 'telemed');
  const otherPatientsProcessId = `telemedEhrFlow.spec.ts-other-patients-non-mutating-${DateTime.now().toMillis()}`;
  const otherPatientsTabAppointmentResources = new ResourceHandler(otherPatientsProcessId, 'telemed');
  let testsUserQualificationState: string;
  let randomState: string;

  test.beforeAll(async () => {
    const testsUserStates = await getTestUserQualificationStates(myPatientsTabAppointmentResources);
    testsUserQualificationState = testsUserStates[0];
    randomState = await getTestStateThatNotQualificationsStatesList(
      myPatientsTabAppointmentResources.apiClient,
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
  });

  test.afterAll(async () => {
    await Promise.all([
      myPatientsTabAppointmentResources.cleanupResources(),
      otherPatientsTabAppointmentResources.cleanupResources(),
    ]);
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
    const appointmentRow = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(appointmentId!));

    const locationGroup = await appointmentRow.getAttribute('data-location-group');

    expect(locationGroup?.toLowerCase()).toEqual(testsUserQualificationState.toLowerCase());
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
  const PROCESS_ID = `telemedEhrFlow.spec.ts-appointment-state-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(
    PROCESS_ID,
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
    await context.close();
    await page.close();
  });

  test('Appointment is present in tracking board, can be assigned and connection to patient is happening', async () => {
    await page.goto(`telemed/appointments`);
    await awaitAppointmentsTableToBeVisible(page);

    await test.step('Find and assign my appointment', async () => {
      const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

      const appointmentRow = table.locator('tbody tr').filter({ hasText: resourceHandler.appointment?.id });

      await expect(
        appointmentRow.filter({ has: page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton) })
      ).toBeVisible(DEFAULT_TIMEOUT);

      await appointmentRow.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardAssignButton).click(DEFAULT_TIMEOUT);
    });

    await telemedDialogConfirm(page);

    await test.step('Appointment has connect-to-patient button', async () => {
      const statusChip = page.getByTestId(dataTestIds.telemedEhrFlow.appointmentStatusChip);
      await expect(statusChip).toBeVisible(DEFAULT_TIMEOUT);
      await expect(statusChip).toHaveText(TelemedAppointmentStatusEnum['pre-video']);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible(
        DEFAULT_TIMEOUT
      );
    });
  });

  test('Buttons on visit page should appear, in assigned appointment', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.cancelThisVisitButton)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.inviteParticipant)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.editPatientButtonSideBar)).toBeVisible();
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

  test('Unassign appointment, and check in "Ready for provider"', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);

    await page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonUnassign).click();
    await telemedDialogConfirm(page);
    await awaitAppointmentsTableToBeVisible(page);
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
    ).toBeVisible();
  });

  test('Check message for patient', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardChatButton(resourceHandler.appointment.id!)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.chatModalDescription)).toBeVisible();

    const expectedSms =
      'Thank you for your patience. We apologize, but the provider is unexpectedly no longer available. You will receive an update when another provider is available';
    await expect(page.getByText(expectedSms).first()).toBeVisible({ timeout: 25000 });
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
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test('Patient provided hpi data', async () => {
    await test.step('Medical conditions provided by patient', async () => {
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionPatientProvidedList).getByText('Constipation')
      ).toBeVisible();
    });

    await test.step('Current medications provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsPatientProvidedList);
      await expect(list.getByText('Amoxicillin')).toBeVisible();
      // cSpell:disable-next Cetirizine
      await expect(list.getByText('Cetirizine/ Zyrtec')).toBeVisible();
    });

    await test.step('Known allergies provided by patient', async () => {
      const list = page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesPatientProvidedList);
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
  });

  test('Should test appointment hpi fields', async () => {
    const medicalConditionsPattern = 'Z3A';
    // cSpell:disable-next undecenal
    // const knownAllergyPattern = '10-undecenal';
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
          .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
          .first()
      ).not.toBeVisible();
    });

    await test.step('filling up all editable fields', async () => {
      await fillWaitAndSelectDropdown(
        page,
        dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
        medicalConditionsPattern
      );

      // TODO: uncomment when erx is enabled
      // await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyPattern);

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

      for (const question of ADDITIONAL_QUESTIONS) {
        await expect(
          page
            .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
            .locator('input[type="radio"][value="true"]')
        ).toBeEnabled();
      }

      const chiefComplaintResponsePromise = waitForSaveChartDataResponse(
        page,
        (json) => !!json.chartData.chiefComplaint?.resourceId
      );
      const rosResponsePromise = waitForSaveChartDataResponse(page, (json) => !!json.chartData.ros?.resourceId);

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

      await chiefComplaintResponsePromise;
      await rosResponsePromise;
    });

    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
          .first()
      ).not.toBeVisible();
    });

    await test.step('check medical conditions list', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(medicalConditionsPattern)
      );
    });

    // TODO: uncomment when erx is enabled
    // await test.step('check known allergies list', async () => {
    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
    //   await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
    //     RegExp(knownAllergyPattern)
    //   );
    // });

    await test.step('check surgical history list and note', async () => {
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

  test('Should test connect to patient is working', async () => {
    const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
    await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
    await connectButton.click(DEFAULT_TIMEOUT);

    await telemedDialogConfirm(page);

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
  });
});

test.describe('Telemed appointment with two locations (physical and virtual)', () => {
  test.describe('Tests not interacting with appointment state', () => {
    const PROCESS_ID = `telemedEhrFlow.spec.ts-2-locs-no-appointment-state-${DateTime.now().toMillis()}`;
    const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
    let location: Location;
    test.beforeAll(async () => {
      location = await createAppointmentWithVirtualAndPhysicalLocations(resourceHandler);
    });
    test.afterAll(async () => {
      await resourceHandler.cleanupResources();
    });
    test('Appointment is present in tracking board and searchable by location filter', async ({ page }) => {
      await page.goto(`telemed/appointments`);
      await awaitAppointmentsTableToBeVisible(page);
      await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardLocationsSelect).locator('input').click();
      await page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardLocationsSelectOption(location.id!)).click();

      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTableRow(resourceHandler.appointment.id!))
      ).toBeVisible(DEFAULT_TIMEOUT);
    });
  });

  test.describe('Tests interacting with appointment state', () => {
    const PROCESS_ID = `telemedEhrFlow.spec.ts-2-locs-appointment-state-${DateTime.now().toMillis()}`;
    const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
    test.beforeAll(async () => {
      await createAppointmentWithVirtualAndPhysicalLocations(resourceHandler);
    });

    test.afterEach(async () => {
      await resourceHandler.cleanupResources();
    });

    test('Appointment is present in tracking board, can be assigned and connection to patient is happening', async ({
      page,
    }) => {
      await page.goto(`telemed/appointments`);
      await awaitAppointmentsTableToBeVisible(page);

      await test.step('Find and assign my appointment', async () => {
        const table = page.getByTestId(dataTestIds.telemedEhrFlow.trackingBoardTable).locator('table');

        const appointmentRow = table.locator('tbody tr').filter({ hasText: resourceHandler.appointment?.id ?? '' });

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

      await test.step('Connect to patient', async () => {
        const connectButton = page.getByTestId(dataTestIds.telemedEhrFlow.footerButtonConnectToPatient);
        await expect(connectButton).toBeVisible(DEFAULT_TIMEOUT);
        await connectButton.click(DEFAULT_TIMEOUT);

        await telemedDialogConfirm(page);

        await expect(page.getByTestId(dataTestIds.telemedEhrFlow.videoRoomContainer)).toBeVisible(DEFAULT_TIMEOUT);
      });
    });
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
    await resourceHandler.setResources(),
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
