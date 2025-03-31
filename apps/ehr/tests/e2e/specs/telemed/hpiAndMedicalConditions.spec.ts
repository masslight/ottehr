/* eslint-disable prettier/prettier */
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { expect, Page, test } from '@playwright/test';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { fillWaitAndSelectDropdown } from 'test-utils';
import { TelemedAppointmentVisitTabs } from 'utils';

async function checkDropdownHasPatternInFirstThreeOptions(
  page: Page,
  dropdownTestId: string,
  pattern: string
): Promise<void> {
  await page.getByTestId(dropdownTestId).locator('input').fill(pattern);
  const dropdownOptions = page.locator('.MuiAutocomplete-popper li');
  await dropdownOptions.first().waitFor();
  const optionsAsStrings = await dropdownOptions.allTextContents();
  const getFirstThreeOptions = optionsAsStrings.slice(0, 3);
  for (const str of getFirstThreeOptions) {
    expect(str.toLowerCase()).toMatch(new RegExp(pattern.toLowerCase()));
  }
}

test.describe('Medical conditions', async () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const medicalConditionPattern = 'anemia';
  const medicalConditionIcdPattern = 'D60';
  const searcPatternNeverExists = 'undefined';

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
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, true);
    });

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput).locator('input').click();
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText('Start typing to load results');
  });

  test('Should check options has search pattern', async () => {
    await checkDropdownHasPatternInFirstThreeOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      medicalConditionPattern
    );
  });

  test('Should search and select regular medication condition', async () => {
    await fillWaitAndSelectDropdown(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      medicalConditionPattern
    );
  });

  test('Should check options has search ICD10 pattern', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await checkDropdownHasPatternInFirstThreeOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      medicalConditionIcdPattern
    );
  });

  test('Should search and select ICD10 medication condition', async () => {
    await fillWaitAndSelectDropdown(
      page,
      dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput,
      medicalConditionIcdPattern
    );
  });

  test('Should check not-in-list item search try', async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsInput)
      .locator('input')
      .fill(searcPatternNeverExists);
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText('Nothing found for this search criteria');
  });

  test('Reload and check medical conditions are saved', async () => {
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

    await test.step('check regular medical condition saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(medicalConditionPattern, 'i')
      );
    });

    await test.step('check ICD10 medical condition saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionsList)).toHaveText(
        RegExp(medicalConditionIcdPattern, 'i')
      );
    });
  });

  test('Should check conditions appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(medicalConditionPattern, 'i')
    );
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toHaveText(
      new RegExp(medicalConditionIcdPattern, 'i')
    );
  });

  test('Should delete condition', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
        .first()
    ).not.toBeVisible();
    const parentDiv = page.getByText(new RegExp(medicalConditionPattern, 'i')).locator('..');
    await parentDiv.getByTestId(dataTestIds.muiDeleteOutlinedIcon).click();
    await expect(parentDiv).not.toBeVisible();
    await page.waitForTimeout(7000);
  });

  test('Should confirm condition deleted on Review&Sign tab', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
          .first()
      ).not.toBeVisible();

      await expect(page.getByText(new RegExp(medicalConditionPattern, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabMedicalConditionsContainer)).toBeVisible();
      await expect(page.getByText(new RegExp(medicalConditionPattern, 'i'))).not.toBeVisible();
    });
  });
});

test.describe('Known allergies', () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const knownAllergyPattern = 'penicillin';
  const searcPatternNeverExists = 'undefined';
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
      await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, true);
    });

    await page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput).locator('input').click();
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText(noOptionsMessage);
  });

  test('Should check options has search pattern', async () => {
    await checkDropdownHasPatternInFirstThreeOptions(
      page,
      dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput,
      knownAllergyPattern
    );
  });

  test('Should search and select known allergy', async () => {
    await fillWaitAndSelectDropdown(page, dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput, knownAllergyPattern);
  });

  test.skip('Should check not-in-list item search try', async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesInput)
      .locator('input')
      .fill(searcPatternNeverExists);
    const dropdownNoOptions = page.locator('.MuiAutocomplete-noOptions');
    await expect(dropdownNoOptions).toHaveText(noOptionsMessage);
  });

  test('Reload and check known allergies are saved', async () => {
    await test.step('reload and wait until data is loaded', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
          .first()
      ).not.toBeVisible();
    });

    await test.step('check regular known allergy saved', async () => {
      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesList)).toHaveText(
        RegExp(knownAllergyPattern, 'i')
      );
    });
  });

  test('Should check known allergy appear in Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).toHaveText(
      new RegExp(knownAllergyPattern, 'i')
    );
  });

  test('Should delete known allergy', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await expect(
      page
        .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)
        .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
        .first()
    ).not.toBeVisible();
    const parentDiv = page
      .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)
      .getByText(new RegExp(knownAllergyPattern, 'i'))
      .locator('..');
    await parentDiv.getByTestId(dataTestIds.muiDeleteOutlinedIcon).click();
    await expect(parentDiv).not.toBeVisible({ timeout: 15000 });
  });

  test('Should confirm known allergy deleted on Review&Sign tab', async () => {
    await test.step('Confirm deletion in hpi tab', async () => {
      await page.reload();
      await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
      await expect(
        page
          .getByTestId(dataTestIds.telemedEhrFlow.hpiKnownAllergiesColumn)
          .getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton)
          .first()
      ).not.toBeVisible();

      await expect(page.getByText(new RegExp(knownAllergyPattern, 'i'))).not.toBeVisible();
    });

    await test.step('Confirm deletion in Review&Sign tab', async () => {
      await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();

      await expect(page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabKnownAllergiesContainer)).not.toBeVisible();
      await expect(page.getByText(new RegExp(knownAllergyPattern, 'i'))).not.toBeVisible();
    });
  });
});
