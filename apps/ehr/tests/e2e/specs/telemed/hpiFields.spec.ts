import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { waitForChartDataDeletion, waitForSaveChartDataResponse } from 'test-utils';
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
  TelemedAppointmentVisitTabs,
} from 'utils';
import { ADDITIONAL_QUESTIONS } from '../../../../src/constants';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { checkDropdownHasOptionAndSelectIt, getDropdownOption } from '../../../e2e-utils/helpers/tests-utils';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

async function checkDropdownNoOptions(
  page: Page,
  dropdownTestId: string,
  searchOption: string,
  message: string
): Promise<void> {
  const input = page.getByTestId(dropdownTestId).locator('input');
  await input.click();
  await page.waitForTimeout(10000); // todo something async causes flakiness here
  await input.fill(searchOption);
  const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
  await dropdownNoOptions.waitFor();
  await expect(dropdownNoOptions).toHaveText(message);
}

test.describe('Check all hpi fields common functionality, without changing data', () => {
  const PROCESS_ID = `hpiFields.spec.ts-common-func-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  const startTypingMessage = 'Start typing to load results';
  const searchOptionThatNotInList = 'undefined';
  const noOptionsMessage = 'Nothing found for this search criteria';

  test.beforeAll(async () => {
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.telemedNewOrExistingPatient)).toBeVisible();
  });

  test('Medical conditions. Should display message before typing in field', async ({ page }) => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).locator('input').click();
    await expect(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage);
  });

  test('Medical conditions. Should check not-in-list item search try', async ({ page }) => {
    await checkDropdownNoOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      searchOptionThatNotInList,
      noOptionsMessage
    );
  });

  test('Current medications. Should display message before typing in field', async ({ page }) => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput).locator('input').click();
    await expect(page.locator('.MuiAutocomplete-noOptions')).toHaveText(startTypingMessage);
  });

  test('Current medications. Should check not-in-list item search try', async ({ page }) => {
    await checkDropdownNoOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput,
      searchOptionThatNotInList,
      noOptionsMessage
    );
  });

  test('Known allergies. Should display message before typing in field', async ({ page }) => {
    await checkDropdownNoOptions(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, '', startTypingMessage);
  });

  test('Known allergies. Should check not-in-list item search try', async ({ page }) => {
    const input = page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput).locator('input');
    await input.click();
    await page.waitForTimeout(10000); // todo something async causes flakiness here
    await input.fill(noOptionsMessage);
    const option = await getDropdownOption(page, 'Other');
    await expect(option).toBeVisible();
  });

  test('Surgical history. Should check not-in-list item search try', async ({ page }) => {
    await checkDropdownNoOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput,
      searchOptionThatNotInList,
      noOptionsMessage
    );
  });
});

test.describe('Medical conditions', async () => {
  const PROCESS_ID = `hpiFields.spec.ts-medical-conditions-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;
  const conditionName = 'anemia';
  const conditionIcdCode = 'D60';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should search medical condition, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, conditionName);
  });

  test('Should search medical condition by ICD10 code, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      conditionIcdCode
    );
  });

  test('Reload and check medical conditions are saved in HPI tab', async () => {
    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();
    });

    await test.step('check medical condition saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(conditionName, 'i')
      );
    });

    await test.step('check medical condition searched by ICD10 code saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(conditionIcdCode, 'i')
      );
    });
  });

  test('Should check medical conditions appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(conditionName, 'i')
    );
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(conditionIcdCode, 'i')
    );
  });

  test('Should delete medical condition', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();

    const medicalConditionListItem = page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionListItem)
      .filter({ hasText: new RegExp(conditionName, 'i') })
      .first();
    await medicalConditionListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await waitForChartDataDeletion(page);
    await expect(medicalConditionListItem).not.toBeVisible();
  });

  test('Should confirm medical condition deleted, in HPI and in Review&Sign tabs', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      const column = page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn);
      await expect(column).toBeVisible();
      await expect(column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
        timeout: 30000,
      });

      await expect(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toBeVisible();
      await expect(page.getByText(new RegExp(conditionName, 'i'))).not.toBeVisible();
    });
  });
});

