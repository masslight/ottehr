import { expect, Locator, Page } from '@playwright/test';

/**
 * Autocomplete / Dropdown helpers
 */
export class AutocompleteHelpers {
  /**
   * Selects the first available option from an MUI Autocomplete dropdown.
   * Works with virtualized lists and dynamically loaded options.
   *
   * @param page - Playwright page instance
   * @param selector - Test ID or locator for the autocomplete component
   * @returns The text content of the selected option
   */
  static async selectFirstOption(page: Page, selector: string | Locator): Promise<string> {
    const autocomplete = typeof selector === 'string' ? page.getByTestId(selector) : selector;
    // Wait with increased timeout for async data loading (e.g., API calls)
    await expect(autocomplete).toBeVisible({ timeout: 60000 });

    // Click input to open dropdown
    const input = autocomplete.locator('input');
    await input.click();

    // Wait for listbox and options to be visible
    await page.locator('[role="listbox"]').waitFor({ state: 'visible' });
    await page.getByRole('option').first().waitFor({ state: 'visible' });

    // Get the first available option from the rendered list
    const firstOption = page.getByRole('option').first();
    const optionText = await firstOption.textContent();

    if (!optionText?.trim()) {
      throw new Error('No available options found in the dropdown');
    }

    // Click the first option
    await firstOption.click();

    return optionText.trim();
  }

  /**
   * Selects an option by exact text from an MUI Autocomplete dropdown.
   * Note: This may not work with virtualized lists if the option is not initially rendered.
   *
   * @param page - Playwright page instance
   * @param selector - Test ID or locator for the autocomplete component
   * @param optionText - Exact text of the option to select
   */
  static async selectOptionByText(page: Page, selector: string | Locator, optionText: string): Promise<void> {
    const autocomplete = typeof selector === 'string' ? page.getByTestId(selector) : selector;
    await expect(autocomplete).toBeVisible();

    // Click input to open dropdown
    const input = autocomplete.locator('input');
    await input.click();

    // Wait for listbox to be visible
    await page.locator('[role="listbox"]').waitFor({ state: 'visible' });

    // Find and click the option
    const option = page.getByRole('option').getByText(optionText, { exact: true });
    await option.click();
  }

  /**
   * Gets all visible options from an opened Autocomplete dropdown.
   * Note: For virtualized lists, this only returns currently rendered options.
   *
   * @param page - Playwright page instance
   * @returns Array of option texts
   */
  static async getVisibleOptions(page: Page): Promise<string[]> {
    const options = page.getByRole('option');
    const count = await options.count();
    const texts: string[] = [];

    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      if (text?.trim()) {
        texts.push(text.trim());
      }
    }

    return texts;
  }
}

/**
 * Form helpers
 */
export class FormHelpers {
  /**
   * Fills a text input field
   */
  static async fillInput(page: Page, selector: string | Locator, value: string): Promise<void> {
    const input = typeof selector === 'string' ? page.getByTestId(selector) : selector;
    await expect(input).toBeVisible();
    await input.fill(value);
  }

  /**
   * Clicks a checkbox
   */
  static async toggleCheckbox(page: Page, selector: string | Locator, checked: boolean): Promise<void> {
    const checkbox = typeof selector === 'string' ? page.getByTestId(selector) : selector;
    await expect(checkbox).toBeVisible();

    const isChecked = await checkbox.isChecked();
    if (isChecked !== checked) {
      await checkbox.click();
    }
  }
}

/**
 * Navigation helpers
 */
export class NavigationHelpers {
  /**
   * Clicks a button and waits for navigation or state change
   */
  static async clickAndContinue(
    page: Page,
    buttonSelector: string | Locator,
    options?: { timeout?: number }
  ): Promise<void> {
    const button = typeof buttonSelector === 'string' ? page.getByTestId(buttonSelector) : buttonSelector;
    await expect(button).toBeVisible();
    await button.click(options);
  }

  /**
   * Waits for a specific page/section to be loaded
   */
  static async waitForPageLoad(page: Page, pageIdentifier: string | Locator): Promise<void> {
    const element = typeof pageIdentifier === 'string' ? page.getByTestId(pageIdentifier) : pageIdentifier;
    await expect(element).toBeVisible({ timeout: 60000 });
  }
}

/**
 * Helpers for file upload operations
 */
export class FileUploadHelpers {
  /**
   * Handles file upload with automatic re-upload link detection
   * Checks if file was previously uploaded and clicks "Click to re-upload" if needed
   * @param page - Playwright Page object
   * @param uploadButtonSelector - Selector for the upload button (e.g., '#photo-id-front')
   * @param filePath - Absolute path to the file
   */
  static async uploadWithReuploadSupport(page: Page, uploadButtonSelector: string, filePath: string): Promise<void> {
    // Find the container for this specific upload field by looking near the button/label
    const fieldContainer = page.locator(`[for="${uploadButtonSelector.replace('#', '')}"]`).locator('..');

    // Check if "Click to re-upload" link exists within this field's container
    const reuploadLink = fieldContainer.getByText('Click to re-upload');
    const reuploadCount = await reuploadLink.count();

    if (reuploadCount > 0) {
      // Scroll the link into view to ensure it's interactable
      await reuploadLink.scrollIntoViewIfNeeded();

      // The "Click to re-upload" link triggers the hidden file input directly via ref
      // So we just need to wait for filechooser after clicking the link
      const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), reuploadLink.click()]);
      await fileChooser.setFiles(filePath);
    } else {
      // Normal upload flow: click the upload button which triggers the hidden file input
      const uploadButton = page.locator(uploadButtonSelector);
      await uploadButton.scrollIntoViewIfNeeded();

      const [fileChooser] = await Promise.all([page.waitForEvent('filechooser'), uploadButton.click()]);
      await fileChooser.setFiles(filePath);
    }
  }
}
