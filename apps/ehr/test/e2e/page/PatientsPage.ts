import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class PatientsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async searchByName(name: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByNameField).locator('input').fill(name);
  }

  async searchByDateOfBirth(dateOfBirth: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.patients.searchByDateOfBirthField).locator('input');
    await locator.click();
    await this.#page.waitForTimeout(2000);
    await locator.pressSequentially(dateOfBirth);
  }

  async searchByMobilePhone(phone: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByPhoneField).locator('input').fill(phone);
  }

  async searchByAddress(address: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByAddressField).locator('input').fill(address);
  }

  async searchByEmail(email: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByEmailField).locator('input').fill(email);
  }

  async searchByStatus(statusName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByStatusName).click();
    await this.#page.getByText(new RegExp(statusName, 'i')).click();
  }

  async searchByLocation(locationName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByLocationName).click();
    await this.#page.getByText(new RegExp(locationName, 'i')).click();
  }

  async clickSearchButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchButton).click();
    await this.#page.waitForTimeout(15000);
  }

  async clickResetFiltersButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.resetFiltersButton).click();
  }

  async verifyFilterReset(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByNameField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByDateOfBirthField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByPhoneField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByAddressField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByEmailField).locator('input')).toBeEmpty();
  }

  async verifyPatientPresent(patientInfo: {
    id: string;
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    email: string;
    phoneNumber: string;
    address: string;
  }): Promise<void> {
    const rowLocator = this.#page.getByTestId(dataTestIds.patients.searchResultRow(patientInfo.id));
    const rowPatientId = await rowLocator.getByTestId(dataTestIds.patients.patientId).innerText();
    const rowPatientName = await rowLocator.getByTestId(dataTestIds.patients.patientName).innerText();
    const rowPatientDateOfBirth = await rowLocator.getByTestId(dataTestIds.patients.patientDateOfBirth).innerText();
    const rowPatientEmail = await rowLocator.getByTestId(dataTestIds.patients.patientEmail).innerText();
    const rowPatientPhoneNumber = await rowLocator.getByTestId(dataTestIds.patients.patientPhoneNumber).innerText();
    const rowPatientAddress = await rowLocator.getByTestId(dataTestIds.patients.patientAddress).innerText();
    expect(rowPatientId).toBe(patientInfo.id);
    expect(rowPatientName).toBe(patientInfo.lastName + ' ' + patientInfo.firstName);
    expect(rowPatientDateOfBirth).toBe(patientInfo.dateOfBirth);
    expect(rowPatientEmail).toBe(patientInfo.email);
    expect(rowPatientPhoneNumber).toBe(patientInfo.phoneNumber);
    expect(rowPatientAddress).toBe(patientInfo.address);
  }
}

export async function expectPatientsPage(page: Page): Promise<PatientsPage> {
  await page.waitForURL('/patients');
  await page.locator('p').getByText('Set up search filter and press Search to find patients').isVisible();
  return new PatientsPage(page);
}
