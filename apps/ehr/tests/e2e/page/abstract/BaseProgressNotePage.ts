import { expect, Page } from '@playwright/test';
import { dataTestIds } from '../../../../src/constants/data-test-ids';

export abstract class BaseProgressNotePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickDischargeButton(): Promise<void> {
    const dischargeButton = this.#page.getByTestId(dataTestIds.progressNotePage.dischargeButton);
    await expect(dischargeButton).toBeVisible();
    await expect(dischargeButton).toBeEnabled();
    await dischargeButton.click();
    await expect(dischargeButton).toHaveText('Discharged');
    await expect(dischargeButton).toBeDisabled();
  }

  async clickReviewAndSignButton(): Promise<void> {
    const reviewAndSignButton = this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton);
    await reviewAndSignButton.waitFor({ state: 'visible' });
    await expect(reviewAndSignButton).toBeEnabled();
    await reviewAndSignButton.click();
  }

  async verifyReviewAndSignButtonDisabled(): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.reviewAndSignButton)).toBeDisabled();
  }

  async clickSignButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.dialog.proceedButton).click();
  }

  async verifyProcedure(procedureType: string, procedureDetails: string[]): Promise<void> {
    const matcher = expect(
      this.#page.getByTestId(dataTestIds.progressNotePage.procedureItem).filter({ hasText: procedureType })
    );
    for (const procedureDetail of procedureDetails) {
      await matcher.toContainText(procedureDetail);
    }
  }

  async verifyInHouseLabs(sectionTitle: string, testName: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.labsTitle(sectionTitle))).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.labsTitle(sectionTitle))).toContainText(testName);
  }
  async verifyAddedAllergyIsShown(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toContainText(allergy);
  }
  async verifyRemovedAllergyIsNotShown(allergy: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.knownAllergiesContainer)).not.toContainText(
      allergy
    );
  }
  async verifyAddedMedicalConditionIsShown(medicalCondition: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toContainText(
      medicalCondition
    );
  }
  async verifyRemovedMedicalConditionIsNotShown(medicalCondition: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.progressNotePage.medicalConditionsContainer)).not.toContainText(
      medicalCondition
    );
  }
  abstract expectLoaded(): Promise<void>;
}
