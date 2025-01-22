import { Page } from '@playwright/test';
import { AllStates, AllStatesToNames } from './Paperwork';

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async clickContinue(): Promise<void> {
    await this.page.getByRole('button', { name: 'Continue' }).click();
  }

  async selectState(stateName = AllStatesToNames[AllStates[0].value]): Promise<void> {
    await this.page.getByPlaceholder('Search or select').click();
    await this.page.getByRole('option', { name: stateName }).click();
    await this.clickContinue();
  }
}
