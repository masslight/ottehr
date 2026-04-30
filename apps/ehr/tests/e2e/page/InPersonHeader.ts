import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { expectPatientRecordPage, PatientRecordPage } from './PatientRecordPage';

export class InPersonHeader {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyStatus(status: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.appointmentStatus)).toHaveText(status, {
      timeout: 30000,
    });
  }

  async changeStatus(status: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inPersonHeader.appointmentStatus).click();
    await this.#page.getByRole('option', { name: status, exact: true }).click();
    await this.verifyStatus(status);
  }

  async selectIntakePractitioner(id?: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inPersonHeader.intakePractitionerInput).click();
    if (id) {
      await this.#page.locator(`[data-value="${id}"]`).click();
    } else {
      await this.#page.getByRole('option').filter({ hasText: /\S/ }).first().waitFor();
      await this.#page.getByRole('option').filter({ hasText: /\S/ }).first().click();
    }
    await expect(
      this.#page.getByTestId(dataTestIds.inPersonHeader.intakePractitionerInput).locator('input')
    ).toBeEnabled();
  }

  async selectProviderPractitioner(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inPersonHeader.providerPractitionerInput).click();
    await this.#page.getByRole('option').filter({ hasText: /\S/ }).first().waitFor();
    await this.#page.getByRole('option').filter({ hasText: /\S/ }).first().click();
    await expect(
      this.#page.getByTestId(dataTestIds.inPersonHeader.providerPractitionerInput).locator('input')
    ).toBeEnabled();
  }

  async verifyWeight(weight: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.weight)).toHaveText(`${weight}kg`, {
      timeout: 30000,
    });
  }

  async verifyWeightPatientRefused(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.weight)).toHaveText('Weight: Patient Refused', {
      timeout: 30000,
    });
  }

  async verifyWeightNotShown(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.weight)).toHaveCount(0, {
      timeout: 30000,
    });
  }

  async clickPatientName(patientId: string): Promise<PatientRecordPage> {
    const btn = this.#page.getByTestId(dataTestIds.inPersonHeader.patientName);
    await btn.click();

    return expectPatientRecordPage(patientId, this.#page);
  }
}
