import { expect, test } from '@playwright/test';
import { MDM_FIELD_DEFAULT_TEXT, TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import {
  waitForChartDataDeletion,
  waitForGetChartDataResponse,
  waitForPractitionerResponse,
  waitForSaveChartDataResponse,
} from 'test-utils/lib/e2e/response-utils';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { expectTelemedProgressNotePage } from '../../page/telemed/TelemedProgressNotePage';

const resourceHandler = new ResourceHandler('telemed');

const DEFAULT_TIMEOUT = { timeout: 15000 };

const DIAGNOSIS_CODE = 'J45.901';
const DIAGNOSIS_NAME = 'injury';
const E_M_CODE = '99201';

test.describe.configure({ mode: 'serial' });

test.beforeAll(async () => {
  await resourceHandler.setResources();
});

test.afterAll(async () => {
  await resourceHandler.cleanupResources();
});

test.beforeEach(async ({ page }) => {
  await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
  await waitForPractitionerResponse(page, (json) => json.resourceType === 'Practitioner');
  await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page);
  await page
    .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.assessment))
    .click();
});

test('Check assessment page initial state', async ({ page }) => {
  await page
    .getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.assessment))
    .click();

  const diagnosisAutocomplete = page.getByTestId(dataTestIds.telemedEhrFlow.diagnosisAutocomplete);
  await expect(diagnosisAutocomplete).toBeVisible(DEFAULT_TIMEOUT);
  await expect(page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis)).not.toBeVisible();
  await expect(page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible();
  await expect(
    page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField).locator('textarea:visible')
  ).toHaveText(MDM_FIELD_DEFAULT_TEXT);
});

test('Remove MDM and check missing required fields on review and sign page', async ({ page }) => {
  const mdmField = page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField);
  expect(await mdmField.locator('textarea:visible')).toBeVisible(DEFAULT_TIMEOUT);

  await waitForGetChartDataResponse(page, (json) => json.medicalDecision?.text === MDM_FIELD_DEFAULT_TEXT);

  await page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField).locator('textarea:visible').fill('');
  await waitForChartDataDeletion(page);

  await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
  const progressNotePage = await expectTelemedProgressNotePage(page);
  await progressNotePage.verifyReviewAndSignButtonDisabled();
  await expect(page.getByTestId(dataTestIds.progressNotePage.missingCard)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.progressNotePage.emCodeLink)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.progressNotePage.medicalDecisionLink)).toBeVisible();
  await page.getByTestId(dataTestIds.progressNotePage.primaryDiagnosisLink).click();
  await expect(page.getByTestId(dataTestIds.assessmentPage.diagnosisDropdown)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.assessmentPage.emCodeDropdown)).toBeVisible();
  await expect(page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField)).toBeVisible();
});

test('Search and select diagnoses', async ({ page }) => {
  const diagnosisAutocomplete = page.getByTestId(dataTestIds.telemedEhrFlow.diagnosisAutocomplete);

  // Test ICD 10 code search
  await test.step('Search for ICD 10 code', async () => {
    await diagnosisAutocomplete.click();
    await diagnosisAutocomplete.locator('input').fill(DIAGNOSIS_CODE);
    await page
      .getByRole('option', { name: new RegExp(DIAGNOSIS_CODE, 'i') })
      .first()
      .waitFor();
    await page
      .getByRole('option', { name: new RegExp(DIAGNOSIS_CODE, 'i') })
      .first()
      .click();
    await waitForSaveChartDataResponse(
      page,
      (json) =>
        !!json.chartData.diagnosis?.some((x) => x.code.toLocaleLowerCase().includes(DIAGNOSIS_CODE.toLocaleLowerCase()))
    );
  });

  let primaryDiagnosisValue;
  let primaryDiagnosis;
  await test.step('Verify primary diagnosis is visible', async () => {
    primaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
    await expect(primaryDiagnosis).toBeVisible();

    primaryDiagnosisValue = await primaryDiagnosis.textContent();
    expect(primaryDiagnosisValue).toContain(DIAGNOSIS_CODE);
  });

  // Test diagnosis name search
  await test.step('Search for diagnosis name', async () => {
    await diagnosisAutocomplete.click();
    await diagnosisAutocomplete.locator('input').fill(DIAGNOSIS_NAME);
    await page
      .getByRole('option', { name: new RegExp(DIAGNOSIS_NAME, 'i') })
      .first()
      .waitFor();
    await page
      .getByRole('option', { name: new RegExp(DIAGNOSIS_NAME, 'i') })
      .first()
      .click();
    await waitForSaveChartDataResponse(
      page,
      (json) =>
        !!json.chartData.diagnosis?.some((x) =>
          x.display.toLocaleLowerCase().includes(DIAGNOSIS_NAME.toLocaleLowerCase())
        )
    );
  });

  let secondaryDiagnosis;
  let secondaryDiagnosisValue;
  await test.step('Verify secondary diagnosis is visible', async () => {
    secondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
    await expect(secondaryDiagnosis).toBeVisible();

    secondaryDiagnosisValue = await secondaryDiagnosis.textContent();
    expect(secondaryDiagnosisValue?.toLocaleLowerCase()).toContain(DIAGNOSIS_NAME.toLocaleLowerCase());
  });

  // Verify diagnoses on Review and Sign page
  await test.step('Verify diagnoses on Review and Sign page', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expectTelemedProgressNotePage(page);

    // Verify both diagnoses are present
    await expect(page.getByText(primaryDiagnosisValue!, { exact: false })).toBeVisible();
    await expect(page.getByText(secondaryDiagnosisValue!, { exact: false })).toBeVisible();
  });
});

