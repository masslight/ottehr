import { Locator, Page } from '@playwright/test';

/**
 * Shared utilities for filling form fields in tests.
 *
 * Consolidates common field-filling logic used by both:
 * - BookingFlowHelpers (patient info forms)
 * - PagedQuestionnaireFlowHelper (paperwork forms)
 */

/**
 * Field type definitions
 */
export type FieldType = 'string' | 'text' | 'decimal' | 'integer' | 'date' | 'choice' | 'boolean';

/**
 * Configuration for filling a field
 */
export interface FieldFillConfig {
  type: FieldType;
  locator: Locator;
  value: any;
  /** For radio buttons vs dropdowns */
  preferredElement?: 'Radio' | 'Radio List' | 'Select' | 'Autocomplete';
  /** For radio buttons, the group aria-labelledby value */
  radioGroupLabelledBy?: string;
}

/**
 * Convert date from YYYY-MM-DD to MM/DD/YYYY format
 */
export function formatDateForInput(value: string): string {
  if (!value) return value;

  // Already in MM/DD/YYYY format
  if (value.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
    return value;
  }

  // Convert YYYY-MM-DD to MM/DD/YYYY
  if (value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = value.split('-');
    return `${month}/${day}/${year}`;
  }

  // Return as-is if format is unknown
  return value;
}

/**
 * Fill a string/text field
 */
export async function fillStringField(locator: Locator, value: string): Promise<void> {
  await locator.fill(String(value));
}

/**
 * Fill a numeric field (integer or decimal)
 */
export async function fillNumericField(locator: Locator, value: number | string): Promise<void> {
  await locator.fill(String(value));
}

/**
 * Fill a date field using the MM/DD/YYYY placeholder
 */
export async function fillDateField(page: Page, value: string): Promise<void> {
  const formattedDate = formatDateForInput(value);
  const dateInput = page.getByPlaceholder('MM/DD/YYYY');
  await dateInput.fill(formattedDate);
}

/**
 * Fill a choice field (MUI Autocomplete dropdown)
 *
 * This uses the click + fill + select pattern which is required for MUI Autocomplete
 * to work reliably, especially after validation errors clear the state.
 *
 * The sequence ensures proper selection:
 * 1. Click to open and focus the dropdown
 * 2. Clear any existing value to ensure clean state
 * 3. Type the value to filter options
 * 4. Wait for the matching option to be visible
 * 5. Click the option to select it
 * 6. Wait briefly for the selection to commit before moving to next field
 */
export async function fillChoiceDropdown(page: Page, locator: Locator, value: string): Promise<void> {
  // Click to open dropdown
  await locator.click();

  // Clear existing value first to ensure clean state
  await locator.clear();

  // Fill to filter options (required for MUI Autocomplete reliability)
  await locator.fill(value);

  // Wait for the matching option to be visible before clicking
  // Uses default Playwright timeout (30s) to handle dynamic loading scenarios
  const option = page.getByRole('option', { name: value, exact: true });
  await option.waitFor({ state: 'visible' });

  // Click the option to select it
  await option.click();

  // Small delay to allow MUI Autocomplete to commit the selection
  // before focus moves to the next field
  await page.waitForTimeout(100);
}

/**
 * Fill a radio button choice field
 */
export async function fillRadioChoice(page: Page, value: string, groupLabelledBy: string): Promise<void> {
  const radioGroup = page.locator(`[aria-labelledby="${groupLabelledBy}"]`);
  await radioGroup.locator(`input[value="${value}"]`).check();
}

/**
 * Fill a boolean checkbox field
 * Checkboxes in this app use aria-label="${linkId}-label"
 */
export async function fillCheckbox(page: Page, linkId: string, checked: boolean): Promise<void> {
  if (checked) {
    const checkbox = page.locator(`[aria-label="${linkId}-label"]`);
    await checkbox.check();
  }
}

/**
 * Structured validation error result
 */
export interface ValidationErrorResult {
  /** All error messages found on the page */
  allErrors: string[];
  /** Map of field linkId to its specific error message */
  fieldErrors: Map<string, string>;
  /** The aggregate error message shown at the bottom of the page (e.g., "Please fix the errors in...") */
  aggregateError: string | null;
}

