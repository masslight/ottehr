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

async function checkCheckboxValueInLocator(locator: Locator, value: boolean): Promise<void> {
  if (value) {
    await expect(locator.locator('input').first()).toBeChecked();
  } else {
    await expect(locator.locator('input').first()).not.toBeChecked();
  }
}

type WithExclude<T> = {
  [K in keyof T]?: {
    value: T[K] extends boolean ? T[K] : T[K][];
    exclude?: boolean;
  };
};

function filterExamObservationFields(filterOptions: WithExclude<ExamObservationFieldItem>): ExamObservationFieldItem[] {
  return examObservationFieldsDetailsArray.filter((field) => {
    let result = true;
    const filters = Object.keys(filterOptions);
    for (const filter of filters) {
      const filterOption = filterOptions[filter];
      result = filterOption.exclude ? field[filter] !== filterOption.value : field[filter] === filterOption.value;
    }
    return result;
  });
}

async function checkValuesInCheckboxes(page: Page, examObservationFields: ExamObservationFieldItem[]): Promise<void> {
  for (const field of examObservationFields) {
    const fieldLocator = page.getByTestId(dataTestIds.telemedEhrFlow.examTabField(field.field as ExamFieldsNames));
    await checkCheckboxValueInLocator(fieldLocator, field.defaultValue);
  }
}

test.describe('Exam tab', async () => {
  const resourceHandler = new ResourceHandler('telemed');
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources();
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should check default selected checkboxes', async () => {
    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();

    await test.step("Check 'General' card", async () => {
      await checkValuesInCheckboxes(page, filterExamObservationFields({ group: { value: ['normal', 'abnormal'] } }));
    });
  });

  test("Should select value from 'Normal' list and verify checkbox become green", async () => {
    const examObservationFields = Object.keys(ExamObservationFieldsDetails);
    const uncheckedField = examObservationFields.find(
      (field) => ExamObservationFieldsDetails[field as ExamFieldsNames].defaultValue === false
    );

    const normalListCheckbox = page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabField(uncheckedField as ExamFieldsNames))
      .locator('input');
    await normalListCheckbox.click();
    await expect(normalListCheckbox).toBeEnabled();
    await checkCheckboxValueInLocator(normalListCheckbox, true);

    const checkboxSpan = normalListCheckbox.locator('span.MuiCheckbox-root.Mui-checked');

    const computedColor = await checkboxSpan.evaluate((el) => window.getComputedStyle(el).getPropertyValue('color'));

    expect(computedColor).toBe('#2E7D32');
  });
});
