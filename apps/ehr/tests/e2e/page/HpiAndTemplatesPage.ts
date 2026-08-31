import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { waitForSnackbar } from '../../e2e-utils/helpers/tests-utils';
import { InPersonHeader } from './InPersonHeader';
import { SideMenu } from './SideMenu';

const DEFAULT_TIMEOUT = { timeout: 30000 };

export class HpiAndTemplatesPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  inPersonHeader(): InPersonHeader {
    return new InPersonHeader(this.#page);
  }

  sideMenu(): SideMenu {
    return new SideMenu(this.#page);
  }

  async fillHPI(text?: string): Promise<void> {
    const hpiTextField = this.#page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes);
    await expect(hpiTextField).toBeVisible();
    await hpiTextField
      .locator('textarea')
      .first()
      .fill(text ?? 'The patient reports having a cough for 3 days.');
  }

  async verifyHpiContent(expectedText: string): Promise<void> {
    const hpiTextField = this.#page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiNotes);
    await expect(hpiTextField.locator('textarea').first()).toHaveValue(expectedText, DEFAULT_TIMEOUT);
  }

  async createTemplateFromNote(templateName: string): Promise<void> {
    const autocomplete = this.#page.locator('#template-select');
    await autocomplete.click();

    // Click the "Add or Update Template From Note" option
    const addOption = this.#page.getByRole('option', { name: /Add or Update Template From Note/ });
    await expect(addOption).toBeVisible(DEFAULT_TIMEOUT);
    await addOption.click();

    // Fill template name in the dialog
    const dialog = this.#page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

    const nameField = dialog.getByLabel('Template name');
    await nameField.fill(templateName);

    // Click Save
    await dialog.getByRole('button', { name: 'Save' }).click();

    await waitForSnackbar(this.#page);
  }

  async applyTemplate(templateName: string): Promise<void> {
    // #template-select is the input element itself (MUI Autocomplete applies the id to the input)
    const input = this.#page.locator('#template-select');
    await input.click();
    await input.fill(templateName);

    // Select the matching template option
    const option = this.#page.getByRole('option', { name: templateName });
    await expect(option).toBeVisible(DEFAULT_TIMEOUT);
    await option.click();

    // Confirm the apply dialog
    const dialog = this.#page.getByRole('dialog');
    await expect(dialog).toBeVisible(DEFAULT_TIMEOUT);

    const applyButton = dialog.getByRole('button', { name: 'Apply Template' });
    await expect(applyButton).toBeVisible(DEFAULT_TIMEOUT);
    await applyButton.click();
    await waitForSnackbar(this.#page);
  }
}

export async function expectHpiAndTemplatesPage(page: Page): Promise<HpiAndTemplatesPage> {
  await page.waitForURL(new RegExp(`/in-person/.*/history-of-present-illness-and-templates`), { timeout: 10000 });
  await expect(page.getByTestId(dataTestIds.hpiAndTemplatesPage.hpiTitle)).toBeVisible();
  return new HpiAndTemplatesPage(page);
}
