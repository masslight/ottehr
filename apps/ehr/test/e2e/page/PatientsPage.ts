import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PageWithTablePagination } from './PageWithTablePagination';

export class PatientsPage extends PageWithTablePagination {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async searchByName(name: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByNameField).locator('input').fill(name);
  }

  async searchByDateOfBirth(dateOfBirth: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.patients.searchByDateOfBirthField).locator('input');
    await locator.click();
    await this.#page.waitForTimeout(2000);
    await locator.fill(dateOfBirth);
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
    const patientPresent = await this.findInPages(
      async () => {
        const rowLocator = this.#page.getByTestId(dataTestIds.patients.searchResultRow(patientInfo.id));
        if (!(await rowLocator.isVisible())) return Promise.resolve(false);
        const rowPatientId = await rowLocator.getByTestId(dataTestIds.patients.patientId).innerText();
        const rowPatientName = await rowLocator.getByTestId(dataTestIds.patients.patientName).innerText();
        const rowPatientDateOfBirth = await rowLocator.getByTestId(dataTestIds.patients.patientDateOfBirth).innerText();
        const rowPatientEmail = await rowLocator.getByTestId(dataTestIds.patients.patientEmail).innerText();
        const rowPatientPhoneNumber = await rowLocator.getByTestId(dataTestIds.patients.patientPhoneNumber).innerText();
        const rowPatientAddress = await rowLocator.getByTestId(dataTestIds.patients.patientAddress).innerText();
        return new Promise((resolve) => {
          if (
            rowPatientId === patientInfo.id &&
            rowPatientName === patientInfo.lastName + ' ' + patientInfo.firstName &&
            rowPatientDateOfBirth === patientInfo.dateOfBirth &&
            rowPatientEmail === patientInfo.email &&
            rowPatientPhoneNumber === patientInfo.phoneNumber &&
            rowPatientAddress === patientInfo.address
          ) {
            resolve(true);
          }
          resolve(false);
        });
      },
      async () => {
        // Wait for the backend API call to complete
        await this.#page.waitForResponse(
          (response) => response.url().includes('/Patient?') && response.status() === 200
        );

        // Ensure search results update after response is received
        await this.#page
          .getByTestId(/search-result-row-/i)
          .first()
          .waitFor({ state: 'attached' });
      }
    );

    expect(patientPresent).toBe(true);
  }
}

export async function expectPatientsPage(page: Page): Promise<PatientsPage> {
  await page.waitForURL('/patients');
  await page.locator('p').getByText('Set up search filter and press Search to find patients').isVisible();
  return new PatientsPage(page);
}
