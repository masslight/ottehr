import { BaseInPersonFlow } from './BaseInPersonFlow';
import { expect } from '@playwright/test';

export class PrebookInPersonFlow extends BaseInPersonFlow {
  protected async clickVisitButton(): Promise<void> {
    await this.locator.scheduleInPersonVisitButton.click();
  }
  protected async completeBooking(): Promise<void> {
    await this.locator.clickReserveButton();
  }
  protected async additionalStepsForPrebook(): Promise<{
    selectedSlot: { buttonName: string | null; selectedSlot: string | undefined };
    location: string | null;
  }> {
    await expect(this.locator.firstAvailableTime).toBeVisible();
    const title = await this.locator.pageTitle.textContent();
    const location = title ? title.replace('Book a visit at ', '').trim() : null;

    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    return { selectedSlot, location };
  }
}
