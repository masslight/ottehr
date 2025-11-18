import { expect, Locator, Page } from '@playwright/test';
import { DateTime } from 'luxon';

/**
 * LOADING PATTERNS FOR EXAM COMPONENTS
 * =====================================
 *
 * This document describes the loading/saving behavior for each component type in the exam table.
 * All components use the `useExamObservations` hook which provides an `isLoading` state.
 *
 * 1. TEXT/COMMENT FIELDS (ExamCommentField):
 *    - Component: TextField with debounced save (700ms)
 *    - Loading indicator: CircularProgress (role="progressbar") appears as InputProps.endAdornment
 *    - Wait strategy: Wait for progressbar to appear and disappear
 *    - Helper: waitForFieldSave()
 *
 * 2. CHECKBOXES (ControlledExamCheckbox):
 *    - Component: Checkbox with immediate save on click
 *    - Loading indicator: Checkbox becomes disabled during isLoading
 *    - Wait strategy: Wait for checkbox to not be disabled after click
 *    - Note: No visual progress indicator, only disabled state
 *
 * 3. MULTI-SELECT (ControlledCheckboxSelect):
 *    - Component: Checkbox + MUI Select (multiple) dropdown
 *    - Loading indicators:
 *      - Parent checkbox: disabled during isLoading
 *      - Dropdown options (MenuItem): disabled during isLoading
 *    - Wait strategy: Wait for options to not be disabled after selection
 *    - Note: Selections persist in combobox renderValue + ListItemText elements below
 *
 * 4. DROPDOWN (ControlledExamCheckboxDropdown):
 *    - Component: Checkbox + Autocomplete dropdown
 *    - Loading indicators:
 *      - Checkbox: disabled during isLoading
 *      - Autocomplete: disabled during isLoading
 *    - Wait strategy: Wait for dropdown to not be disabled after selection
 *
 * 5. FORM (ExamForm):
 *    - Component: Checkbox + dynamic form fields + Add button
 *    - Form contains: radio buttons, text fields, autocomplete dropdowns
 *    - Loading indicators:
 *      - Parent checkbox: disabled during isLoading
 *      - All form inputs: disabled during isLoading
 *      - Add button: disabled during isLoading
 *    - Wait strategy: Wait for form elements to not be disabled after adding entry
 *    - Note: Added entries appear as paragraph elements with delete buttons
 *
 * GENERAL RULES:
 * - Never use page.waitForTimeout() - always wait for actual loading states
 * - For checkboxes/dropdowns: Wait for not.toBeDisabled()
 * - For text fields: Use waitForFieldSave() helper
 * - Dropdowns auto-close when option is selected
 * - Multi-select dropdowns stay open, close with Escape or click outside
 */

/**
 * Result of testing a component - stores which row and component was tested
 */
export interface ComponentTestResult {
  rowIndex: number;
  componentType: 'checkbox' | 'text' | 'multi-select' | 'dropdown' | 'form';
  abnormalCheckboxIndex?: number;
  normalCheckboxIndex?: number;
  // Store initial states of ALL checkboxes for persistence verification
  initialAbnormalCheckboxStates?: boolean[];
  initialNormalCheckboxStates?: boolean[];
  // Store checkbox labels and their final states for progress note verification
  abnormalCheckboxLabels?: Array<{ label: string; checked: boolean }>;
  normalCheckboxLabels?: Array<{ label: string; checked: boolean }>;
  selectedOptions?: string[];
  formEntryText?: string;
  dropdownValue?: string;
  textValue?: string; // Store the text entered in text component
}

/**
 * Helper function to wait for loading indicator to appear and disappear on a textbox
 */
export async function waitForFieldSave(textbox: Locator): Promise<void> {
  const parentCell = textbox.locator('..');

  // Wait for loading indicator to appear (it's a sibling of the textbox)
  await parentCell
    .getByRole('progressbar')
    .waitFor({ state: 'visible', timeout: 2000 })
    .catch(() => {
      // It's okay if it doesn't appear - might be too fast
    });

  // Wait for loading indicator to disappear
  await parentCell
    .getByRole('progressbar')
    .waitFor({ state: 'hidden', timeout: 5000 })
    .catch(() => {
      // Already disappeared
    });
}

