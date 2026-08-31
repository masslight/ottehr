import { expect, Page } from '@playwright/test';
import { dataTestIds } from 'src/constants/data-test-ids';
import { expectNursingOrdersPage, NursingOrdersPage } from './NursingOrdersPage';

export class NursingOrderCreatePage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async enterOrderNote(note: string): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.nursingOrderCreatePage.orderNoteInput)
      .locator('textarea')
      .locator('visible=true')
      .fill(note);
  }

  async clearOrderNote(): Promise<void> {
    await this.#page
      .getByTestId(dataTestIds.nursingOrderCreatePage.orderNoteInput)
      .locator('textarea')
      .locator('visible=true')
      .clear();
  }

  async getOrderNoteValue(): Promise<string> {
    return await this.#page
      .getByTestId(dataTestIds.nursingOrderCreatePage.orderNoteInput)
      .locator('textarea')
      .locator('visible=true')
      .inputValue();
  }

  async verifyOrderNoteLength(expectedLength: number): Promise<void> {
    const actualValue = await this.getOrderNoteValue();
    expect(actualValue.length).toBe(expectedLength);
  }

  async verifyOrderButtonDisabled(disabled: boolean): Promise<void> {
    const button = this.#page.getByTestId(dataTestIds.nursingOrderCreatePage.orderButton);
    if (disabled) {
      await expect(button).toBeDisabled();
    } else {
      await expect(button).toBeEnabled();
    }
  }

  async clickOrderButton(): Promise<NursingOrdersPage> {
    await this.#page.getByTestId(dataTestIds.nursingOrderCreatePage.orderButton).click();
    return await expectNursingOrdersPage(this.#page);
  }

  async clickCancelButton(): Promise<NursingOrdersPage> {
    await this.#page.getByTestId(dataTestIds.nursingOrderCreatePage.cancelButton).click();
    return await expectNursingOrdersPage(this.#page);
  }

  async verifyPageTitle(title: string = 'Nursing Order'): Promise<void> {
    await expect(this.#page.getByRole('heading', { name: title })).toBeVisible();
  }
}

export async function expectNursingOrderCreatePage(page: Page): Promise<NursingOrderCreatePage> {
  await page.waitForURL(new RegExp('/in-person/.*/nursing-orders/create'));
  await expect(page.getByTestId(dataTestIds.nursingOrderCreatePage.title)).toBeVisible();
  return new NursingOrderCreatePage(page);
}

export async function openNursingOrderCreatePage(appointmentId: string, page: Page): Promise<NursingOrderCreatePage> {
  await page.goto(`/in-person/${appointmentId}/nursing-orders/create`);
  return expectNursingOrderCreatePage(page);
}
