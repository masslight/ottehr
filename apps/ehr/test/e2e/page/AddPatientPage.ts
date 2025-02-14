import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class AddPatientPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async selectOffice(officeName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dashboard.locationSelect).click();
    await this.#page.getByText(new RegExp(officeName, 'i')).click();
  }

  async enterMobilePhone(phone: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.mobilePhoneInput).locator('input').fill(phone);
  }

  async verifyMobilePhoneNumberValidationErrorShown(): Promise<void> {
    await expect(this.#page.locator('p:text("Phone number must be 10 digits")')).toBeVisible();
  }

  async verifySearchForPatientsErrorShown(): Promise<void> {
    await expect(this.#page.locator('p:text("Please search for patients before adding")')).toBeVisible();
  }

  async clickSearchForPatientsButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.searchForPatientsButton).click();
  }

  async clickAddButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.addButton).click();
  }

  async clickCancelButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.cancelButton).click();
  }

  async verifyPageStillOpened(): Promise<void> {
    await this.#page.waitForTimeout(1000);
    await expectAddPatientPage(this.#page);
  }

  async clickPatientNotFoundButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.patientNotFoundButton).click();
  }

  async enterFirstName(firstName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.firstNameInput).locator('input').fill(firstName);
  }

  async enterLastName(lastName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.lastNameInput).locator('input').fill(lastName);
  }

  async enterDateOfBirth(dateOfBirth: string): Promise<void> {
    const locator = this.#page.locator('[placeholder="MM/DD/YYYY"]');
    await locator.click();
    await this.#page.waitForTimeout(2000);
    // just because of date input for some reason not accepting wrong date
    await locator.pressSequentially(dateOfBirth);
  }

  async selectSexAtBirth(sexAtBirth: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.sexAtBirthDropdown).click();
    await this.#page.getByText(sexAtBirth, { exact: true }).click();
  }

  async selectReasonForVisit(reasonForVisit: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.reasonForVisitDropdown).click();
    await this.#page.getByText(reasonForVisit).click();
  }

  async selectVisitType(visitType: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.visitTypeDropdown).click();
    await this.#page.getByText(visitType).click();
  }

  async verifyDateFormatValidationErrorShown(): Promise<void> {
    await expect(this.#page.locator('p:text("please enter date in format MM/DD/YYYY")')).toBeVisible();
  }

  async selectExistingPatient(existingPatient: string): Promise<void> {
    await this.#page.getByLabel(existingPatient).first().check();
  }

  async clickPrefillForButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.addPatientPage.prefillForButton).click();
  }

  async verifyPrefilledPatientName(patientName: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientName).getByText(patientName)
    ).toBeVisible();
  }

  async verifyPrefilledPatientBirthday(patientBirthday: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientBirthday).getByText(patientBirthday)
    ).toBeVisible();
  }

  async verifyPrefilledPatientBirthSex(patientBirthSex: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientBirthSex).getByText(patientBirthSex)
    ).toBeVisible();
  }

  async verifyPrefilledPatientEmail(patientEmail: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.addPatientPage.prefilledPatientEmail).getByText(patientEmail)
    ).toBeVisible();
  }

  async selectFirstAvailableSlot(): Promise<string> {
    const buttonLocator = this.#page.getByTestId(dataTestIds.slots.slot).first();
    await buttonLocator.click();
    return (await buttonLocator.textContent()) ?? '';
  }
  async clickCloseSelectDateWarningDialog(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.closeButton).click();
  }
}

export async function expectAddPatientPage(page: Page): Promise<AddPatientPage> {
  await page.waitForURL(`/visits/add`);
  await expect(page.locator('h3').getByText('Add Patient')).toBeVisible();
  return new AddPatientPage(page);
}
