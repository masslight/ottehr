import { expect, Page } from '@playwright/test';
import { Patient } from 'fhir/r4b';
import { dataTestIds } from 'src/constants/data-test-ids';

export class AdministeredDialogue {
  #page: Page;
  constructor(page: Page) {
    this.#page = page;
  }

  async verifyTitle(title: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.inPersonModal.confirmationDialogue)).toHaveText(title);
  }

  async verifyPatientName(patient: Patient): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.inHouseMedicationAdministrationConfirmationDialog.patient)
    ).toHaveText('Patient: ' + patient.name?.[0]?.family + ', ' + patient.name?.[0]?.given?.[0]);
  }

  async verifyMedication(medicationInfo: {
    medication: string;
    dose: string;
    units: string;
    route: string;
  }): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.inHouseMedicationAdministrationConfirmationDialog.medication)
    ).toHaveText(
      'Medication: ' +
        medicationInfo.medication +
        ' / ' +
        medicationInfo.dose +
        ' ' +
        medicationInfo.units +
        ' / ' +
        medicationInfo.route
    );
  }

  async verifyMessage(message: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.inHouseMedicationAdministrationConfirmationDialog.message)
    ).toHaveText(message);
  }

  async selectReason(reason: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.inHouseMedicationAdministrationConfirmationDialog.reasonField).click();
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