/**
 * Get the validation error message for a specific field by its linkId
 * Fields render errors with id="${linkId}-helper-text"
 */
export async function getFieldValidationError(page: Page, linkId: string): Promise<string | null> {
  const helperTextId = `${linkId}-helper-text`;
  const helperElement = page.locator(`#${helperTextId}`);

  const isVisible = await helperElement.isVisible({ timeout: 1000 }).catch(() => false);
  if (!isVisible) {
    return null;
  }

  const text = await helperElement.textContent();
  return text?.trim() || null;
}

/**
 * Get the aggregate validation error message shown at the bottom of the page
 * This is rendered with id="form-error-helper-text"
 */
export async function getAggregateValidationError(page: Page): Promise<string | null> {
  const aggregateElement = page.locator('#form-error-helper-text');

  const isVisible = await aggregateElement.isVisible({ timeout: 1000 }).catch(() => false);
  if (!isVisible) {
    return null;
  }

  const text = await aggregateElement.textContent();
  return text?.trim() || null;
}

/**
 * Collect validation error messages from the page
 * Returns array of error message strings (for backward compatibility)
 */
export async function collectValidationErrors(page: Page): Promise<string[]> {
  const result = await collectValidationErrorsDetailed(page);
  return result.allErrors;
}

/**
 * Collect detailed validation error information from the page
 * Returns structured object with field-specific errors, aggregate error, and all errors
 */
export async function collectValidationErrorsDetailed(page: Page): Promise<ValidationErrorResult> {
  const allErrors: string[] = [];
  const fieldErrors = new Map<string, string>();

  // Get the aggregate error message at the bottom of the page
  const aggregateError = await getAggregateValidationError(page);
  if (aggregateError) {
    allErrors.push(aggregateError);
  }

  // Collect field-specific errors from helper text elements
  // These have id="${linkId}-helper-text"
  const helperTexts = page.locator('[id$="-helper-text"]');
  const helperCount = await helperTexts.count();

  for (let i = 0; i < helperCount; i++) {
    const helperElement = helperTexts.nth(i);
    const id = await helperElement.getAttribute('id');
    if (!id || id === 'form-error-helper-text') {
      continue; // Skip the aggregate error, already captured
    }

    const text = await helperElement.textContent();
    if (text && text.trim()) {
      const errorText = text.trim();
      // Extract linkId from the helper text id (remove "-helper-text" suffix)
      const linkId = id.replace(/-helper-text$/, '');
      fieldErrors.set(linkId, errorText);
      if (!allErrors.includes(errorText)) {
        allErrors.push(errorText);
      }
    }
  }

  return {
    allErrors,
    fieldErrors,
    aggregateError,
  };
}

/**
 * Generic field filler that routes to the appropriate method based on field type
 */
export async function fillFieldByType(page: Page, config: FieldFillConfig): Promise<void> {
  const { type, locator, value, preferredElement, radioGroupLabelledBy } = config;

  if (value == null) {
    return;
  }

  switch (type) {
    case 'string':
    case 'text':
      await fillStringField(locator, value);
      break;

    case 'integer':
    case 'decimal':
      await fillNumericField(locator, value);
      break;

    case 'date':
      await fillDateField(page, value);
      break;

    case 'choice':
      // eslint-disable-next-line no-case-declarations
      const isRadio = preferredElement === 'Radio' || preferredElement === 'Radio List';
      if (isRadio && radioGroupLabelledBy) {
        await fillRadioChoice(page, value, radioGroupLabelledBy);
      } else {
        await fillChoiceDropdown(page, locator, value);
      }
      break;

    case 'boolean':
      // eslint-disable-next-line no-case-declarations
      const boolValue =
        typeof value === 'string' ? value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' : value;
      if (boolValue && radioGroupLabelledBy) {
        await fillCheckbox(page, radioGroupLabelledBy.replace('-label', ''), boolValue);
      }
      break;

    default:
      // Fallback to text fill
      await locator.fill(String(value));
  }
}
