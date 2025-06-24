import { expect } from '@playwright/test';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';

export class Homepage extends CommonLocatorsHelper {
  async navigate(): Promise<void> {
    await this.page.goto('/home');

    await this.verifyPage();
  }

  async verifyPage(): Promise<void> {
    await this.page.waitForSelector('h1:has-text("Welcome to Ottehr")');
  }

  async verifyPastVisitsButton(): Promise<void> {
    const backButton = this.page.getByTestId(dataTestIds.navigatePastVisitsButton);
    await expect(backButton).toBeVisible();
  }

  async clickRequestVirtualVisitButton(): Promise<void> {
    const requestVirtualVisitButton = this.page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    await requestVirtualVisitButton.click();
  }

  async clickStartVirtualVisitButton(): Promise<void> {
    const requestVirtualVisitButton = this.page.getByTestId(dataTestIds.startVirtualVisitButton);
    await requestVirtualVisitButton.click();
  }

  async clickPastVisitsButton(): Promise<void> {
    const pastVisitsButton = this.page.getByTestId(dataTestIds.navigatePastVisitsButton);
    await pastVisitsButton.click();
  }
}
