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

  async openCareTeam(): Promise<void> {
    const popover = this.#page.getByTestId(dataTestIds.inPersonHeader.careTeamPopover);
    if (!(await popover.isVisible())) {
      await this.#page.getByTestId(dataTestIds.inPersonHeader.careTeamButton).click();
    }
    await expect(popover).toBeVisible();
  }

  async closeCareTeam(): Promise<void> {
    const popover = this.#page.getByTestId(dataTestIds.inPersonHeader.careTeamPopover);
    // The popover only hears Escape while focus is inside it, and a select disabled during a save
    // drops focus to <body>, so press it on one of the popover's own fields.
    const field = popover.getByRole('combobox').first();
    await expect(async () => {
      if (await popover.isVisible()) await field.press('Escape', { timeout: 5000 });
      await expect(popover).toBeHidden({ timeout: 2000 });
    }).toPass({ timeout: 30000 });
  }

  async selectIntakePractitioner(id?: string): Promise<void> {
    await this.openCareTeam();
    await this.selectPractitioner(dataTestIds.inPersonHeader.intakePractitionerInput, id);
    await this.closeCareTeam();
  }

  async selectProviderPractitioner(): Promise<void> {
    await this.openCareTeam();
    await this.selectPractitioner(dataTestIds.inPersonHeader.providerPractitionerInput);
    await this.closeCareTeam();
  }

  private async selectPractitioner(testId: string, id?: string): Promise<void> {
    const field = this.#page.getByTestId(testId);
    await field.click();
    const firstOption = this.#page.getByRole('option').filter({ hasText: /\S/ }).first();
    await firstOption.waitFor();
    const option = id ? this.#page.locator(`[data-value="${id}"]`) : firstOption;
    const practitionerId = id ?? (await option.getAttribute('data-value'));
    await option.click();
    // The field takes the new value only once the assignment is saved and the appointment refetched.
    if (practitionerId) await expect(field.locator('input')).toHaveValue(practitionerId);
    await expect(field.locator('input')).toBeEnabled();
  }

  async verifyWeight(weight: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.weight)).toHaveText(weight, {
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

  async verifyPaymentText(expectedText: string): Promise<void> {
    const icon = this.#page.getByTestId(dataTestIds.inPersonHeader.payment);
    await expect(icon).toHaveAttribute('aria-label', new RegExp(expectedText), { timeout: 15000 });
    await icon.hover();
    await expect(this.#page.getByRole('tooltip')).toContainText(`Payment: ${expectedText}`);
  }

  async verifyPaymentIsUnset(): Promise<void> {
    await this.verifyPaymentText('Not set');
  }

  async verifyPaymentIsSet(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonHeader.payment)).not.toHaveAttribute(
      'aria-label',
      /Not set/,
      { timeout: 15000 }
    );
  }

  async clickPatientName(patientId: string): Promise<PatientRecordPage> {
    const btn = this.#page.getByTestId(dataTestIds.inPersonHeader.patientName);
    await btn.click();

    return expectPatientRecordPage(patientId, this.#page);
  }
}