test('Change primary diagnosis', async ({ page }) => {
  // Get initial values
  const initialPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
  const initialSecondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
  const initialPrimaryValue = await initialPrimaryDiagnosis.textContent();
  const initialSecondaryValue = await initialSecondaryDiagnosis.textContent();

  // Make secondary diagnosis primary
  await test.step('Make secondary diagnosis primary', async () => {
    await page.getByTestId(dataTestIds.diagnosisContainer.makePrimaryButton).click();
    await waitForSaveChartDataResponse(page);

    // After the primary diagnosis is updated, the secondary diagnosis should be updated, they should be swapped
    const newPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
    const newSecondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
    await expect(newPrimaryDiagnosis).toHaveText(initialSecondaryValue!, { ignoreCase: true });
    await expect(newSecondaryDiagnosis).toHaveText(initialPrimaryValue!, { ignoreCase: true });
  });

  // Verify on Review and Sign page
  await test.step('Verify swapped diagnoses on Review and Sign page', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expectTelemedProgressNotePage(page);

    // Verify both diagnoses are present
    await expect(page.getByText(initialSecondaryValue!, { exact: false })).toBeVisible();
    await expect(page.getByText(initialPrimaryValue!, { exact: false })).toBeVisible();
  });
});

test('Delete primary diagnosis', async ({ page }) => {
  const primaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
  const primaryDiagnosisValue = await primaryDiagnosis.textContent();

  // Get secondary diagnosis value before deletion
  const secondaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);
  const secondaryDiagnosisValue = await secondaryDiagnosis.textContent();

  // Delete primary diagnosis
  await test.step('Delete primary diagnosis', async () => {
    await page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosisDeleteButton).first().click();
    await waitForChartDataDeletion(page);
    await waitForSaveChartDataResponse(page);

    // Verify secondary diagnosis is promoted to primary
    await expect(page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis)).not.toBeVisible();

    const newPrimaryDiagnosis = page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);
    const newPrimaryValue = await newPrimaryDiagnosis.textContent();
    expect(newPrimaryValue?.toLocaleLowerCase()).toEqual(secondaryDiagnosisValue?.toLocaleLowerCase());
  });

  // TODO: Fix test to verify deleted diagnosis is not present and current primary diagnosis is present
  // because it's not behaving same way in local browser and in e2e test (in e2e test it's not rerequesting chart data on
  // Review and Sign page)

  // Verify on Review and Sign page
  /* await test.step('Verify promoted diagnosis on Review and Sign page, deleted diagnosis is not present', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expectTelemedProgressNotePage(page);
    await waitForGetChartDataResponse(page, (json) => json.diagnosis?.length === 1);

    // Verify only one diagnosis is present
    await expect(page.getByText(secondaryDiagnosisValue!, { exact: false })).toBeVisible();
    await expect(page.getByText(primaryDiagnosisValue!, { exact: false })).not.toBeVisible(DEFAULT_TIMEOUT);
  }); */
});

test('Medical Decision Making functionality', async ({ page }) => {
  const mdmField = page.getByTestId(dataTestIds.assessmentPage.medicalDecisionField);

  // Check default text
  await expect(mdmField.locator('textarea:visible')).toHaveText(MDM_FIELD_DEFAULT_TEXT);

  // Edit the text
  const newText = 'Updated medical decision making text';
  await mdmField.locator('textarea:visible').fill(newText);

  // Verify text is updated
  await expect(mdmField.locator('textarea:visible')).toHaveText(newText);

  // Navigate to Review and Sign to verify text is displayed
  await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
  await expectTelemedProgressNotePage(page);
  await expect(page.getByText(newText)).toBeVisible();
});

test('Add E&M code', async ({ page }) => {
  const emCodeDropdown = page.getByTestId(dataTestIds.assessmentPage.emCodeDropdown);

  // Select E&M code
  await test.step('Select E&M code', async () => {
    await emCodeDropdown.click();
    await emCodeDropdown.locator('input').fill(E_M_CODE);
    await page.getByRole('option').first().waitFor();
    await page.getByRole('option').first().click();
    await waitForSaveChartDataResponse(page, (json) => json.chartData.emCode?.code === E_M_CODE);
  });

  // Verify E&M code is added
  // TODO: fix review&sign page to verify E&M code is added after clicking on this tab (in tests)
  // it doesn't work stable
  // for now will add next step page refresh to verify
  /* await test.step('Verify E&M code is added', async () => {
    const value = await emCodeDropdown.locator('input').inputValue();

    // Navigate to Review and Sign to verify code is displayed
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expectTelemedProgressNotePage(page);
    await expect(page.getByText(value)).toBeVisible();
  }); */

  await test.step('Verify E&M code is added', async () => {
    await page.reload();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expectTelemedProgressNotePage(page);
    await expect(page.getByText(E_M_CODE)).toBeVisible();
  });
});
