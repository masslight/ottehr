import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class EditNoteDialog {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyMessage(message: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.dialog.message)).toHaveText(message);
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.editNoteDialog.title)).toHaveText(title);
  }

  async clickProceedButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.cancelButton).click();
  }

  async clearNote(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editNoteDialog.message).locator('input').clear();
  }

  async enterNote(note: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.editNoteDialog.message).locator('input').fill(note);
  }
}

export async function expectEditNoteDialog(page: Page): Promise<EditNoteDialog> {
  await page.getByTestId(dataTestIds.dialog.title).isVisible();
  return new EditNoteDialog(page);
}
