import { expect, Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { TelemedAppointmentVisitTabs } from 'utils';

async function checkDropdownHasOptionAndSelectIt(page: Page, dropdownTestId: string, pattern: string): Promise<void> {
  await page.getByTestId(dropdownTestId).locator('input').fill(pattern);

  const option = page
    .locator('.MuiAutocomplete-popper li')
    .filter({ hasText: new RegExp(pattern, 'i') })
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

async function checkDropdownNoOptions(
  page: Page,
  dropdownTestId: string,
  searchOption: string,
  message: string
): Promise<void> {
  const input = page.getByTestId(dropdownTestId).locator('input');
  await input.click();
  await input.fill(searchOption);
  const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
  await dropdownNoOptions.waitFor();
  await expect(dropdownNoOptions).toHaveText(message);
}

test.describe('Check all hpi fields common functionality, without changing data', () => {
  const resourceHandler = new ResourceHandler('telemed');
  const startTypingMessage = 'Start typing to load results';
  const searchOptionThatNotInList = 'undefined';
  const noOptionsMessage = 'Nothing found for this search criteria';

  test.beforeAll(async () => {
    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.beforeEach(async ({ page }) => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page);
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

  test.skip('Known allergies. Should check not-in-list item search try', async ({ page }) => {
    await checkDropdownNoOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput,
      searchOptionThatNotInList,
      noOptionsMessage
    );
  });
});

test.describe('Medical conditions', async () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const conditionName = 'anemia';
  const conditionIcdCode = 'D60';

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

  test('Reload and check medical conditions are saved', async () => {
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
    await expect(medicalConditionListItem).not.toBeVisible();
  });

  test('Should confirm medical condition deleted, in HPI and in Review&Sign tabs', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)).not.toBeVisible();

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

test.describe('Current medications', () => {
  const resourceHandler = new ResourceHandler('telemed');
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
    await resourceHandler.setResources();

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
    const dateLocator = await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateInput)
      .locator('input');
    await dateLocator.click();
    await dateLocator.pressSequentially(scheduledMedicationDate);
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsTimeInput)
      .locator('input')
      .fill(scheduledMedicationTime);
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
    const dateLocator = await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateInput)
      .locator('input');
    await dateLocator.click();
    await dateLocator.pressSequentially(asNeededMedicationDate);
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsTimeInput)
      .locator('input')
      .fill(asNeededMedicationTime);
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
    const doseInput = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDoseInput);
    await expect(doseInput.locator('label')).toHaveClass(/Mui-required/);
    await expect(doseInput.locator('input[required]:invalid')).toBeVisible();
    const dateInput = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsDateInput);
    await expect(dateInput.locator('label')).toHaveClass(/Mui-required/);
    await expect(dateInput.locator('input[required]:invalid')).toBeVisible();
    const timeInput = page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsTimeInput);
    await expect(timeInput.locator('label')).toHaveClass(/Mui-required/);
    await expect(timeInput.locator('input[required]:invalid')).toBeVisible();
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsTimeInput)
      .locator('input')
      .fill(scheduledMedicationTime);
    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiCurrentMedicationsAddButton)).toBeEnabled();
  });

  test('Should check medications are saved on Review&Sign tab', async () => {
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

test.describe('Known allergies', () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const knownAllergyName = 'penicillin';

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

  test('Should search known allergy, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyName);
  });

  test('Reload and check known allergies are saved', async () => {
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
    await expect(knownAllergyListItem).not.toBeVisible();
  });

  test('Should confirm known allergy deleted', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible();
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)).not.toBeVisible();

      await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
      await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).not.toBeVisible();
      await expect(page.getByText(new RegExp(knownAllergyName, 'i'))).not.toBeVisible();
    });
  });
});
