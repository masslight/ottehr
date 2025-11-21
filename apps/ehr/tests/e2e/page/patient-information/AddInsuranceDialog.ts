import { expect, Locator } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export class AddInsuranceDialog {
  #container: Locator;

  constructor(container: Locator) {
    this.#container = container;
  }

  async selectInsuranceType(type: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.type).click();
    await this.#container.page().locator(`li:text("${type}")`).click();
  }

  async selectInsuranceCarrier(insuranceCarrier: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.insuranceCarrier).click();
    await this.#container.page().locator(`li:text("${insuranceCarrier}")`).click();
  }

  async selectPlanType(planType: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.planType).click();
    await this.#container.page().locator(`li:text("${planType}")`).click();
  }

  async enterMemberId(memberId: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.memberId).locator('input').fill(memberId);
  }

  async clearMemberId(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.memberId).locator('input').clear();
  }

  async enterPolicyHolderFirstName(firstName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.addInsuranceDialog.policyHoldersFirstName)
      .locator('input')
      .fill(firstName);
  }

  async clearPolicyHolderFirstName(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.policyHoldersFirstName).locator('input').clear();
  }

  async enterPolicyHolderMiddleName(middleName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.addInsuranceDialog.policyHoldersMiddleName)
      .locator('input')
      .fill(middleName);
  }

  async clearPolicyHolderMiddleName(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.policyHoldersMiddleName).locator('input').clear();
  }

  async enterPolicyHolderLastName(lastName: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.addInsuranceDialog.policyHoldersLastName)
      .locator('input')
      .fill(lastName);
  }

  async clearPolicyHolderLastName(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.policyHoldersLastName).locator('input').clear();
  }

  async enterDateOfBirthFromAddInsuranceDialog(dateOfBirth: string): Promise<void> {
    const locator = this.#container
      .getByTestId(dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth)
      .locator('input');
    await locator.click();
    await locator.pressSequentially(dateOfBirth);
  }

  async clearDateOfBirthFromAddInsuranceDialog(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.policyHoldersDateOfBirth).locator('input').clear();
  }

  async selectPolicyHoldersBirthSex(birthSex: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.policyHoldersSex).click();
    await this.#container.page().locator(`li:text-is("${birthSex}")`).click();
  }

  async enterPolicyHolderStreetAddress(street: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.streetAddress).locator('input').fill(street);
  }

  async clearPolicyHolderStreetAddress(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.streetAddress).locator('input').clear();
  }

  async enterPolicyHolderAddressLine2(addressLine2: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.addressLine2).locator('input').fill(addressLine2);
  }

  async enterPolicyHolderCity(city: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.city).locator('input').fill(city);
  }

  async clearPolicyHolderCity(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.city).locator('input').clear();
  }

  async selectPolicyHoldersState(state: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.state).click();
    await this.#container.page().locator(`li:text("${state}")`).click();
  }

  async enterZipFromAddInsuranceDialog(zip: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.zip).locator('input').fill(zip);
  }

  async clearZipFromAddInsuranceDialog(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.zip).locator('input').clear();
  }

  async verifyValidationErrorZipFieldFromAddInsurance(): Promise<void> {
    await expect(
      this.#container.getByTestId(dataTestIds.addInsuranceDialog.zip).locator('p:text("Must be 5 digits")')
    ).toBeVisible();
  }

  async selectPatientsRelationship(relationship: string): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.relationship).click();
    await this.#container.page().locator(`li:text("${relationship}")`).click();
  }

  async enterAdditionalInsuranceInformation(additionalInfo: string): Promise<void> {
    await this.#container
      .getByTestId(dataTestIds.addInsuranceDialog.additionalInformation)
      .locator('input')
      .fill(additionalInfo);
  }

  async clickAddInsuranceButtonFromAddInsuranceDialog(): Promise<void> {
    await this.#container.getByTestId(dataTestIds.addInsuranceDialog.addInsuranceButton).click();
  }

  async verifyValidationErrorShown(testId: string): Promise<void> {
    await expect(this.#container.getByTestId(testId).locator('p:text("This field is required")')).toBeVisible();
  }

  async verifyTypeField(value: string, enabled: boolean): Promise<void> {
    const locator = this.#container.getByTestId(dataTestIds.addInsuranceDialog.type).locator('input');
    await expect(locator).toHaveValue(value);
    await expect(locator).toBeEnabled({ enabled });
  }
}