/**
 * Helper function to wait for a checkbox to finish saving (waits for disabled state to clear)
 */
export async function waitForCheckboxSave(checkbox: Locator): Promise<void> {
  await checkbox.waitFor({ state: 'attached' });

  // Wait for the checkbox input to not be disabled (indicates save is complete)
  const input = checkbox.locator('..').locator('input[type="checkbox"]').first();

  // Use waitFor with a polling check
  await input.waitFor({ state: 'attached' });

  // Poll until the checkbox is no longer disabled
  await expect(async () => {
    const isDisabled = await input.evaluate((el: HTMLInputElement) => el.disabled);
    if (isDisabled) {
      throw new Error('Checkbox still disabled, waiting for save to complete');
    }
  }).toPass({ timeout: 5000, intervals: [100, 200, 300] });
}

/**
 * Capture ALL checkbox labels and states from the entire exam table
 */
export async function captureAllCheckboxStates(examTable: Locator): Promise<{
  abnormalCheckboxLabels: Array<{ label: string; checked: boolean }>;
  normalCheckboxLabels: Array<{ label: string; checked: boolean }>;
}> {
  const abnormalCheckboxLabels: Array<{ label: string; checked: boolean }> = [];
  const normalCheckboxLabels: Array<{ label: string; checked: boolean }> = [];

  // Get all rows in tbody
  const rows = examTable.locator('tbody').getByRole('row');
  const rowCount = await rows.count();

  for (let rowIdx = 0; rowIdx < rowCount; rowIdx++) {
    const row = rows.nth(rowIdx);
    const cells = row.getByRole('cell');

    // Normal checkboxes are in column 1 (index 1)
    const normalCell = cells.nth(1);
    const normalCheckboxes = normalCell.getByRole('checkbox');
    const normalCount = await normalCheckboxes.count();

    for (let i = 0; i < normalCount; i++) {
      const checkbox = normalCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      // Label text is in <p> element inside the parent <label> tag (grandparent of checkbox)
      const label = (await checkbox.locator('../..').locator('p').textContent()) || '';
      if (label.trim()) {
        normalCheckboxLabels.push({ label: label.trim(), checked: isChecked });
      }
    }

    // Abnormal checkboxes are in column 2 (index 2)
    const abnormalCell = cells.nth(2);
    const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
    const abnormalCount = await abnormalCheckboxes.count();

    for (let i = 0; i < abnormalCount; i++) {
      const checkbox = abnormalCheckboxes.nth(i);
      const isChecked = await checkbox.isChecked();
      // Label text is in <p> element inside the parent <label> tag (grandparent of checkbox)
      const label = (await checkbox.locator('../..').locator('p').textContent()) || '';
      if (label.trim()) {
        abnormalCheckboxLabels.push({ label: label.trim(), checked: isChecked });
      }
    }
  }

  return { abnormalCheckboxLabels, normalCheckboxLabels };
}

/**
 * Test a checkbox component by clicking abnormal checkbox and unchecking a normal checkbox
 */
