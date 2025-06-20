import { BrowserContext, Page, expect } from '@playwright/test';
import { FillingInfo } from './in-person/FillingInfo';
import { Locators } from './locators';

export class ModifyPage {
  page: Page;
  locator: Locators;
  fillingInfo: FillingInfo;
  context: BrowserContext;
  buttonName: string | null;

  constructor(page: Page) {
    this.page = page;
    this.locator = new Locators(page);
    this.fillingInfo = new FillingInfo(page);
    this.context = page.context();
    this.buttonName = '';
  }

  async clickModifyButton(): Promise<void> {
    await this.locator.modifyTimeThankYouScreen.click();
  }
  async checkModifyPageOpens(): Promise<void> {
    await this.clickModifyButton();
    await this.page.waitForURL(/\/reschedule/);
    await expect(this.locator.firstAvailableTime).toBeVisible();
    console.log(this.locator.pageTitle);
  }
  async selectNewTimeSlot(): Promise<string | null> {
    const buttons = this.page.locator('role=button[name=/^\\d{1,2}:\\d{2} (AM|PM)$/]');
    const buttonCount = await buttons.count();
    const randomIndex = Math.min(Math.floor(Math.random() * (buttonCount - 1)) + 1, buttonCount - 1);
    const selectedButton = buttons.nth(randomIndex);
    this.buttonName = await selectedButton.textContent();
    await selectedButton.click();
    await this.locator.submitModifyTime.click();
    if (this.buttonName) {
      return this.buttonName;
    }
    return null;
  }
  async checkTimeSlotIsUpdated(): Promise<void> {
    await expect(this.locator.thankYouHeading).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByText(`${this.buttonName}` || '')).toBeVisible();
  }
  async modifyInPersonVisit(): Promise<void> {
    await this.checkModifyPageOpens();
    await this.selectNewTimeSlot();
    await this.checkTimeSlotIsUpdated();
  }
}