// TODO: uncomment when erx is enabled
test.describe.skip('Current medications', () => {
  const PROCESS_ID = `hpiFields.spec.ts-current-meds-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;
  const scheduledMedicationName = 'aspirin';
  const scheduledMedicationDose = '100';
  const scheduledMedicationDate = '01/01/2025';
  const scheduledMedicationTime = '10:00 AM';
  const asNeededMedicationName = 'ibuprofen';
  const asNeededMedicationDose = '200';
  const asNeededMedicationDate = '01/01/2025';
  const asNeededMedicationTime = '10:00 AM';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);
    }

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should create scheduled medication', async () => {
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

  test('Should check scheduled medication is saved in HPI tab', async () => {
    const scheduledMedicationList = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsScheduledList);
    await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationName, 'i'));
    await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationDose, 'i'));
    await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationDate, 'i'));
    await expect(scheduledMedicationList).toHaveText(RegExp(scheduledMedicationTime, 'i'));
  });

  test('Should create as needed medication', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededRadioButton).click();
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
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
  });

  test('Should check as needed medication is saved in HPI tab', async () => {
    const asNeededMedicationList = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAsNeededList);
    await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationName, 'i'));
    await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationDose, 'i'));
    await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationDate, 'i'));
    await expect(asNeededMedicationList).toHaveText(RegExp(asNeededMedicationTime, 'i'));
  });

  test('Should test required fields validation works', async () => {
    const medicationInput = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsInput);
    await expect(medicationInput.locator('label')).toHaveClass(/Mui-required/);
    await expect(medicationInput.locator('input[required]:invalid')).toBeVisible();
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
  });

  test('Should check medications appear on Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
    await expect(page.getByText(RegExp(scheduledMedicationName, 'i'))).toBeVisible();
    await expect(page.getByText(RegExp(asNeededMedicationName, 'i'))).toBeVisible();
  });

  test('Should delete scheduled medication', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('scheduled'))).toBeVisible();

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

  test('Should delete as needed medication', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsList('as-needed'))).toBeVisible();

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

  test('Should confirm medications are deleted on Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
    await expect(page.getByText(RegExp(scheduledMedicationName, 'i'))).not.toBeVisible();

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicationsContainer)).toBeVisible();
    await expect(page.getByText(RegExp(asNeededMedicationName, 'i'))).not.toBeVisible();
  });
});

// TODO: uncomment when erx is enabled
test.describe.skip('Known allergies', () => {
  const PROCESS_ID = `hpiFields.spec.ts-known-allergies-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;
  const knownAllergyName = 'penicillin';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    if (process.env.INTEGRATION_TEST === 'true') {
      await resourceHandler.setResourcesFast();
    } else {
      await resourceHandler.setResources();
      await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);
    }

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should search known allergy, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyName);
  });

  test('Should check known allergies are saved in HPI tab', async () => {
    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();
    });

    await test.step('check known allergy saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
        RegExp(knownAllergyName, 'i')
      );
    });
  });

  test('Should check known allergy appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).toHaveText(
      new RegExp(knownAllergyName, 'i')
    );
  });

  test('Should delete known allergy', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toBeVisible();

    const knownAllergyListItem = page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesListItem)
      .filter({ hasText: new RegExp(knownAllergyName, 'i') })
      .first();
    await knownAllergyListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await waitForChartDataDeletion(page);
    await expect(knownAllergyListItem).not.toBeVisible();
  });

  test('Should confirm known allergy deleted', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      const column = page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn);
      await expect(column).toBeVisible();
      await expect(column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
        timeout: 30000,
      });

      await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
    });
  });
});

test.describe('Surgical history', () => {
  const PROCESS_ID = `hpiFields.spec.ts-surg-history-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;
  const surgery = 'feeding';
  const providerNote = 'lorem ipsum';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should add provider notes', async () => {
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

  test('Should search surgery and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiSurgicalHistoryInput, surgery);
  });

  test('Should check surgical history are saved in HPI tab', async () => {
    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible();
    });

    await test.step('Should check surgical history saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toHaveText(
        RegExp(surgery, 'i')
      );
    });
  });

  test('Should check provider note saved in HPI tab', async () => {
    await expect(
      page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first()
    ).toHaveText(providerNote);
  });

  test('Should check surgical history appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toHaveText(
      new RegExp(surgery, 'i')
    );
  });

  test('Should check provider note saved in Review&Sign tab', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toHaveText(
      new RegExp(providerNote, 'i')
    );
  });

  test('Should delete provider note', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryList)).toBeVisible();

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryNote).locator('textarea').first().fill('');
    await waitForChartDataDeletion(page);
  });

  test('Should delete surgery record', async () => {
    const knownAllergyListItem = page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryListItem)
      .filter({ hasText: new RegExp(surgery, 'i') })
      .first();
    await knownAllergyListItem.getByTestId(dataTestIds.deleteOutlinedIcon).click();
    await waitForChartDataDeletion(page);
    await expect(knownAllergyListItem).not.toBeVisible();
  });

  test('Should check surgical history record deleted from HPI and Review&Sign tab', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      const column = page.getByTestId(dataTestIds.telemedEhrFlow.hpiSurgicalHistoryColumn);
      await expect(column).toBeVisible();
      await expect(column.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible({
        timeout: 30000,
      });

      await expect(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toBeVisible({
        timeout: 30000,
      });
      await expect(page.getByText(new RegExp(surgery, 'i'))).not.toBeVisible();
    });
  });

  test('Should check provider note deleted on Review&Sign tab', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabSurgicalHistoryContainer)).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(new RegExp(providerNote, 'i'))).not.toBeVisible();
  });
});

test.describe('Additional questions', () => {
  const PROCESS_ID = `hpiFields.spec.ts-additional-Qs-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment!.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should check the list of questions is the same for patient and provider', async () => {
    for (const question of ADDITIONAL_QUESTIONS) {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))).toHaveText(
        new RegExp(question.label)
      );
      await expect(
        page.getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
      ).toHaveText(new RegExp(question.label));
    }
  });

  test('Should check provider has the same answers as Patient provided. Patient answered', async () => {
    const answers = getAdditionalQuestionsAnswers().item;
    for (const question of ADDITIONAL_QUESTIONS) {
      const answer = answers?.find((item) => item.linkId === question.field)?.answer?.[0]?.valueString ?? '';
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field))
          .getByText(answer)
      ).toBeVisible();
    }
  });
});

