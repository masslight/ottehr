import { expect, Locator, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class DischargeDialog {
  readonly #dialog: Locator;

  private constructor(page: Page) {
    this.#dialog = page.getByRole('dialog');
  }

  static async expectOpen(page: Page): Promise<DischargeDialog> {
    const dischargeDialog = new DischargeDialog(page);
    await expect(dischargeDialog.#dialog).toBeVisible();
    await expect(dischargeDialog.#dialog.getByText('Discharge', { exact: true })).toBeVisible();
    await expect(dischargeDialog.#dialog.getByText('Print documents', { exact: true })).toBeVisible();
    await expect(dischargeDialog.#dialog.getByText('Review & Sign', { exact: true })).toBeVisible();
    return dischargeDialog;
  }

  async verifyPrintOptions(): Promise<void> {
    await expect(this.checkbox(dataTestIds.dischargeDialog.printDischargeSummaryCheckbox)).toBeVisible();
    await expect(this.checkbox(dataTestIds.dischargeDialog.printPatientInstructionsCheckbox)).toBeVisible();
    await expect(this.checkbox(dataTestIds.dischargeDialog.printWorkNoteCheckbox)).toBeVisible();
    await expect(this.checkbox(dataTestIds.dischargeDialog.printSchoolNoteCheckbox)).toBeVisible();
    await expect(this.checkbox(dataTestIds.dischargeDialog.printProgressNoteCheckbox)).toBeVisible();
  }

  async verifyReviewAndSignDefaults(): Promise<void> {
    const signProgressNote = this.checkboxInput(dataTestIds.dischargeDialog.signProgressNoteCheckbox);
    await expect(signProgressNote).toBeEnabled();
    await expect(signProgressNote).not.toBeChecked();

    const supervisorApproval = this.checkbox(dataTestIds.dischargeDialog.supervisorApprovalCheckbox);
    if (await supervisorApproval.isVisible()) {
      const supervisorApprovalInput = this.checkboxInput(dataTestIds.dischargeDialog.supervisorApprovalCheckbox);
      await expect(supervisorApprovalInput).toBeDisabled();
      await expect(supervisorApprovalInput).not.toBeChecked();
    }
  }

  async verifyActionLabel(label: string): Promise<void> {
    await expect(this.confirmButton()).toHaveText(label);
  }

  async setDischargeSummary(checked: boolean): Promise<void> {
    await this.setCheckbox(dataTestIds.dischargeDialog.printDischargeSummaryCheckbox, checked);
  }

  async setProgressNote(checked: boolean): Promise<void> {
    await this.setCheckbox(dataTestIds.dischargeDialog.printProgressNoteCheckbox, checked);
  }

  async setSignProgressNote(checked: boolean): Promise<void> {
    await this.setCheckbox(dataTestIds.dischargeDialog.signProgressNoteCheckbox, checked);
  }

  async disableSupervisorApprovalIfAvailable(): Promise<void> {
    const supervisorApproval = this.checkbox(dataTestIds.dischargeDialog.supervisorApprovalCheckbox);
    if (await supervisorApproval.isVisible()) {
      const supervisorApprovalInput = this.checkboxInput(dataTestIds.dischargeDialog.supervisorApprovalCheckbox);
      await expect(supervisorApprovalInput).toBeEnabled();
      await expect(supervisorApprovalInput).toBeChecked();
      await supervisorApproval.click();
      await expect(supervisorApprovalInput).not.toBeChecked();
    }
  }

  async confirm(): Promise<void> {
    await this.confirmButton().click();
    await expect(this.#dialog).not.toBeVisible({ timeout: 60_000 });
  }

  checkbox(testId: string): Locator {
    return this.#dialog.getByTestId(testId);
  }

  checkboxInput(testId: string): Locator {
    return this.checkbox(testId).locator('input');
  }

  private async setCheckbox(testId: string, checked: boolean): Promise<void> {
    const checkbox = this.checkbox(testId);
    const input = this.checkboxInput(testId);
    await expect(input).toBeEnabled();
    if ((await input.isChecked()) !== checked) {
      await checkbox.click();
    }
    await expect(input).toBeChecked({ checked });
  }

  confirmButton(): Locator {
    return this.#dialog.getByTestId(dataTestIds.dischargeDialog.confirmButton);
  }
}