export async function testCheckboxComponent(page: Page, examTable: Locator): Promise<ComponentTestResult> {
  // Find first checkbox in tbody (skip header)
  const checkboxComponent = examTable.locator('tbody [data-testid^="exam-component-checkbox-"]').first();
  await checkboxComponent.waitFor({ state: 'visible', timeout: 5000 });
  const testId = await checkboxComponent.getAttribute('data-testid');

  // Find the parent row index within tbody (add 1 to account for header row in total row count)
  const rowIndex = await examTable
    .locator('tbody')
    .getByRole('row')
    .locator(`[data-testid="${testId}"]`)
    .first()
    .evaluateHandle((el) => {
      const tr = el.closest('tr');
      if (!tr) return -1;
      const tbody = tr.parentElement;
      if (!tbody) return -1;
      // Add 1 to account for header row
      return Array.from(tbody.children).indexOf(tr) + 1;
    })
    .then((handle) => handle.jsonValue());

  const cells = examTable
    .getByRole('row')
    .nth(rowIndex as number)
    .getByRole('cell');
  const abnormalCell = cells.nth(2);
  const normalCell = cells.nth(1);

  // Capture initial states of ALL checkboxes before making changes
  const abnormalCheckboxes = abnormalCell.getByRole('checkbox');
  const abnormalCheckboxCount = await abnormalCheckboxes.count();
  const initialAbnormalCheckboxStates: boolean[] = [];
  for (let i = 0; i < abnormalCheckboxCount; i++) {
    const isChecked = await abnormalCheckboxes.nth(i).isChecked();
    initialAbnormalCheckboxStates.push(isChecked);
  }

  const normalCheckboxes = normalCell.getByRole('checkbox');
  const normalCheckboxCount = await normalCheckboxes.count();
  const initialNormalCheckboxStates: boolean[] = [];
  for (let i = 0; i < normalCheckboxCount; i++) {
    const isChecked = await normalCheckboxes.nth(i).isChecked();
    initialNormalCheckboxStates.push(isChecked);
  }

  // Click first abnormal checkbox
  const abnormalCheckbox = abnormalCheckboxes.first();
  await abnormalCheckbox.click();
  await waitForCheckboxSave(abnormalCheckbox);
  console.log(`✓ Clicked abnormal checkbox in row ${rowIndex}`);

  // Uncheck first checked normal checkbox
  let normalCheckboxIndex: number | undefined;

  for (let i = 0; i < normalCheckboxCount; i++) {
    const normalCheckbox = normalCheckboxes.nth(i);
    const isChecked = await normalCheckbox.isChecked();
    if (isChecked) {
      await normalCheckbox.click();
      await waitForCheckboxSave(normalCheckbox);
      normalCheckboxIndex = i;
      console.log(`✓ Unchecked normal checkbox ${i} in row ${rowIndex}`);
      break;
    }
  }

  // NOTE: We do NOT capture all checkbox states here because other tests may modify checkboxes
  // The test suite will capture ALL checkbox states later, after all component tests have run

  return {
    rowIndex: rowIndex as number,
    componentType: 'checkbox',
    abnormalCheckboxIndex: 0,
    normalCheckboxIndex,
    initialAbnormalCheckboxStates,
    initialNormalCheckboxStates,
    // These will be populated later in the persistence test, after all tests have modified checkboxes
    abnormalCheckboxLabels: undefined,
    normalCheckboxLabels: undefined,
  };
}

/**
 * Test a text component (provider comment field)
 */
export async function testTextComponent(page: Page, examTable: Locator): Promise<ComponentTestResult | null> {
  // Search for text components ONLY in abnormal column (cell index 2) to avoid comment column
  const rows = examTable.locator('tbody').getByRole('row');
  const rowCount = await rows.count();

  for (let i = 0; i < rowCount; i++) {
    const row = rows.nth(i);
    const abnormalCell = row.getByRole('cell').nth(2); // Abnormal column only
    const textComponent = abnormalCell.locator('[data-testid^="exam-component-text-"]');

    if ((await textComponent.count()) > 0) {
      const textbox = textComponent.getByRole('textbox');
      const comment = `Test text field ${DateTime.now().toMillis()}`;
      await textbox.fill(comment);
      await waitForFieldSave(textbox);
      const rowIndex = i + 1; // +1 for header row
      console.log(`✓ Filled text component in abnormal column of row ${rowIndex}`);

      return {
        rowIndex,
        componentType: 'text',
        textValue: comment,
      };
    }
  }

  console.log('⊘ No text component found in abnormal column');
  return null;
}

/**
 * Test a multi-select component by selecting multiple options
 * Note: The multi-select requires clicking a parent checkbox first to activate the combobox
 */
