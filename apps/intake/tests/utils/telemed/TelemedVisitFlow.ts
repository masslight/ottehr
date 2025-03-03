import { BaseTelemedFlow, SlotAndLocation } from './BaseTelemedFlow';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { expect } from '@playwright/test';

export class TelemedVisitFlow extends BaseTelemedFlow {
  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.startVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }
  async completeBooking(): Promise<void> {
    // await this.locator.clickReserveButton();
  }
  async additionalStepsForPrebookAndContinue(): Promise<Partial<SlotAndLocation>> {
    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    const location = title ? title.replace('Book a visit at ', '').trim() : null;

    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    return { selectedSlot, location };
  }
}