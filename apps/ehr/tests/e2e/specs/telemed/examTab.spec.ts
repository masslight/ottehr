import { expect, Locator, Page, test } from '@playwright/test';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import {
  ExamFieldsNames,
  ExamObservationFieldItem,
  ExamObservationFieldsDetails,
  examObservationFieldsDetailsArray,
  TelemedAppointmentVisitTabs,
} from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { waitForSaveChartDataResponse } from 'test-utils';

async function checkCheckboxValueInLocator(locator: Locator, value: boolean): Promise<void> {
  if (value) {
    await expect(locator.locator('input').first()).toBeChecked();
  } else {
    await expect(locator.locator('input').first()).not.toBeChecked();
  }
}

async function checkRadioButtonValueInLocator(locator: Locator, value: boolean): Promise<void> {
  if (value) {
    await expect(locator.locator('input[type="radio"][value="true"]')).toBeChecked();
    await expect(locator.locator('input[type="radio"][value="false"]')).not.toBeChecked();
  } else {
    await expect(locator.locator('input[type="radio"][value="true"]')).not.toBeChecked();
    await expect(locator.locator('input[type="radio"][value="false"]')).toBeChecked();
  }
}

async function checkValuesInCheckboxes(page: Page, examObservationFields: ExamObservationFieldItem[]): Promise<void> {
  for (const field of examObservationFields) {
    const fieldLocator = page.getByTestId(dataTestIds.telemedEhrFlow.examTabField(field.field as ExamFieldsNames));
    await checkCheckboxValueInLocator(fieldLocator, field.defaultValue);
  }
}

async function checkValuesInRadioButtons(page: Page, examObservationFields: ExamObservationFieldItem[]): Promise<void> {
  for (const field of examObservationFields) {
    const fieldLocator = page.getByTestId(dataTestIds.telemedEhrFlow.examTabField(field.field as ExamFieldsNames));
    await checkRadioButtonValueInLocator(fieldLocator, field.defaultValue);
  }
}

test.describe('Exam tab', async () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;
  const providerComment = 'Lorem ipsum';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiMedicalConditionColumn)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.hpiFieldListLoadingSkeleton).first()).not.toBeVisible();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();
    // todo unchecked some field to check it's working
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should check default selected checkboxes', async () => {
    await test.step("Check 'General' card", async () => {
      const filteredFields = examObservationFieldsDetailsArray.filter(
        (field) => field.card === 'general' && ['normal', 'abnormal'].includes(field.group)
      );
      await checkValuesInCheckboxes(page, filteredFields);
    });

    await test.step("Check 'Head' card", async () => {
      const filteredFields = examObservationFieldsDetailsArray.filter((field) => field.card === 'head');
      await checkValuesInCheckboxes(page, filteredFields);
    });

    await test.step("Check 'Eyes' card", async () => {
      const filteredFields = examObservationFieldsDetailsArray.filter((field) => field.card === 'eyes');
      await checkValuesInCheckboxes(
        page,
        filteredFields.filter((field) => ['normal', 'abnormal'].includes(field.group))
      );
      await checkValuesInRadioButtons(
        page,
        filteredFields.filter((field) => ['rightEye', 'leftEye'].includes(field.group))
      );
    });
  });

  test("Should select value from 'Normal' list and verify checkbox become green", async () => {
    const uncheckedField = ExamObservationFieldsDetails['playful-and-active'];

    const normalListCheckbox = page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabField(uncheckedField.field))
      .locator('input');
    await normalListCheckbox.click();
    await expect(normalListCheckbox).toBeEnabled();
    await checkCheckboxValueInLocator(normalListCheckbox, true);

    const checkboxSpan = normalListCheckbox.locator('span.MuiCheckbox-root.Mui-checked');

    const computedColor = await checkboxSpan.evaluate((el) => window.getComputedStyle(el).getPropertyValue('color'));

    expect(computedColor).toBe('#2E7D32');
  });

  test("Should select value from 'Abnormal' list and verify checkbox become red", async () => {
    const uncheckedField = ExamObservationFieldsDetails['tired-appearing'];

    const abnormalListCheckbox = page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabField(uncheckedField.field))
      .locator('input');
    await abnormalListCheckbox.click();
    await expect(abnormalListCheckbox).toBeEnabled();
    await checkCheckboxValueInLocator(abnormalListCheckbox, true);

    const checkboxSpan = abnormalListCheckbox.locator('span.MuiCheckbox-root.Mui-checked');

    const computedColor = await checkboxSpan.evaluate((el) => window.getComputedStyle(el).getPropertyValue('color'));

    expect(computedColor).toBe('#D32F2F');
  });

  test("Should enter some text in 'Provider' field", async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabCardsComments('general'))
      .locator('input')
      .fill(providerComment);
    await waitForSaveChartDataResponse(page);
  });

  test("Should check 'Distress' checkbox and select dropdown option", async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabField('distress-none')).locator('input').click();
    await waitForSaveChartDataResponse(page);
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabDistressDropdown).click();
  });
});