export async function testMultiSelectComponent(page: Page, examTable: Locator): Promise<ComponentTestResult> {
  const multiSelectComponent = examTable.locator('tbody [data-testid^="exam-component-multi-select-"]').first();
  const testId = await multiSelectComponent.getAttribute('data-testid');

  // Find the parent row index within tbody (add 1 to account for header row)
  const rowIndex = await examTable
    .locator('tbody')
    .getByRole('row')
    .locator(`[data-testid="${testId}"]`)
    .first()
    .evaluateHandle((el) => {
      const tr = el.closest('tr');
      if (!tr) return -1;
      const tbody = tr.parentElement;
      if (!tbody) return -1;
      return Array.from(tbody.children).indexOf(tr) + 1;
    })
    .then((handle) => handle.jsonValue());

  // Check if the combobox already exists (multi-select is active)
  const combobox = multiSelectComponent.getByRole('combobox');
  const comboboxExists = await combobox.count();

  // If combobox doesn't exist, we need to click the parent checkbox first
  if (comboboxExists === 0) {
    // The checkbox is part of the multi-select wrapper but we need to find it
    const checkbox = multiSelectComponent.getByRole('checkbox');
    const checkboxCount = await checkbox.count();

    if (checkboxCount === 0) {
      console.log('⊘ Multi-select not activated (no checkbox or combobox found)');
      throw new Error('Multi-select component not in expected state');
    }

    console.log(`✓ Activating multi-select by clicking parent checkbox in row ${rowIndex}`);
    await checkbox.click();

    // After clicking the checkbox, wait for the combobox to appear (not for checkbox save)
    // The checkbox may be removed/replaced during the transition to showing the combobox
    await combobox.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`✓ Multi-select combobox appeared after checkbox click`);
  }

  console.log(`✓ Multi-select is active in row ${rowIndex}`);

  // Click the combobox to open the dropdown
  await combobox.click();
  await page.getByRole('listbox').first().waitFor({ state: 'visible' });

  // Select up to 3 options
  const listbox = page.getByRole('listbox').first();
  const options = listbox.getByRole('option');
  const optionCount = await options.count();
  const optionsToSelect = Math.min(3, optionCount);
  const selectedOptions: string[] = [];

  for (let i = 0; i < optionsToSelect; i++) {
    const currentOptions = page.getByRole('listbox').first().getByRole('option');
    const option = currentOptions.nth(i);

    // Wait for option to be enabled
    await option.waitFor({ state: 'attached' });
    // Wait for option to not be disabled
    await expect(option).not.toBeDisabled();

    const optionText = await option.textContent();
    await option.click();

    // After clicking, wait for the option to become not disabled again (save completes)
    // The option itself gets disabled during save, then re-enabled
    await expect(async () => {
      const isDisabled = await option.isDisabled();
      if (isDisabled) {
        throw new Error('Option still disabled, waiting for save to complete');
      }
    }).toPass({ timeout: 5000, intervals: [100, 200, 300] });

    if (optionText) {
      selectedOptions.push(optionText.trim());
      console.log(`✓ Selected option "${optionText.trim()}" in multi-select`);
    }
  }

  // Close the dropdown
  await page.keyboard.press('Escape');
  // Wait for listbox to close
  await listbox.waitFor({ state: 'hidden' });

  return {
    rowIndex: rowIndex as number,
    componentType: 'multi-select',
    selectedOptions,
  };
}

/**
 * Test a dropdown component (checkbox with dropdown selection)
 */
export async function testDropdownComponent(page: Page, examTable: Locator): Promise<ComponentTestResult> {
  const dropdownComponent = examTable.locator('tbody [data-testid^="exam-component-dropdown-"]').first();
  const testId = await dropdownComponent.getAttribute('data-testid');

  // Find the parent row index within tbody (add 1 to account for header row)
  const rowIndex = await examTable
    .locator('tbody')
    .getByRole('row')
    .locator(`[data-testid="${testId}"]`)
    .first()
    .evaluateHandle((el) => {
      const tr = el.closest('tr');
      if (!tr) return -1;
      const tbody = tr.parentElement;
      if (!tbody) return -1;
      return Array.from(tbody.children).indexOf(tr) + 1;
    })
    .then((handle) => handle.jsonValue());

  // Click the checkbox to enable the dropdown
  const checkbox = dropdownComponent.getByRole('checkbox');
  await checkbox.click();
  await waitForCheckboxSave(checkbox);
  console.log(`✓ Enabled dropdown in row ${rowIndex}`);

  // Click the combobox to open the dropdown
  const combobox = dropdownComponent.getByRole('combobox');
  await combobox.click();
  await page.getByRole('listbox').first().waitFor({ state: 'visible' });

  // Select first option
  const listbox = page.getByRole('listbox').first();
  const options = listbox.getByRole('option');
  const firstOption = options.first();
  const optionText = await firstOption.textContent();
  await firstOption.click();
  await waitForCheckboxSave(checkbox); // Wait for save after selection
  console.log(`✓ Selected option "${optionText}" in dropdown`);

  return {
    rowIndex: rowIndex as number,
    componentType: 'dropdown',
    dropdownValue: optionText?.trim(),
  };
}

