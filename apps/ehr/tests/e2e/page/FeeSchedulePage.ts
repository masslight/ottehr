import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export class FeeSchedulePage {
  constructor(private page: Page) {}

  async goto(feeScheduleId: string): Promise<void> {
    await this.page.goto(`/admin/fee-schedule/${feeScheduleId}`);
    await this.waitForProcedureCodesLoaded();
  }

  async gotoChargeMaster(chargeMasterId: string): Promise<void> {
    await this.page.goto(`/admin/charge-masters/${chargeMasterId}`);
    await this.waitForProcedureCodesLoaded();
  }

  async waitForProcedureCodesLoaded(): Promise<void> {
    await this.page.getByRole('tab', { name: 'Procedure Codes' }).click();
    await expect(this.page.getByTestId(dataTestIds.procedureCodes.addButton)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async clickAddProcedureCode(): Promise<void> {
    await this.page.getByTestId(dataTestIds.procedureCodes.addButton).click();
    await expect(this.page.getByRole('heading', { name: 'Add Procedure Code' })).toBeVisible(DEFAULT_TIMEOUT);
  }

  async fillProcedureCodeForm(code: string, amount: string, modifier?: string): Promise<void> {
    // Type code into autocomplete and press Enter to confirm freeSolo value
    const codeInput = this.page.getByLabel(/code \(cpt\/hcpcs\)/i);
    await codeInput.fill(code);
    await codeInput.press('Enter');

    if (modifier) {
      await this.page.getByTestId(dataTestIds.procedureCodes.modifierInput).getByRole('textbox').fill(modifier);
    }

    const amountInput = this.page.getByLabel(/amount/i);
    await amountInput.clear();
    await amountInput.fill(amount);
  }

  async clickSave(): Promise<void> {
    await this.page.getByTestId(dataTestIds.procedureCodes.saveButton).click();
  }

  async expectSnackbar(text: string | RegExp): Promise<void> {
    await expect(this.page.locator('.notistack-SnackbarContainer').getByText(text)).toBeVisible(DEFAULT_TIMEOUT);
  }

  async searchProcedureCodes(query: string): Promise<void> {
    await this.page.getByTestId(dataTestIds.procedureCodes.searchInput).getByRole('textbox').fill(query);
  }

  async uploadCsv(csvContent: string): Promise<void> {
    const fileInput = this.page.locator('input[type="file"][accept=".csv"]');
    const buffer = Buffer.from(csvContent, 'utf-8');
    await fileInput.setInputFiles({
      name: 'test-upload.csv',
      mimeType: 'text/csv',
      buffer,
    });
  }

  async expectUploadPreviewOpen(): Promise<void> {
    await expect(this.page.getByText('Upload Preview')).toBeVisible(DEFAULT_TIMEOUT);
  }

  async clickImportDelta(): Promise<void> {
    await this.page.getByTestId(dataTestIds.procedureCodes.importDeltaButton).click();
  }

  async clickReplaceAll(): Promise<void> {
    await this.page.getByTestId(dataTestIds.procedureCodes.replaceAllButton).click();
  }
}
