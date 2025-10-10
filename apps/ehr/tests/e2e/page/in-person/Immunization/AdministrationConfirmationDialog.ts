import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

export class AdministeredDialogue {
  #page: Page;
  constructor(page: Page) {
    this.#page = page;
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonModal.confirmationDialogue)).toHaveText(title);
  }

  async verifyPatientName(patientName: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.administrationConfirmationDialog.patient)).toHaveText(patientName);
  }

  async verifyVaccine(vaccine: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.administrationConfirmationDialog.vaccine)).toHaveText(vaccine);
  }

  async verifyMessage(message: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.administrationConfirmationDialog.message)).toHaveText(message);
  }

  async selectReason(reason: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.administrationConfirmationDialog.reasonField).click();
    await this.#page.getByText(reason, { exact: true }).click();
  }

  async clickMarkAsAdministeredButton(): Promise<AdministeredDialogue> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
    return await expectAdministrationConfirmationDialogue(this.#page);
  }
}

export async function expectAdministrationConfirmationDialogue(page: Page): Promise<AdministeredDialogue> {
  await expect(page.getByTestId(dataTestIds.inPersonModal.confirmationDialogue)).toBeVisible();
  return new AdministeredDialogue(page);
}