/**
 * Test a form component by filling form fields and clicking Add
 */
export async function testFormComponent(page: Page, examTable: Locator): Promise<ComponentTestResult> {
  const formComponent = examTable.locator('tbody [data-testid^="exam-component-form-"]').first();
  const testId = await formComponent.getAttribute('data-testid');

  // Find the parent row index within tbody (add 1 to account for header row)
  const rowIndex = await examTable
    .locator('tbody')
    .getByRole('row')
    .locator(`[data-testid="${testId}"]`)
    .first()
    .evaluateHandle((el) => {
      const tr = el.closest('tr');
      if (!tr) return -1;
      const tbody = tr.parentElement;
      if (!tbody) return -1;
      return Array.from(tbody.children).indexOf(tr) + 1;
    })
    .then((handle) => handle.jsonValue());

  // Click the checkbox to show the form
  const checkbox = formComponent.getByRole('checkbox');
  await checkbox.click();
  await waitForCheckboxSave(checkbox);
  console.log(`✓ Enabled form in row ${rowIndex}`);

  // Fill form fields
  // Select first radio button if present
  const radios = formComponent.getByRole('radio');
  if ((await radios.count()) > 0) {
    await radios.first().click();
    await waitForCheckboxSave(checkbox); // Wait for save after radio selection
    console.log(`✓ Selected radio button in form`);
  }

  // Fill all comboboxes (dropdowns)
  const comboboxes = formComponent.getByRole('combobox');
  const comboboxCount = await comboboxes.count();

  for (let i = 0; i < comboboxCount; i++) {
    const combobox = comboboxes.nth(i);
    const isDisabled = await combobox.isDisabled().catch(() => true);

    if (!isDisabled) {
      await combobox.click();
      const listbox = page.getByRole('listbox').first();
      await listbox.waitFor({ state: 'visible', timeout: 2000 }).catch(() => false);
      const isVisible = await listbox.isVisible().catch(() => false);

      if (isVisible) {
        const options = listbox.getByRole('option');
        const optionCount = await options.count();
        if (optionCount > 0) {
          const firstOption = options.first();
          const optionText = await firstOption.textContent();
          await firstOption.click();
          await waitForCheckboxSave(checkbox); // Wait for save after dropdown selection
          console.log(`✓ Selected "${optionText}" in dropdown ${i}`);
        }
      }
    }
  }

  // Fill text boxes if present
  const textBoxes = formComponent.getByRole('textbox');
  const textboxCount = await textBoxes.count();
  if (textboxCount > 0) {
    for (let i = 0; i < textboxCount; i++) {
      const textbox = textBoxes.nth(i);
      await textbox.fill(`Test text ${i + 1}`);
      await waitForFieldSave(textbox); // Wait for each field to save
    }
    console.log(`✓ Filled ${textboxCount} textbox(es) in form`);
  }

  // Click Add button
  const addButton = formComponent.getByRole('button', { name: 'Add' });
  await addButton.click();
  // Wait for Add button to be enabled again (indicating save is complete)
  await expect(addButton).not.toBeDisabled();
  console.log(`✓ Clicked Add button in form`);

  // Capture the added entry text
  const paragraphs = formComponent.locator('p');
  const paragraphCount = await paragraphs.count();
  let formEntryText: string | undefined;

  for (let i = 0; i < paragraphCount; i++) {
    const pText = await paragraphs.nth(i).textContent();
    if (pText && pText.includes('|')) {
      formEntryText = pText.trim();
      console.log(`✓ Captured form entry: "${formEntryText}"`);
      break;
    }
  }

  return {
    rowIndex: rowIndex as number,
    componentType: 'form',
    formEntryText,
  };
}
