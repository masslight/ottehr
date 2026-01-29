import { expect, Locator, Page } from '@playwright/test';
import { formatPhoneNumberForQuestionnaire, PATIENT_RECORD_CONFIG } from 'utils';
import { dataTestIds } from '../../../src/constants/data-test-ids';
import { AddInsuranceDialog } from './patient-information/AddInsuranceDialog';
import { PatientHeader } from './PatientHeader';

const insuranceSection = PATIENT_RECORD_CONFIG.FormFields.insurance;

export class PatientInformationPage {
  #page: Page;
  #insuranceCards: InsuranceCard[];

  constructor(page: Page) {
    this.#page = page;
    this.#insuranceCards = [
      new InsuranceCard(page.locator(`#${insuranceSection.linkId[0]}`), insuranceSection.items[0]),
      new InsuranceCard(page.locator(`#${insuranceSection.linkId[1]}`), insuranceSection.items[1]),
    ];
  }

  async clearField(fieldKey: string): Promise<void> {
    await this.inputByName(fieldKey).clear();
  }

  getPatientHeader(): PatientHeader {
    return new PatientHeader(this.#page);
  }

  getInsuranceCard(index: number): InsuranceCard {
    return this.#insuranceCards[index];
  }

  inputByName(name: string): Locator {
    return this.#page.locator(`input[name="${name}"]`);
  }

  selectById(id: string): Locator {
    return this.#page.locator(`#${id}`);
  }

  errorForField(fieldKey: string, errorText: string): Locator {
    // First try to find error within the wrapper with ID (for regular fields)
    // Then fall back to finding it near the input by name (for grouped fields like city/state/zip)
    const wrapperSelector = this.#page.locator(`#${fieldKey}`);
    const inputSelector = this.#page.locator(`input[name="${fieldKey}"]`);

    return wrapperSelector
      .getByText(errorText)
      .or(inputSelector.locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")]').getByText(errorText));
  }

  // Generic field interaction methods

  async verifyTextFieldValue(fieldKey: string, expectedValue: string): Promise<void> {
    await expect(this.inputByName(fieldKey)).toHaveValue(expectedValue);
  }

  async enterTextFieldValue(fieldKey: string, value: string): Promise<void> {
    await this.inputByName(fieldKey).fill(value);
  }

  async verifySelectFieldValue(fieldKey: string, expectedLabel: string): Promise<void> {
    // For MUI Select/Autocomplete fields, check the visible text displayed to users
    // FormSelect uses .MuiSelect-select div with text content - use toHaveText
    // Autocomplete uses input with name attribute and value - use toHaveValue

    // Try both approaches: first check for FormSelect, then Autocomplete
    // todo: improve by detecting field type from config and passing info needed to avoid
    // the try/catch here
    try {
      // Try FormSelect first - look for .MuiSelect-select div
      const muiSelectElement = this.selectById(fieldKey).locator('.MuiSelect-select');
      await expect(muiSelectElement).toHaveText(expectedLabel, { timeout: 2000 });
    } catch {
      // Fall back to Autocomplete - check input value
      await expect(this.inputByName(fieldKey)).toHaveValue(expectedLabel);
    }
  }

  async selectFieldOption(fieldKey: string, optionName: string): Promise<void> {
    await this.selectById(fieldKey).click();
    await this.#page.getByRole('option', { name: optionName, exact: true }).click();
  }

  async verifyDateFieldValue(fieldKey: string, expectedValue: string): Promise<void> {
    await expect(this.inputByName(fieldKey)).toHaveValue(expectedValue);
  }

  async enterDateFieldValue(fieldKey: string, value: string): Promise<void> {
    const locator = this.inputByName(fieldKey);
    await locator.click();
    await locator.pressSequentially(value);
  }

  async selectBooleanField(fieldKey: string, selected: boolean): Promise<void> {
    const input = this.inputByName(fieldKey);
    const isChecked = await input.isChecked();
    if (isChecked !== selected) {
      await input.click();
    }
  }

  async verifyPhoneFieldValue(fieldKey: string, expectedValue: string): Promise<void> {
    await expect(this.inputByName(fieldKey)).toHaveValue(formatPhoneNumberForQuestionnaire(expectedValue));
  }

  async enterPhoneFieldValue(fieldKey: string, value: string): Promise<void> {
    await this.inputByName(fieldKey).fill(value);
  }

  async clearPhoneField(fieldKey: string): Promise<void> {
    await this.selectById(fieldKey).click();
    for (let i = 0; i <= 20; i++) {
      await this.#page.keyboard.press('Backspace');
    }
  }

  async verifyFieldIsVisible(fieldKey: string): Promise<void> {
    await this.inputByName(fieldKey).isVisible();
  }

  async verifyFieldIsHidden(fieldKey: string): Promise<void> {
    await this.inputByName(fieldKey).isHidden();
  }

  async verifyFieldIsEnabled(fieldKey: string): Promise<void> {
    await expect(this.inputByName(fieldKey)).toBeEnabled();
  }

  async verifyBooleanFieldHasExpectedValue(identifier: string, selected: boolean): Promise<void> {
    if (selected) {
      await expect(this.inputByName(identifier)).toBeChecked();
    } else {
      await expect(this.inputByName(identifier)).not.toBeChecked();
    }
  }

  async selectReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown).click();
    await this.#page.getByRole('option', { name: releaseOfInfo, exact: true }).click();
  }

  async verifyReleaseOfInfo(releaseOfInfo: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.userSettingsContainer.releaseOfInfoDropdown)).toHaveText(
      releaseOfInfo
    );
  }

  async selectRxHistoryConsent(rxHistoryConsent: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).click();
    await this.#page.getByRole('option', { name: rxHistoryConsent, exact: true }).click();
  }

  async verifyRxHistoryConsent(rxHistoryConsent: string): Promise<void> {
    await expect(
      this.#page.getByTestId(dataTestIds.userSettingsContainer.RxHistoryConsentDropdown).locator('input')
    ).toHaveValue(rxHistoryConsent);
  }

  async reloadPatientInformationPage(): Promise<void> {
    await this.#page.reload();
  }

  async clickSaveChangesButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.saveChangesButton).click();
    //await this.#page.waitForSelector('text=State was updated successfully');
  }

  async verifyUpdatedSuccessfullyMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Patient information updated successfully')).toBeVisible();
  }

  async verifyLoadingScreenIsNotVisible(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.loadingScreen).waitFor({ state: 'detached' });
  }

  async clickAddInsuranceButton(): Promise<AddInsuranceDialog> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.addInsuranceButton).click();
    await this.#page.getByTestId(dataTestIds.addInsuranceDialog.id).isVisible();
    return new AddInsuranceDialog(this.#page.getByTestId(dataTestIds.addInsuranceDialog.id));
  }

  async verifyAddInsuranceButtonIsHidden(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.addInsuranceButton).isHidden();
  }

  async verifyCoverageAddedSuccessfullyMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Coverage added to patient account successfully.')).toBeVisible();
  }

  async verifyCoverageRemovedMessageShown(): Promise<void> {
    await expect(this.#page.getByText('Coverage removed from patient account')).toBeVisible();
  }

  async clickCloseButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientHeader.closeButton).click();
  }

  async clickPatientNameBreadcrumb(patientName: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.breadcrumb).getByText(patientName).click();
  }

  async clickPatientsBreadcrumb(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.patientInformationPage.breadcrumb).getByText('Patients').click();
  }

  async verifyRequiredFieldValidationErrorShown(fieldKey: string): Promise<void> {
    // Try to find error message using multiple strategies:
    // 1. Find by wrapper ID and look for error in wrapper
    // 2. Find by wrapper ID and look for error in its MuiFormControl
    // 3. Find by input name and traverse to MuiFormControl
    const wrapperLocator = this.#page.locator(`#${fieldKey}`);
    const inputLocator = this.inputByName(fieldKey);

    const errorByWrapper = wrapperLocator.locator('p:text("This field is required")');
    const errorByWrapperFormControl = wrapperLocator
      .locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")]')
      .locator('p:text("This field is required")');
    const errorByInput = inputLocator
      .locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")]')
      .locator('p:text("This field is required")');

    await expect(errorByWrapper.or(errorByWrapperFormControl).or(errorByInput)).toBeVisible();
  }

  async verifyFieldError(fieldKey: string, errorMessage: string): Promise<void> {
    await expect(this.errorForField(fieldKey, errorMessage)).toBeVisible();
  }
}

