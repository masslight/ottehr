import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { PageWithTablePagination } from './PageWithTablePagination';

export class PatientsPage extends PageWithTablePagination {
  #page: Page;

  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async searchByLastName(name: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByLastNameField).locator('input').fill(name);
  }

  async searchByGivenNames(names: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patients.searchByGivenNamesField).locator('input').fill(names);
  }

  async searchByDateOfBirth(dateOfBirth: string): Promise<void> {
    const locator = this.#page.getByTestId(dataTestIds.patients.searchByDateOfBirthField).locator('input');
    await locator.click();
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
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByLastNameField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByGivenNamesField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByDateOfBirthField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByPhoneField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByAddressField).locator('input')).toBeEmpty();
    await expect(this.#page.getByTestId(dataTestIds.patients.searchByEmailField).locator('input')).toBeEmpty();
  }

  async verifyPatientPresent(patientInfo: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    email?: string;
    phoneNumber?: string;
    address?: string;
  }): Promise<void> {
    const patientPresent = await this.findInPages(
      async () => {
        // Get all rows matching the search results prefix
        const allRows = await this.#page
          .getByTestId(new RegExp(`^${dataTestIds.patients.searchResultsRowPrefix}`))
          .all();

        if (allRows.length === 0) {
          return false;
        }

        // Check each row to find a match
        for (const rowLocator of allRows) {
          try {
            const rowPatientName = await rowLocator.getByTestId(dataTestIds.patients.patientName).innerText();
            const rowPatientDateOfBirth = await rowLocator
              .getByTestId(dataTestIds.patients.patientDateOfBirth)
              .innerText();
            const rowPatientEmail = await rowLocator.getByTestId(dataTestIds.patients.patientEmail).innerText();
            const rowPatientPhoneNumber = await rowLocator
              .getByTestId(dataTestIds.patients.patientPhoneNumber)
              .innerText();
            const rowPatientAddress = await rowLocator.getByTestId(dataTestIds.patients.patientAddress).innerText();

            // Build checks for provided fields only
            const checks: boolean[] = [];

            if (patientInfo.lastName !== undefined || patientInfo.firstName !== undefined) {
              let nameMatch = false;

              if (patientInfo.lastName && patientInfo.firstName) {
                // If both provided, expect exact match in "LastName, FirstName" format
                const expectedName = `${patientInfo.lastName}, ${patientInfo.firstName}`;
                nameMatch = rowPatientName === expectedName;
              } else if (patientInfo.lastName) {
                // If only last name provided, check if row name starts with it (before comma)
                nameMatch = rowPatientName.startsWith(`${patientInfo.lastName},`);
              } else if (patientInfo.firstName) {
                // If only first name provided, check if it appears after the comma
                nameMatch = rowPatientName.includes(`, ${patientInfo.firstName}`);
              }

              checks.push(nameMatch);
            }

            if (patientInfo.dateOfBirth !== undefined) {
              const dobMatch = rowPatientDateOfBirth === patientInfo.dateOfBirth;
              checks.push(dobMatch);
            }

            if (patientInfo.email !== undefined) {
              const emailMatch = rowPatientEmail === patientInfo.email;
              checks.push(emailMatch);
            }

            if (patientInfo.phoneNumber !== undefined) {
              const normalizedExpectedPhone = patientInfo.phoneNumber.replace(/[^\d]/g, '');
              const normalizedActualPhone = rowPatientPhoneNumber.replace(/^(\+1)/, '').replace(/[^\d]/g, '');
              const phoneMatch = normalizedActualPhone === normalizedExpectedPhone;
              checks.push(phoneMatch);
            }

            if (patientInfo.address !== undefined) {
              const addressMatch = rowPatientAddress === patientInfo.address;
              checks.push(addressMatch);
            }

            // If all provided fields match, we found the patient
            if (checks.length > 0 && checks.every((check) => check === true)) {
              console.log(`✅ Patient found matching all provided criteria`);
              return true;
            }
          } catch {
            // Skip rows that don't have all expected elements
            continue;
          }
        }

        return false;
      },
      async () => {
        // Ensure search results update after response is received
        await this.#page
          .getByTestId(/search-result-row-/i)
          .first()
          .waitFor({ state: 'attached' });
      }
    );

    await expect.soft(patientPresent).toBe(true);
  }
}

export async function expectPatientsPage(page: Page): Promise<PatientsPage> {
  await page.waitForURL('/patients');
  await page.locator('p').getByText('Set up search filter and press Search to find patients').isVisible();
  return new PatientsPage(page);
}
