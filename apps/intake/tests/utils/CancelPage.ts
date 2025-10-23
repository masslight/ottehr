import { BrowserContext, expect, Page } from '@playwright/test';
import { CancellationReasonOptionsInPerson } from 'utils';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

export class CancelPage {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  context: BrowserContext;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.context = page.context();
  }
  private cancellationReasonOptions = Object.values(CancellationReasonOptionsInPerson);

  private getRandomEnumValue<T>(values: T[]): T {
    const randomIndex = Math.floor(Math.random() * (values.length - 2));
    return values[randomIndex];
  }

  async clickCancelButton(): Promise<void> {
    await this.locator.cancelVisitThankYouScreen.click();
  }
  async clickBookAgain(): Promise<void> {
    await this.locator.bookAgainButton.click();
  }
  async cancelInPersonVisit(): Promise<void> {
    await this.fillingInfo.cancelPrebookVisit();
  }
  async checkCancelPageOpens(): Promise<void> {
    await this.clickCancelButton();
    await this.page.waitForURL(/\/cancel/);
    await expect(this.locator.cancelScreenHeading).toBeVisible();
  }
  async selectCancellationReason(): Promise<void> {
    const randomCancelReason = this.getRandomEnumValue(this.cancellationReasonOptions);
    await this.locator.cancellationReasonField.click();
    await this.page.getByRole('option', { name: randomCancelReason }).click();
    await this.locator.cancelVisitButton.click();
  }
  async checkVisitIsCanceled(): Promise<void> {
    await this.page.waitForURL(/\/cancellation-confirmation/);
    await expect(this.locator.cancelConfirmationScreenHeading).toBeVisible({
      timeout: 15000,
    });
  }
  async checkBookAgainOpensHomePage(): Promise<void> {
    await this.clickBookAgain();
    await this.page.waitForURL(/\/home/);
    await expect(this.locator.homeScreenHeading).toBeVisible({
      timeout: 15000,
    });
  }
}
