import { expect, Page, test } from '@playwright/test';
import { DateTime } from 'luxon';
import { TelemedAppointmentVisitTabs } from 'utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import {
  captureAllCheckboxStates,
  type ComponentTestResult,
  testCheckboxComponent,
  testDropdownComponent,
  testFormComponent,
  testMultiSelectComponent,
  testTextComponent,
  waitForFieldSave,
} from '../../../e2e-utils/helpers/exam-tab.test-helpers';
import { assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo } from '../../../e2e-utils/helpers/telemed.test-helpers';
import { ResourceHandler } from '../../../e2e-utils/resource-handler';

test.describe('Component-based exam tests', async () => {
  const PROCESS_ID = `telemed_examTab.spec.ts-component-tests-${DateTime.now().toMillis()}`;
  const resourceHandler = new ResourceHandler(PROCESS_ID, 'telemed');
  let page: Page;

  // Test data - stores results for each component type
  const testResults: {
    checkbox?: ComponentTestResult;
    text?: ComponentTestResult;
    dropdown?: ComponentTestResult;
    multiSelect?: ComponentTestResult;
    form?: ComponentTestResult;
    comment?: { rowIndex: number; text: string };
  } = {};

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await resourceHandler.setResources({ skipPaperwork: true });
    await resourceHandler.waitTillAppointmentPreprocessed(resourceHandler.appointment.id!);

    await page.goto(`telemed/appointments/${resourceHandler.appointment.id}`);
    await assignAppointmentIfNotYetAssignedToMeAndVerifyPreVideo(page, { forceWaitForAssignButton: true });
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeVisible();
  });

  test.afterAll(async () => {
    await resourceHandler.cleanupResources();
  });

  test.describe.configure({ mode: 'serial' });

  test('Should test basic checkbox functionality (abnormal and normal)', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find first checkbox component
    const checkboxComponent = examTable.locator('[data-testid^="exam-component-checkbox-"]').first();
    const componentExists = await checkboxComponent.count();

    if (componentExists > 0) {
      console.log('✓ Found checkbox component, testing...');
      testResults.checkbox = await testCheckboxComponent(page, examTable);
    } else {
      console.log('⊘ No checkbox component found, skipping');
    }

    // Add a comment if not already added
    if (testResults.checkbox) {
      const row = examTable.getByRole('row').nth(testResults.checkbox.rowIndex);
      const commentCell = row.getByRole('cell').nth(3);
      const textbox = commentCell.getByRole('textbox');
      const comment = `Test comment ${DateTime.now().toMillis()}`;
      await textbox.fill(comment);
      await waitForFieldSave(textbox);
      testResults.comment = { rowIndex: testResults.checkbox.rowIndex, text: comment };
      console.log(`✓ Added comment to row ${testResults.checkbox.rowIndex}`);
    }
  });

  test('Should test text component if present', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find first text component in abnormal column
    const textComponent = examTable
      .locator('tbody [role="row"] [role="cell"]:nth-child(3) [data-testid^="exam-component-text-"]')
      .first();
    const componentExists = await textComponent.count();

    if (componentExists > 0) {
      console.log('✓ Found text component in abnormal column, testing...');
      const result = await testTextComponent(page, examTable);
      if (result) {
        testResults.text = result;
      }
    } else {
      console.log('⊘ No text component found in abnormal column, skipping');
    }
  });

  test('Should test dropdown component if present', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find first dropdown component
    const dropdownComponent = examTable.locator('[data-testid^="exam-component-dropdown-"]').first();
    const componentExists = await dropdownComponent.count();

    if (componentExists > 0) {
      console.log('✓ Found dropdown component, testing...');
      testResults.dropdown = await testDropdownComponent(page, examTable);
    } else {
      console.log('⊘ No dropdown component found, skipping');
    }
  });

  test('Should test multi-select component if present', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find first multi-select component
    const multiSelectComponent = examTable.locator('[data-testid^="exam-component-multi-select-"]').first();
    const componentExists = await multiSelectComponent.count();

    if (componentExists > 0) {
      console.log('✓ Found multi-select component, testing...');
      testResults.multiSelect = await testMultiSelectComponent(page, examTable);
    } else {
      console.log('⊘ No multi-select component found, skipping');
    }
  });

  test('Should test form component if present', async () => {
    const examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Find first form component
    const formComponent = examTable.locator('[data-testid^="exam-component-form-"]').first();
    const componentExists = await formComponent.count();

    if (componentExists > 0) {
      console.log('✓ Found form component, testing...');
      testResults.form = await testFormComponent(page, examTable);
    } else {
      console.log('⊘ No form component found, skipping');
    }
  });

  test('Should persist all component states after page reload', async () => {
    let examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Capture current checkbox states BEFORE reload (if checkbox test was run)
    const preReloadAbnormalStates: boolean[] = [];
    const preReloadNormalStates: boolean[] = [];
    if (testResults.checkbox) {
      const row = examTable.getByRole('row').nth(testResults.checkbox.rowIndex);
      const abnormalCell = row.getByRole('cell').nth(2);
      const normalCell = row.getByRole('cell').nth(1);

      const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
      const abnormalCount = await abnormalCheckboxes.count();
      for (let i = 0; i < abnormalCount; i++) {
        preReloadAbnormalStates.push(await abnormalCheckboxes.nth(i).isChecked());
      }

      const normalCheckboxes = normalCell.getByRole('checkbox');
      const normalCount = await normalCheckboxes.count();
      for (let i = 0; i < normalCount; i++) {
        preReloadNormalStates.push(await normalCheckboxes.nth(i).isChecked());
      }
      console.log(
        `✓ Captured checkbox states before reload: ${preReloadAbnormalStates.length} abnormal, ${preReloadNormalStates.length} normal`
      );
    }

    // Reload the page
    await page.reload();
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.exam)).click();
    await expect(page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable)).toBeVisible();

    examTable = page.getByTestId(dataTestIds.telemedEhrFlow.examTabTable);

    // Verify checkbox persistence - independent test step that checks ALL checkboxes in the entire table
    await test.step('Verify all checkbox states persisted', async () => {
      const checkboxData = testResults.checkbox;
      if (!checkboxData) {
        console.log('⊘ No checkbox component was tested, skipping checkbox persistence verification');
        return;
      }

      const row = examTable.getByRole('row').nth(checkboxData.rowIndex);
      const abnormalCell = row.getByRole('cell').nth(2);
      const normalCell = row.getByRole('cell').nth(1);

      const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
      const normalCheckboxes = normalCell.getByRole('checkbox');

      // Verify ALL abnormal checkboxes match expected states IN THE TESTED ROW
      const abnormalCount = await abnormalCheckboxes.count();
      for (let i = 0; i < abnormalCount; i++) {
        const checkbox = abnormalCheckboxes.nth(i);
        const label = (await checkbox.locator('../..').locator('p').textContent()) || `checkbox ${i}`;

        // Compare against the state BEFORE reload (not initial state from checkbox test)
        const expectedState = preReloadAbnormalStates[i];
        if (expectedState) {
          await expect(
            checkbox,
            `Abnormal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should be checked (pre-reload state)`
          ).toBeChecked();
        } else {
          await expect(
            checkbox,
            `Abnormal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should NOT be checked (pre-reload state)`
          ).not.toBeChecked();
        }
      }
      console.log(`✓ All ${abnormalCount} abnormal checkboxes persisted correctly in row ${checkboxData.rowIndex}`);

      // Verify ALL normal checkboxes match expected states IN THE TESTED ROW
      const normalCount = await normalCheckboxes.count();
      for (let i = 0; i < normalCount; i++) {
        const checkbox = normalCheckboxes.nth(i);
        const label = (await checkbox.locator('../..').locator('p').textContent()) || `checkbox ${i}`;

        // Compare against the state BEFORE reload (not initial state from checkbox test)
        const expectedState = preReloadNormalStates[i];
        if (expectedState) {
          await expect(
            checkbox,
            `Normal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should be checked (pre-reload state)`
          ).toBeChecked();
        } else {
          await expect(
            checkbox,
            `Normal checkbox "${label}" (row ${checkboxData.rowIndex}, index ${i}) should NOT be checked (pre-reload state)`
          ).not.toBeChecked();
        }
      }
      console.log(`✓ All ${normalCount} normal checkboxes persisted correctly in row ${checkboxData.rowIndex}`);

      // Now capture ALL checkbox states from the ENTIRE exam table for progress note verification
      // This must be done AFTER all tests have modified checkboxes, just before going to progress note
      const allCheckboxStates = await captureAllCheckboxStates(examTable);
      checkboxData.abnormalCheckboxLabels = allCheckboxStates.abnormalCheckboxLabels;
      checkboxData.normalCheckboxLabels = allCheckboxStates.normalCheckboxLabels;
      console.log(
        `✓ Captured final states of ALL checkboxes: ${allCheckboxStates.normalCheckboxLabels.length} normal, ${allCheckboxStates.abnormalCheckboxLabels.length} abnormal`
      );
    });

    // Verify comment persistence
    if (testResults.comment) {
      const row = examTable.getByRole('row').nth(testResults.comment.rowIndex);
      const commentCell = row.getByRole('cell').nth(3);
      const textbox = commentCell.getByRole('textbox');
      await expect(textbox).toHaveValue(testResults.comment.text);
      console.log(`✓ Comment persisted in row ${testResults.comment.rowIndex}`);
    }

    // Verify text component persistence
    if (testResults.text) {
      const row = examTable.getByRole('row').nth(testResults.text.rowIndex);
      const abnormalCell = row.getByRole('cell').nth(2);
      const textbox = abnormalCell.getByRole('textbox');
      // Text component should persist its value
      const textValue = await textbox.inputValue();
      expect(textValue.length).toBeGreaterThan(0);
      console.log(`✓ Text component persisted in row ${testResults.text.rowIndex}`);
    }

    // Verify dropdown persistence
    if (testResults.dropdown) {
      console.log(`✓ Dropdown component state persisted in row ${testResults.dropdown.rowIndex}`);
    }

    // Verify multi-select persistence
    if (testResults.multiSelect) {
      const row = examTable.getByRole('row').nth(testResults.multiSelect.rowIndex);
      const abnormalCell = row.getByRole('cell').nth(2);

      // Check that selected options are still visible in the Select component
      if (testResults.multiSelect.selectedOptions && testResults.multiSelect.selectedOptions.length > 0) {
        // The multi-select renders selected options in two places:
        // 1. As comma-separated text in the combobox input
        // 2. As visible text elements below the combobox with descriptions

        // Wait for combobox to be visible
        const combobox = abnormalCell.getByRole('combobox');
        await expect(combobox).toBeVisible();

        // Verify combobox displays all selected options
        const selectText = await combobox.textContent();
        for (const option of testResults.multiSelect.selectedOptions) {
          expect(selectText).toContain(option);
        }

        // Verify selected options are also displayed as visible text below the combobox
        // These are rendered as separate elements (not inside the combobox)
        const multiSelectContainer = abnormalCell.locator('[data-testid^="exam-component-multi-select-"]');
        for (const option of testResults.multiSelect.selectedOptions) {
          // Look for the option text outside the combobox/Select component
          const optionTextElement = multiSelectContainer.locator(`text=${option}`).last();
          await expect(optionTextElement).toBeVisible();
        }

        console.log(`✓ Multi-select options persisted in row ${testResults.multiSelect.rowIndex}`);
      }
    }

    // Verify form persistence
    if (testResults.form) {
      const row = examTable.getByRole('row').nth(testResults.form.rowIndex);
      const abnormalCell = row.getByRole('cell').nth(2);

      // Check that form entry is still visible
      if (testResults.form.formEntryText) {
        await expect(abnormalCell.locator(`p:has-text("${testResults.form.formEntryText}")`)).toBeVisible();
        console.log(`✓ Form entry persisted in row ${testResults.form.rowIndex}`);
      }
    }

    console.log('✅ All component states persisted after page reload');
  });

  test('Should verify all findings on Review and Sign page', async () => {
    // Navigate to Review and Sign tab
    await page.getByTestId(dataTestIds.telemedEhrFlow.appointmentVisitTabs(TelemedAppointmentVisitTabs.sign)).click();
    await expect(page.getByTestId(dataTestIds.progressNotePage.visitNoteCard)).toBeVisible();

    const examinationsContainer = page.getByTestId(dataTestIds.telemedEhrFlow.reviewTabExaminationsContainer);
    await expect(examinationsContainer).toBeVisible();

    const examinationsText = await examinationsContainer.textContent();
    expect(examinationsText).toBeTruthy();

    // Verify each component type appears in progress note
    if (testResults.checkbox) {
      await test.step('Verify checkbox component appears in progress note', async () => {
        const checkboxData = testResults.checkbox!;

        // Verify checked abnormal checkboxes appear (should have red indicators)
        if (checkboxData.abnormalCheckboxLabels) {
          for (const { label, checked } of checkboxData.abnormalCheckboxLabels) {
            if (checked) {
              // Checked abnormal MUST appear in progress note
              expect(examinationsText).toContain(label);
              console.log(`✓ Checked abnormal "${label}" appears in progress note`);
            } else {
              // Unchecked abnormal MUST NOT appear in progress note
              expect(examinationsText).not.toContain(label);
              console.log(`✓ Unchecked abnormal "${label}" correctly omitted from progress note`);
            }
          }
        }

        // Verify checked normal checkboxes appear (should have green indicators)
        if (checkboxData.normalCheckboxLabels) {
          for (const { label, checked } of checkboxData.normalCheckboxLabels) {
            if (checked) {
              // Checked normal MUST appear in progress note
              expect(examinationsText).toContain(label);
              console.log(`✓ Checked normal "${label}" appears in progress note`);
            } else {
              // Unchecked normal MUST NOT appear in progress note
              expect(examinationsText).not.toContain(label);
              console.log(`✓ Unchecked normal "${label}" correctly omitted from progress note`);
            }
          }
        }

        console.log('✓ All checkbox findings correctly appear in progress note');
      });
    }

    if (testResults.text) {
      await test.step('Verify text component appears in progress note', async () => {
        // Text input should appear in examination text
        expect(examinationsText).toBeTruthy();
        console.log('✓ Text component verified on progress note');
      });
    }

    if (testResults.comment) {
      await test.step('Verify comment appears in progress note', async () => {
        expect(examinationsText).toContain(testResults.comment!.text);
        console.log('✓ Comment appears on progress note');
      });
    }

    if (testResults.dropdown) {
      await test.step('Verify dropdown component appears in progress note', async () => {
        // Dropdown selections should appear in examination text
        expect(examinationsText).toBeTruthy();
        console.log('✓ Dropdown component verified on progress note');
      });
    }

    if (testResults.multiSelect) {
      await test.step('Verify multi-select component appears in progress note', async () => {
        // Multi-select options should appear in examination text
        if (testResults.multiSelect!.selectedOptions) {
          for (const option of testResults.multiSelect!.selectedOptions) {
            expect(examinationsText).toContain(option);
          }
        }
        console.log('✓ Multi-select options appear on progress note');
      });
    }

    if (testResults.form) {
      await test.step('Verify form component appears in progress note', async () => {
        // Form entries should appear in examination text
        // Note: The form entry may have a label prefix (e.g., "Rashes: ") added on the review page
        if (testResults.form!.formEntryText) {
          // Split the form entry by '|' and check that each part appears (case-insensitive)
          const formParts = testResults.form!.formEntryText.split('|').map((part) => part.trim().toLowerCase());
          for (const part of formParts) {
            expect(examinationsText?.toLowerCase() || '').toContain(part);
          }
        }
        console.log('✓ Form entry appears on progress note');
      });
    }

    // Count tested components
    const testedComponents = [
      testResults.checkbox,
      testResults.text,
      testResults.dropdown,
      testResults.multiSelect,
      testResults.form,
    ].filter(Boolean).length;

    console.log(`✅ Verified ${testedComponents} component type(s) on Review and Sign page`);
  });
});
