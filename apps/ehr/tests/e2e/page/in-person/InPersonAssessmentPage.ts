import { expect, Page } from '@playwright/test';
import { clickAndWaitForChartDataDeletion } from 'test-utils';
import { dataTestIds } from '../../../../src/constants/data-test-ids';
import { BaseAssessmentPage } from '../abstract/BaseAssessmentPage';

const DEFAULT_TIMEOUT = { timeout: 15000 };

export class InPersonAssessmentPage extends BaseAssessmentPage {
  #page: Page;
  constructor(page: Page) {
    super(page);
    this.#page = page;
  }

  async selectCptCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.cptCodeField).locator('input').fill(code);
    await this.#page.getByRole('option').filter({ hasText: code }).first().waitFor();
    await this.#page.getByRole('option').filter({ hasText: code }).first().click();

    // Find the specific CPT code entry and verify its delete button is enabled to ensure the code is saved
    const cptCodeEntry = this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code));
    await expect(cptCodeEntry).toBeVisible();
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(code))).toBeEnabled();
  }

  async selectEmCode(code: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).click();
    await this.#page.getByTestId(dataTestIds.assessmentCard.emCodeDropdown).locator('input').fill(code);
    await this.#page.getByRole('option').first().waitFor();
    await this.#page.getByRole('option').first().click();

    // Verify that the delete button is enabled to ensure the code is saved
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.deleteButton)).toBeEnabled();
  }

  async verifyCptCode(code: string): Promise<void> {
    await expect(this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code))).toContainText(code);
  }

  async verifyExactCptCodeDisplayIsShown(cptCodeDisplay: string): Promise<void> {
    const container = this.#page.getByTestId(dataTestIds.billingContainer.cptCodeContainer);
    await expect(
      container.getByText(cptCodeDisplay, { exact: true }),
      `checking ${cptCodeDisplay} is visible`
    ).toBeVisible();
  }

  async verifyCptCodeAbsent(code: string): Promise<void> {
    const value = await this.#page.getByTestId(dataTestIds.billingContainer.cptCodeEntry(code));
    await expect(value).toBeHidden();
  }

  async deleteCptCode(code: string): Promise<void> {
    await clickAndWaitForChartDataDeletion(
      this.#page,
      this.#page.getByTestId(dataTestIds.billingContainer.deleteCptCodeButton(code))
    );
  }

  async expectBillingCodesElement(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.billingContainer.container).waitFor({ state: 'visible' });
    const billingCodesContainer = this.#page.getByTestId(dataTestIds.billingContainer.container);
    await expect(billingCodesContainer).toBeVisible(DEFAULT_TIMEOUT);
  }

  /**
   * will return the primary dx and code string IF its entered, if nothing has been entered it returns null
   * it will NOT error if nothing is entered
   * @returns string or null
   */
  async checkForPrimaryDx(): Promise<string | null> {
    const primaryDx = this.#page.getByTestId(dataTestIds.diagnosisContainer.primaryDiagnosis);

    // if theres no dx entered,
    if ((await primaryDx.count()) === 0) {
      return null;
    }

    return await primaryDx.innerText();
  }

  async checkForSecondaryDx(input: { secondaryDx: string; addedViaLabOrder: boolean }): Promise<void> {
    const { secondaryDx, addedViaLabOrder } = input;

    const secondaryDxContainer = this.#page.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosisContainer);
    const secondaryDxItems = secondaryDxContainer.getByTestId(dataTestIds.diagnosisContainer.secondaryDiagnosis);

    const count = await secondaryDxItems.count();
    let found = false;

    for (let i = 0; i < count; i++) {
      const item = secondaryDxItems.nth(i);
      const text = (await item.textContent())?.trim() || '';

      if (text.includes(secondaryDx)) {
        // Confirm text exists
        await expect(item, `Confirming secondary diagnosis "${secondaryDx}" appears`).toContainText(secondaryDx);

        // If added via lab order, confirm the info icon exists
        if (addedViaLabOrder) {
          const infoIcon = item.locator('svg');
          await expect(infoIcon, `Confirming info icon is present for "${secondaryDx}"`).toBeVisible();
        }

        found = true;
        break;
      }
    }

    if (!found) {
      throw new Error(`Secondary diagnosis "${secondaryDx}" not found in the list`);
    }
  }
}

export async function expectAssessmentPage(page: Page): Promise<InPersonAssessmentPage> {
  await page.waitForURL(new RegExp('/in-person/.*/assessment'));
  await expect(page.getByTestId(dataTestIds.assessmentCard.medicalDecisionField)).toBeEnabled({
    timeout: 30000,
  });
  return new InPersonAssessmentPage(page);
}