test.describe("Additional questions. Check cases where patient didn't answered on additional questions", async () => {
  const PROCESS_ID = `hpiFields.spec.ts-no-additional-Qs-${DateTime.now().toMillis()}`;
  const resourceHandlerWithoutAdditionalAnswers = new ResourceHandler(
    PROCESS_ID,
    'telemed',
    async ({ patientInfo }) => {
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
        getPaymentOptionSelfPayAnswers(),
        getResponsiblePartyStepAnswers({}),
        getSchoolWorkNoteStepAnswers(),
        getConsentStepAnswers({}),
        getInviteParticipantStepAnswers(),
      ];
    }
  );

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandlerWithoutAdditionalAnswers.setResources();

    await page.goto(`telemed/appointments/${resourceHandlerWithoutAdditionalAnswers.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandlerWithoutAdditionalAnswers.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test("Should check provider doesn't have selected by default option. Patient didn't answer", async () => {
    for (const question of ADDITIONAL_QUESTIONS) {
      const patientAnswer = page.getByTestId(
        dataTestIds.telemedEhrFlow.hpiAdditionalQuestionsPatientProvided(question.field)
      );
      await expect(patientAnswer).toBeVisible();
      await expect(patientAnswer).toHaveText(question.label); // here we're checking strictly for question text without answer
    }
  });

  test('Update answers', async () => {
    // here we are setting all answers to "Yes"
    for (const question of ADDITIONAL_QUESTIONS) {
      const questionRadioLocator = page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiAdditionalQuestions(question.field))
        .locator('input[value=true]');
      await questionRadioLocator.click();
      await expect(questionRadioLocator).toBeEnabled();
    }
  });

  test('Updated answers appears correctly on Review&Sign tab', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible();
    await page.reload();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

    for (const question of ADDITIONAL_QUESTIONS) {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabAdditionalQuestion(question.field))).toHaveText(
        new RegExp('Yes')
      );
    }
  });
});

test.describe('Chief complaint', () => {
  const PROCESS_ID = `hpiFields.spec.ts-chief-complaint-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;
  const providerNote = 'Lorem ipsum';
  const ROS = 'ROS Lorem ipsum';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should add HPI provider notes and ROS', async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)
      .locator('textarea')
      .first()
      .fill(providerNote);
    await waitForSaveChartDataResponse(page);
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill(ROS);
    await waitForSaveChartDataResponse(page);
  });

  test('Should check HPI provider notes and ROS are saved on Review&Sign page', async () => {
    await page.reload();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer)).toHaveText(
      new RegExp(providerNote)
    );
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabRosContainer)).toHaveText(new RegExp(ROS));
  });

  test('Should remove HPI provider notes and ROS', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes)).toBeVisible();

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).locator('textarea').first().fill('');
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).click(); // Click empty space to blur the focused input
    await waitForChartDataDeletion(page);
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintRos).locator('textarea').first().fill('');
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiChiefComplaintNotes).click();
    await waitForChartDataDeletion(page);
  });

  test('Should check HPI provider notes and ROS are removed from "Review and sign\' tab', async () => {
    await page.reload();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabChiefComplaintContainer)).not.toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabRosContainer)).not.toBeVisible();
  });
});
