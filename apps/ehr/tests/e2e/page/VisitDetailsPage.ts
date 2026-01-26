import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class VisitDetailsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickCancelVisitButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelVisitButton).click();
  }

  async selectCancelationReason(cancelationReason: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelationReasonDropdown).click();
    await this.#page.getByText(cancelationReason).click();
  }

  async clickCancelButtonFromDialogue(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelVisitDialogue).click();
  }

  async verifySsnDisplayed(expectedSsn: string): Promise<void> {
    // SSN field is in the "About the patient" section with key 'patient-ssn'
    const ssnInput = this.#page.locator('input[name="patient-ssn"]');
    await ssnInput.scrollIntoViewIfNeeded();
    await expect(ssnInput).toBeVisible();
    await expect(ssnInput).toHaveValue(expectedSsn);
  }

  async editSsn(newSsn: string): Promise<void> {
    // Find and click the SSN input field
    const ssnInput = this.#page.locator('input[name="patient-ssn"]');
    await ssnInput.scrollIntoViewIfNeeded();
    await ssnInput.fill(newSsn);
  }

  async clickSaveChanges(): Promise<void> {
    // Find and click the "Save changes" button in the patient record form
    const saveButton = this.#page.getByRole('button', { name: /save changes/i });
    await saveButton.click();
  }

  async waitForSaveSuccess(): Promise<void> {
    // Wait for success notification
    await expect(this.#page.getByText(/patient information updated successfully/i)).toBeVisible({ timeout: 10000 });
  }
}

export async function expectVisitDetailsPage(page: Page, appointmentId: string): Promise<VisitDetailsPage> {
  await page.waitForURL(new RegExp('/visit/' + appointmentId));
  return new VisitDetailsPage(page);
}
