import { Page } from '@playwright/test';
import { dataTestIds } from '../../../src/constants/data-test-ids';

export class VisitDetailsPage {
  #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async clickCancelVisitButton(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelVisitButton).click();
  }

  async selectCancelationReason(cancelationReason: string): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelationReasonDropdown).click();
    await this.#page.getByText(cancelationReason).click();
  }

  async clickCancelButtonFromDialogue(): Promise<void> {
    await this.#page.getByTestId(dataTestIds.visitDetailsPage.cancelVisitDialogue).click();
  }
}

export async function expectVisitDetailsPage(page: Page, appointmentId: string): Promise<VisitDetailsPage> {
  await page.waitForURL(new RegExp('/visit/' + appointmentId));
  return new VisitDetailsPage(page);
}