export class InsuranceCard {
  #container: Locator;
  #insuranceItems: (typeof insuranceSection.items)[0];

  constructor(container: Locator, insuranceItems: (typeof insuranceSection.items)[0]) {
    this.#container = container;
    this.#insuranceItems = insuranceItems;
  }

  inputByName(name: string): Locator {
    return this.#container.locator(`input[name="${name}"]`);
  }

  selectById(id: string): Locator {
    return this.#container.locator(`#${id}`);
  }

  async waitUntilInsuranceCarrierIsRendered(): Promise<void> {
    await expect(this.selectById(this.#insuranceItems.insuranceCarrier.key).locator('input')).not.toHaveValue('');
  }

  async verifyInsuranceType(type: string): Promise<void> {
    await expect(this.inputByName(this.#insuranceItems.insurancePriority.key)).toHaveValue(type);
  }

  async verifyInsuranceCarrier(insuranceCarrier: string): Promise<void> {
    await expect(this.selectById(this.#insuranceItems.insuranceCarrier.key).locator('input')).toHaveValue(
      insuranceCarrier
    );
  }

  async verifyAllFieldsAreVisible(): Promise<void> {
    await this.inputByName(this.#insuranceItems.insurancePriority.key).isVisible();
    await this.selectById(this.#insuranceItems.insuranceCarrier.key).locator('input').isVisible();
    await this.inputByName(this.#insuranceItems.memberId.key).isVisible();
    await this.inputByName(this.#insuranceItems.firstName.key).isVisible();
    await this.inputByName(this.#insuranceItems.middleName.key).isVisible();
    await this.inputByName(this.#insuranceItems.lastName.key).isVisible();
    await this.inputByName(this.#insuranceItems.birthDate.key).isVisible();
    await this.inputByName(this.#insuranceItems.birthSex.key).isVisible();
    await this.inputByName(this.#insuranceItems.streetAddress.key).isVisible();
    await this.inputByName(this.#insuranceItems.addressLine2.key).isVisible();
    await this.inputByName(this.#insuranceItems.city.key).isVisible();
    await this.inputByName(this.#insuranceItems.state.key).isVisible();
    await this.inputByName(this.#insuranceItems.zip.key).isVisible();
    await this.inputByName(this.#insuranceItems.relationship.key).isVisible();
    await this.inputByName(this.#insuranceItems.additionalInformation.key).isVisible();
  }

  // Generic field interaction methods
  async clearField(fieldKey: string): Promise<void> {
    await this.inputByName(fieldKey).clear();
  }

  async enterTextField(fieldKey: string, value: string): Promise<void> {
    await this.inputByName(fieldKey).fill(value);
  }

  async verifyTextField(fieldKey: string, expectedValue: string): Promise<void> {
    await expect(this.inputByName(fieldKey)).toHaveValue(expectedValue);
  }

  async selectFieldOption(fieldKey: string, optionName: string): Promise<void> {
    await this.selectById(fieldKey).click();
    await this.#container.page().getByRole('option', { name: optionName, exact: true }).click();
  }

  async enterDateField(fieldKey: string, value: string): Promise<void> {
    const locator = this.inputByName(fieldKey);
    await locator.click();
    await locator.pressSequentially(value);
  }

  async verifyValidationErrorZipFieldFromInsurance(): Promise<void> {
    const inputLocator = this.inputByName(this.#insuranceItems.zip.key);
    const formControlLocator = inputLocator.locator('xpath=ancestor::div[contains(@class, "MuiFormControl")]');
    await expect(formControlLocator.locator('p:text("Must be 5 digits")')).toBeVisible();
  }

  async selectInsuranceType(type: string): Promise<void> {
    await this.selectById(this.#insuranceItems.insurancePriority.key).click();
    await this.#container.page().getByRole('option', { name: type, exact: true }).click();
  }

  async selectInsuranceCarrier(insuranceCarrier: string): Promise<void> {
    await this.selectById(this.#insuranceItems.insuranceCarrier.key).click();
    await this.#container.page().getByRole('option', { name: insuranceCarrier, exact: true }).click();
  }

  async clickRemoveInsuranceButton(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.insuranceContainer.removeButton).click();
  }

  async verifyValidationErrorShown(fieldKey: string): Promise<void> {
    // Try to find error message using two strategies:
    // 1. Find by wrapper ID (works for most fields including selects)
    // 2. Find by input name (works for grouped fields and text inputs)
    const wrapperLocator = this.#container.locator(`#${fieldKey}`);
    const inputLocator = this.inputByName(fieldKey);

    const errorByWrapper = wrapperLocator.locator('p:text("This field is required")');
    const errorByInput = inputLocator
      .locator('xpath=ancestor::*[contains(@class, "MuiFormControl-root")]')
      .locator('p:text("This field is required")');

    await expect(errorByWrapper.or(errorByInput)).toBeVisible();
  }
}

export async function expectPatientInformationPage(page: Page, patientId: string): Promise<PatientInformationPage> {
  await page.waitForURL('/patient/' + patientId + '/info');
  await page.locator('h3').getByText('Patient Information').isVisible();
  return new PatientInformationPage(page);
}

export async function openPatientInformationPage(page: Page, patientId: string): Promise<PatientInformationPage> {
  await page.goto('/patient/' + patientId + '/info');
  return expectPatientInformationPage(page, patientId);
}
