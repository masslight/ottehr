import { expect } from '@playwright/test';
import { BaseTelemedFlow, SlotAndLocation } from './BaseTelemedFlow';
import { dataTestIds } from '../../../src/helpers/data-test-ids';

export class PrebookTelemedFlow extends BaseTelemedFlow {
  async clickVisitButton(): Promise<void> {
    const scheduleButton = this.page.getByTestId(dataTestIds.scheduleVirtualVisitButton);
    await expect(scheduleButton).toBeVisible();
    await scheduleButton.click();
  }
  async completeBooking(): Promise<void> {
    await this.locator.clickReserveButton();
  }
  async selectTimeLocationAndContinue(): Promise<Partial<SlotAndLocation>> {
    await this.page.waitForTimeout(2000); // this is little waiting to let locations be loaded
    const statesSelector = this.page.getByTestId(dataTestIds.scheduleVirtualVisitStatesSelector);
    await expect(statesSelector).toBeVisible();

    await statesSelector.getByRole('button').click();
    const locationOption = this.page
      .locator('[role="option"]')
      .filter({ hasNot: this.page.locator('[aria-disabled="true"], [disabled]') }) // Exclude disabled options
      .first();
    const location = await locationOption.textContent();
    await locationOption.click();

    const selectedSlot = await this.fillingInfo.selectRandomSlot();
    await this.continue();
    return { selectedSlot, location };
  }

  async startVisitFullFlow() {
    await this.selectVisitAndContinue();
    const slotAndLocation = await this.selectTimeLocationAndContinue();
    await this.selectDifferentFamilyMemberAndContinue();
    const patientBasicInfo = await this.fillNewPatientDataAndContinue();
    await this.completeBooking();
    await this.page.waitForURL(/\/visit/);
    return {
      patientBasicInfo,
      slotAndLocation,
    };
  }
}
