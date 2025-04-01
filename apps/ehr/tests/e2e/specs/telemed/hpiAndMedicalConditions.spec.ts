/* eslint-disable prettier/prettier */
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { expect, Page, test } from '@playwright/test';
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

test.describe('Medical conditions', async () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const conditionName = 'anemia';
  const conditionIcdCode = 'D60';
  const searchOptionThatNotInList = 'undefined';
  const noOptionsMessage = 'Nothing found for this search criteria';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should display message before typing in field', async () => {
    await test.step("go to appointment page and make sure it's in pre-video", async () => {
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).locator('input').click();
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText('Start typing to load results');
  });

  test('Should check options has condition, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput, conditionName);
  });

  test('Should check options has search ICD10 pattern, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      conditionIcdCode
    );
  });

  test('Should check not-in-list item search try', async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)
      .locator('input')
      .fill(searchOptionThatNotInList);
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText(noOptionsMessage);
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

  test('Should check conditions appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(conditionName, 'i')
    );
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(conditionIcdCode, 'i')
    );
  });

  test('Should delete condition', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toBeVisible();

    const medicalConditionListItem = page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionListItem)
      .filter({ hasText: new RegExp(conditionName, 'i') })
      .first();
    await medicalConditionListItem.getByTestId(dataTestIds.muiDeleteOutlinedIcon).click();
    await expect(medicalConditionListItem).not.toBeVisible();
  });

  test('Should confirm condition deleted', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible();

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

test.describe('Known allergies', () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const knownAllergyName = 'penicillin';
  const searchOptionThatNotInList = 'undefined';
  const noOptionsMessage = 'Start typing to load results';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should display message before typing in field', async () => {
    await test.step("go to appointment page and make sure it's in pre-video", async () => {
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    });

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput).locator('input').click();
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText(noOptionsMessage);
  });

  test('Should check options has known allergy, and select it', async () => {
    await checkDropdownHasOptionAndSelectIt(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyName);
  });

  test.skip('Should check not-in-list item search try', async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput)
      .locator('input')
      .fill(searchOptionThatNotInList);
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText(noOptionsMessage);
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
    await knownAllergyListItem.getByTestId(dataTestIds.muiDeleteOutlinedIcon).click();
    await expect(knownAllergyListItem).not.toBeVisible();
  });

  test('Should confirm known allergy deleted', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)).toBeVisible();

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
