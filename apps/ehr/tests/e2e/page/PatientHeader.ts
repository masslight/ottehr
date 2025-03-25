import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PatientHeader {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async verifyHeaderPatientID(patientID: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientId)).toHaveText(patientID);
    return this;
  }

  async verifyHeaderPatientName(patientName: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientName)).toHaveText(patientName);
    return this;
  }

  async verifyHeaderPatientBirthSex(patientBirthSex: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientBirthSex)).toHaveText(patientBirthSex);
    return this;
  }
  async verifyHeaderPatientBirthday(patientBirthday: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientBirthday)).toHaveText(patientBirthday);
    return this;
  }

  async verifyHeaderPatientAddress(patientAddress: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientAddress)).toHaveText(patientAddress);
    return this;
  }

  async verifyHeaderPatientPhoneNumber(patientPhoneNumber: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.patientPhoneNumber)).toHaveText(patientPhoneNumber);
    return this;
  }

  async verifyHeaderEmergencyContact(emergencyContact: string): Promise<PatientHeader> {
    await expect(this.#page.getByTestId(dataTestIds.patientHeader.emergencyContact)).toHaveText(emergencyContact);
    return this;
  }
}
