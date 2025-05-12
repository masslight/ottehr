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
import { getDropdownOption } from '../../../e2e-utils/helpers/tests-utils';
import { rgbToHex } from '@mui/system';

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
  // this color i've found in the palette
  const greenColorFromPalette = '#2E7D32';
  const redColorFromPalette = '#D32F2F';
  const boldFontSize = 600;
  const defaultUncheckedNormalField = ExamObservationFieldsDetails['playful-and-active'];
  const defaultUncheckedAbnormalField = ExamObservationFieldsDetails['tired-appearing'];
  const providerComment = 'Lorem ipsum';
  const distressDropdownOption = ExamObservationFieldsDetails['moderate-distress'].label;
  const tenderDropdownOption = ExamObservationFieldsDetails['left-lower-quadrant-abdomen'].label;
  const rashWithoutDescriptionDropdownOption = ExamObservationFieldsDetails['consistent-with-insect-bites'].label;
  const rashWithDescriptionDropdownOption = ExamObservationFieldsDetails['consistent-with-impetigo'].label;
  const rashDescription = 'rash description';

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
    const normalListField = page.getByTestId(
      dataTestIds.telemedEhrFlow.examTabField(defaultUncheckedNormalField.field)
    );
    const checkbox = normalListField.locator('input');
    await checkbox.click();
    await expect(checkbox).toBeEnabled();
    await checkCheckboxValueInLocator(normalListField, true);

    const color = await normalListField
      .locator('span')
      .first()
      .evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('color');
      });

    expect(rgbToHex(color)).toBe(greenColorFromPalette.toLowerCase());
  });

  test("Should select value from 'Abnormal' list and verify checkbox become red and text is bold", async () => {
    const abnormalListField = page.getByTestId(
      dataTestIds.telemedEhrFlow.examTabField(defaultUncheckedAbnormalField.field)
    );
    const checkbox = abnormalListField.locator('input');
    await checkbox.click();
    await expect(checkbox).toBeEnabled();
    await checkCheckboxValueInLocator(abnormalListField, true);

    const color = await abnormalListField
      .locator('span')
      .first()
      .evaluate((el) => {
        return window.getComputedStyle(el).getPropertyValue('color');
      });

    await expect(abnormalListField.locator('p')).toHaveCSS('font-weight', `${boldFontSize}`);
    expect(rgbToHex(color)).toBe(redColorFromPalette.toLowerCase());
  });

  test("Should enter some text in 'Provider' field", async () => {
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabCardsComments('general'))
      .locator('input')
      .fill(providerComment);
    await waitForSaveChartDataResponse(page);
  });

  test("Should check 'Distress' checkbox and select dropdown option", async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabDistressCheckbox).click();
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabDistressDropdown).click();
    await (await getDropdownOption(page, distressDropdownOption)).click();
    await waitForSaveChartDataResponse(page);
  });

  test("Should check 'Tender' checkbox and select dropdown option", async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabCards('abdomen')).click();
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabTenderCheckbox).click();
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabTenderDropdown).click();
    await (await getDropdownOption(page, tenderDropdownOption)).click();
    await waitForSaveChartDataResponse(page);
  });

  test("Should check 'Rashes' checkbox and rashes form appeared", async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesCheckbox).locator('input').click();
    await waitForSaveChartDataResponse(page);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesDropdown)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesDescription)).toBeVisible();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAddButton)).toBeVisible();
  });

  test('Should add skin rash without description', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesDropdown).click();
    await (await getDropdownOption(page, rashWithoutDescriptionDropdownOption)).click();
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAddButton).click();
    await waitForSaveChartDataResponse(page);
  });

  test('Should check rash saved in abnormal subsection without description', async () => {
    const rashesSubsection = page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection);
    await expect(rashesSubsection).toHaveText(rashWithoutDescriptionDropdownOption);
    await expect(rashesSubsection).not.toHaveText('|'); // it means we don't have description saved
  });

  test('Should add skin rash with description', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesDropdown).click();
    await (await getDropdownOption(page, rashWithDescriptionDropdownOption)).click();
    await page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabRashesDescription)
      .locator('textarea')
      .first()
      .fill(rashDescription);
    await page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAddButton).click();
    await waitForSaveChartDataResponse(page);
  });

  test('Should check rash with description is saved', async () => {
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)).toHaveText(
      new RegExp(`${rashWithDescriptionDropdownOption}|${rashDescription}`)
    );
  });

  test('Should check all fields are saved on Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);

    await expect(examinationsContainer).toHaveText(new RegExp(defaultUncheckedNormalField.label));
    await expect(examinationsContainer).toHaveText(new RegExp(defaultUncheckedAbnormalField.label));
    await expect(examinationsContainer).toHaveText(new RegExp(providerComment));

    await expect(examinationsContainer).toHaveText(new RegExp(distressDropdownOption));
    await expect(examinationsContainer).toHaveText(new RegExp(tenderDropdownOption));
    await expect(examinationsContainer).toHaveText(new RegExp(rashWithoutDescriptionDropdownOption));
    await expect(examinationsContainer).toHaveText(
      new RegExp(`${rashWithDescriptionDropdownOption}|${rashDescription}`)
    );
  });

  test('Should remove rashes and check it removed from abnormal subsection', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();
    const rashElementDeleteButton = page
      .getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)
      .getByTestId(dataTestIds.telemedEhrFlow.examTabRashElementInSubsection)
      .filter({ hasText: rashWithDescriptionDropdownOption })
      .locator('button');
    await rashElementDeleteButton.click();
    await waitForSaveChartDataResponse(page);
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabRashesAbnormalSubsection)).not.toHaveText(
      rashWithDescriptionDropdownOption
    );
  });

  test('Should check rash was removed from Review&Sign tab', async () => {
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();
    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);

    await expect(examinationsContainer).not.toHaveText(rashWithDescriptionDropdownOption);
    await expect(examinationsContainer).not.toHaveText(rashDescription);
  });
});
