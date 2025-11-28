import { expect } from '@playwright/test';
import { CommonLocatorsHelper } from '../CommonLocatorsHelper';

export class PastVisitsPage extends CommonLocatorsHelper {
  async navigate(): Promise<void> {
    await this.page.goto('/past-visits');

    await this.page.waitForSelector('h1:has-text("Past Visits")');
  }

  async verifyEmptyState(): Promise<void> {
    const emptyStateMessage = this.page.getByTestId('empty-state-message');
    await expect(emptyStateMessage).toBeVisible();
    await expect(emptyStateMessage).toHaveText('There are no past visits.');

    const visitsList = this.page.getByTestId('past-visits-list');
    await expect(visitsList).not.toBeVisible();
  }

  async verifyNonEmptyState(): Promise<void> {
    const visitsList = this.page.getByTestId('past-visits-list');
    await expect(visitsList).toBeVisible();

    const emptyStateMessage = this.page.getByTestId('empty-state-message');
    await expect(emptyStateMessage).not.toBeVisible();
  }

  async verifyBackButton(): Promise<void> {
    const backButton = this.page.getByTestId('back-to-homepage-button');
    await expect(backButton).toBeVisible();
    await expect(backButton).toHaveText('Back to homepage');
  }
  async clickBackToHomepageButton(): Promise<void> {
    await this.page.getByTestId('back-to-homepage-button').click();
  }
}
